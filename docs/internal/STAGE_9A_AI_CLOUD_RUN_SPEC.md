# Stage 9A — GPT-5 mini и Cloud Run Gateway

## 1. Бизнес-цель

Подготовить безопасный production-compatible AI-слой пилота: посетитель с рекламы не ждёт лишний холодный старт, мебельщик не раскрывает API-ключ и не получает неконтролируемый счёт, а AI только переводит фразу в команду.

## 2. Пользовательский результат

1. Лендинг загружается и неблокирующе прогревает Gateway.
2. Виджет показывает готовое локальное приветствие без LLM.
3. После первой текстовой команды Gateway вызывает GPT-5 mini и возвращает валидируемый intent.
4. Повторная параллельная команда той же сессии отклоняется понятным retriable-ответом.
5. Голос начинается только после нажатия, транскрипт виден до применения.
6. При лимите или ошибке схема и введённый текст сохраняются.

## 3. Архитектура

```text
Landing → GET /warmup → Cloud Run Gateway (без OpenAI)
Widget → POST /intent → session/budget/rate gates → GPT-5 mini
Mic → POST /transcribe → gpt-4o-mini-transcribe → transcript confirm → /intent
Validated command → deterministic layout/pricing → PDF renderer
```

Cloud Run baseline:

- 1 vCPU;
- 512 MiB–1 GiB RAM;
- request-based billing;
- concurrency 40;
- min instances 0 normally, 1 during paid campaign;
- max instances 10 initially;
- timeout 60 seconds;
- no GPU.

## 4. API contracts

### `GET /warmup`

Возвращает `200` и `{ "status": "ready" }`. Не создаёт session, не принимает PII, не вызывает OpenAI и не пишет billable cost event. Ответ `Cache-Control: no-store`.

### `POST /intent`

Вход: tenant ID, opaque session ID, locale, utterance, compact project summary, idempotency key. Полный чат, SVG, телефон и аудио не передаются модели.

Выход: канонический command envelope/clarification либо стабильная ошибка. Любая команда повторно проходит Zod и Layout Engine.

### `POST /transcribe`

Принимает только разрешённый MIME, ограниченный размер и длительность до 60 секунд на сообщение. Аудио не хранится после успешного транскрипта. Максимум 10 минут STT на ТЗ.

## 5. Модель и стоимость

- intent: `gpt-5-mini`, snapshot закрепляется конфигурацией после pilot validation;
- STT: `gpt-4o-mini-transcribe`;
- TTS не входит в Stage 9A;
- static prompt versioned;
- max 25 intent calls, 30 000 input tokens и 5 000 output tokens на ТЗ;
- фактическая usage записывается после каждого ответа;
- internal KZT cost использует versioned USD price и FX snapshot;
- tenant hard stop проверяется до вызова provider.

## 6. Параллельность и всплеск 100 клиентов

- вход на страницу не расходует OpenAI tokens;
- один Cloud Run instance обслуживает до 40 I/O-bound запросов;
- autoscaling поднимает дополнительные instances до 10;
- один session ID имеет один in-flight intent;
- глобальный limiter держит запас ниже OpenAI RPM/TPM;
- при `429/5xx` применяются ограниченные retries только для идемпотентного provider call;
- очередь показывает статус «Обрабатываю изменения…», а не теряет ввод.

## 7. Безопасность и приватность

- API key только серверный;
- origin allowlist и tenant binding обязательны;
- логирование без телефона, email, аудио и свободного текста;
- prompt injection не расширяет command whitelist;
- provider output считается недоверенным;
- CAPTCHA после порога;
- не более одного активного проекта anonymous session;
- Secret Manager, HTTPS и service account с минимальными правами в production.

## 8. Наблюдаемость

Записывать: request ID, tenant/session pseudonymous IDs, latency, model, prompt version, input/cached/output tokens, STT seconds, cost USD/KZT, result category, retry count и sanitized error code.

Не записывать: исходное аудио, полный utterance, телефон, email и provider API key.

## 9. Критерии приёмки Stage 9A

- warmup contract не вызывает provider;
- GPT-5 mini adapter отправляет compact state и versioned prompt;
- malformed provider response не достигает Layout Engine;
- два одновременных запроса одной сессии не выполняются параллельно;
- разные сессии могут выполняться параллельно;
- token/cost calculation детерминирован и versioned;
- limit/hard-stop срабатывает до provider call;
- отсутствуют секреты в репозитории;
- contract tests моделируют 100 одновременных клиентов;
- `npm run check` проходит;
- production deployment, реальные рекламные пользователи и платежи остаются отдельным внешним шагом.

## 10. Не входит в этап

- production deployment и изменение внешнего Google Cloud;
- реальные OpenAI/STT вызовы;
- TTS/realtime voice conversation;
- распределённая очередь и база данных;
- landing visual redesign;
- новые категории мебели;
- изменение цены PDF без отдельного бизнес-решения.
