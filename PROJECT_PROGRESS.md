# PROJECT PROGRESS — MebelFlow AI

Обновлять после каждого завершённого рабочего этапа.

## Общий статус

```text
Идея и позиционирование     ██████████ 100%
Аудит прошлых проектов      ██████████ 100%
Фундамент                   ██████████ 100%
Архитектура                 ██████████ 100%
Pascal Core spike           ██████████ 100%
Domain Core                 ██████████ 100%
Layout Engine               ██████████ 100%
SVG Renderer                ██████████ 100%
Text AI                     ██████████ 100%
AI Gateway                  ██████████ 100%
HTTP/Cloud Run Adapter      ██████████ 100%
Voice                       ██████████ 100%
Pricing and Styles          ██████████ 100%
Admin and Lead              ██████████ 100%
PDF                         ██████████ 100%
Pilot                       ████░░░░░░  40%
```

## Current phase

**Stage 0/1/2/3/4/5/6/7/8 и Stage 9A AI Gateway приняты по самопроверке. Требуется production deploy и полевой Pilot**

## Completed

- [x] Сформулирована новая упрощённая идея
- [x] Отказались от CAD-интеграций
- [x] Выбран разговорный UX
- [x] Выбран SVG-first
- [x] Выбран вариант B
- [x] Проведён аудит существующих репозиториев
- [x] Определены донорские модули
- [x] Подготовлен комплект проектной документации
- [x] Создан TypeScript-проект и настроены проверки
- [x] Pascal Core 0.9.2 проверен; принято решение ADAPT
- [x] Создан независимый `SceneStoreAdapter`
- [x] Созданы Project State v1 и Command Schema v1
- [x] Реализован pure deterministic reducer, idempotency и undo/redo
- [x] Проходят 39 unit-тестов
- [x] Добавлены module catalog и unit normalization
- [x] Добавлены state migration и corrupted-state recovery
- [x] Реализован и проверен in-memory `SceneStoreAdapter`
- [x] Настроен GitHub Actions CI
- [x] Чистая установка и 74 unit-теста проходят
- [x] Локальный UI skill валиден и установлен в Codex
- [x] Реализован deterministic Layout Engine прямой кухни
- [x] Добавлены операции ряда, правила доборов и техники
- [x] Реализованы верхний ряд и антресоли
- [x] Общая history поддерживает Stage 2, undo/redo и idempotency
- [x] Проходят 115 unit/property-based тестов
- [x] Реализован доступный responsive SVG Renderer
- [x] Добавлены selected/warning/empty состояния и экспорт SVG/PNG
- [x] Mobile 360×800, desktop, keyboard, reduced-motion и offline проверены
- [x] Добавлен SVG snapshot baseline и UI review PASS
- [x] Проходят 131 unit/property/snapshot тест
- [x] Реализованы provider abstraction и fake provider
- [x] Зафиксированы versioned prompt и канонический TECH_SPEC contract
- [x] Реализованы confidence, clarification, validation и rejection
- [x] Safe apply сохраняет state при provider/domain errors
- [x] Token ledger интегрирован в IntentSession
- [x] Сквозной conversation replay и 158 тестов проходят
- [x] Реализованы `SttProvider`, `FakeSttProvider` и Voice state machine
- [x] Явные permission/record/stop и подтверждение транскрипта защищают от скрытого применения
- [x] Cancel/retry, offline recovery и текстовая альтернатива сохраняют данные пользователя
- [x] STT cost ledger считает оплачиваемые секунды и ориентировочную стоимость в KZT
- [x] Android voice view contract и 168 тестов проходят
- [x] Добавлены 5 style presets с тремя палитрами каждый и 6 facade presets
- [x] Tenant settings ограничивают доступные стили, палитры и фасады
- [x] Реализованы per-meter, per-module и hybrid pricing strategies
- [x] Диапазон KZT содержит breakdown, причины неопределённости и formula version
- [x] Recalculation и trust presentation покрыты тестами; 180 тестов проходят
- [x] Contact schema, OTP/CAPTCHA boundaries и idempotent lead creation реализованы
- [x] Lead details содержат project snapshot и append-only event history
- [x] Status transitions, comments и Telegram notification adapter покрыты тестами
- [x] Tenant settings, hard limits, opaque resume tokens и RBAC реализованы
- [x] 190 unit/property/snapshot/contract тестов проходят
- [x] Brief model содержит branding, contact, SVG scheme, modules, style, price и disclaimer
- [x] Реализованы пять PDF policy modes и payment/credit-on-order boundary
- [x] Secure tenant-bound download grants поддерживают expiry, revoke и audit
- [x] Двухстраничный sample PDF отрендерен и визуально принят
- [x] 197 unit/property/snapshot/contract тестов проходят
- [x] Pilot tenant и origin-allowlisted landing embed contract настроены
- [x] Privacy-safe analytics, sanitized error events и cost dashboard реализованы
- [x] Controlled/real session registry, interview validation и funnel formulas реализованы
- [x] Go/no-go gate не принимает решение без полной реальной выборки
- [x] 204 unit/property/snapshot/contract теста проходят
- [x] Зафиксирован GPT-5 mini через центральный Google Cloud Run Gateway без GPU
- [x] Добавлен OpenAI Responses API adapter с compact state и server-only key boundary
- [x] Warmup не создаёт AI-сессию и не вызывает provider
- [x] Реализованы per-session in-flight, call/token и tenant cost gates
- [x] Версионированный расчёт GPT-5 mini учитывает cached input tokens и USD/KZT snapshot
- [x] Contract load test покрывает 100 одновременных независимых сессий
- [x] 211 unit/property/snapshot/contract тестов проходят
- [x] Реализован strict HTTP contract `/warmup` и `/v1/intent`
- [x] Prompt/model/pricing остаются server-owned и не принимаются от клиента
- [x] Добавлены origin, idempotency/RPM и shared GatewayStore boundaries
- [x] Добавлены runtime build, Node server, Dockerfile и Cloud Run YAML
- [x] Warmup HTTP smoke подтверждает 200 и ноль billable AI calls
- [x] 227 unit/property/snapshot/contract тестов проходят
- [x] Firestore-транзакции координируют session leases, idempotency, RPM и persistent usage между Cloud Run instances
- [x] Tenant budget резервируется до provider call и сверяется с фактической стоимостью транзакционно

## Next actions

1. Добавить публичную edge-защиту (Turnstile/OTP или подписанный widget token) до открытия Cloud Run для интернета.
2. Подключить landing widget к приватному/staging контракту через утверждённую edge-схему.
3. Встроить widget на разрешённый landing origin и подключить безопасный warmup.
4. Провести 20 controlled sessions и исправить подтверждённые blockers.
5. Провести 5 real prospect sessions и 5 интервью без PII в analytics.
6. Сформировать фактический funnel report и принять GO/NO_GO.

## Stage 9D verified staging

- [x] Создан отдельный Google Cloud project `mebelflow-ai-pilot` с billing.
- [x] Firestore Native и Artifact Registry размещены в `europe-central2`.
- [x] Runtime service account ограничен Firestore и одним OpenAI secret.
- [x] Cloud Build создал воспроизводимый container image.
- [x] Приватный Cloud Run staging работает с scale-to-zero и max scale 20.
- [x] Warmup вернул `200` и `billableAiCalls: 0`.
- [x] Live GPT-5 mini smoke: `SET_WALL_WIDTH=3000`, 407 input, 81 output token, 0.12 KZT.
- [x] Two-instance contention smoke: один запрос `200`, второй `409 SESSION_REQUEST_IN_PROGRESS`.
- [x] Turnstile managed widget и стандартный Spin Worker развёрнуты и end-to-end проверены.
- [x] Frontend AI-submit gate добавлен с `data-action="turnstile-spin-v1"`; 230 тестов проходят.

## Risks

## Stage 9E server-side Turnstile enforcement

- [x] Frontend передаёт одноразовый Turnstile token серверу с `data-action="turnstile-spin-v1"`.
- [x] Cloud Run проверяет token через стандартный Spin Worker до rate limit, budget reservation и GPT.
- [x] Приватный revision `00006-6xw`: warmup 200/0 AI calls, missing token 400, dummy token 403.
- [x] 19 test files, 235/235 tests и runtime build проходят.
- [x] Владелец явно разрешил публичный invocation; `allUsers` получил только `roles/run.invoker` для staging-сервиса.
- [x] Публичный smoke: warmup 200/0 AI calls, dummy Turnstile 403, foreign origin 403.
- [x] Поддомен `ai.salamat-mebel.kz` создан в Cloudflare и отвечает по HTTPS; публикация MebelFlow landing остаётся следующим шагом.


| Риск | Вероятность | Влияние | Митигирование |
|---|---:|---:|---|
| AI ошибочно понимает команды | Средняя | Высокое | Белый список + подтверждение |
| Сложный UX на телефоне | Средняя | Высокое | Conversation first + SVG |
| Рост токенов | Высокая | Среднее | Compact state + rules |
| Pascal утяжелит bundle | Средняя | Среднее | Spike + adapter |
| Неточные цены | Высокая | Высокое | Диапазон + disclaimer |
| Клиент вводит неверные размеры | Высокая | Высокое | Вопросы + предупреждения |
| Абьюз бесплатных ТЗ | Средняя | Среднее | Лимиты, OTP, CAPTCHA, paywall |
