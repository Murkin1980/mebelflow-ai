# ADR-004: GPT-5 mini через центральный MebelFlow Gateway в Google Cloud Run

**Статус:** Accepted  
**Дата:** 2026-08-02

## Контекст

MVP требует точного преобразования русских и казахских фраз в безопасные команды, предсказуемой стоимости и готовности выдержать рекламный всплеск. Локальные Qwen-модели требуют GPU и показали неприемлемый риск галлюцинаций. При текущем объёме их инфраструктура не даёт подтверждённой экономии.

## Решение

- Основной intent provider — `gpt-5-mini` через OpenAI Responses API.
- API-ключ хранится только в серверном Secret Manager/Cloud Run environment.
- Google Cloud Run запускает лёгкий MebelFlow Gateway без GPU; сама модель работает у OpenAI.
- Лендинг может вызвать бесплатный `GET /warmup`, который прогревает контейнер и зависимости, но не создаёт AI-сессию и не вызывает OpenAI.
- Во время активной рекламы допускается `min instances = 1`; вне кампании — `0`.
- Реальная AI-сессия создаётся только после первого сообщения пользователя.
- Один session ID не может иметь более одного одновременного AI-запроса.
- Целевая конфигурация после distributed store: concurrency `40`, max instances `10`, request timeout `60s`.
- До distributed store pilot deployment ограничивается одним instance с concurrency до `100`; это сохраняет корректность in-memory lock/rate/cost state.
- Голос: явная запись → `gpt-4o-mini-transcribe` → видимый редактируемый транскрипт → подтверждение → GPT-5 mini.
- Автоматический запуск микрофона, скрытая запись и вызов LLM при простом просмотре сайта запрещены.
- Геометрия, цена и PDF остаются детерминированными и не передаются LLM.

## Стоимость и лимиты

- Стоимость считается по фактическим input/cached/output tokens и версии тарифа.
- Каждая запись содержит tenant, session, provider, model, prompt version и курс USD/KZT.
- Действуют session limit, tenant monthly budget, hard stop, rate limiting, CAPTCHA threshold и идемпотентность.
- Цена PDF задаётся tenant policy и не равна буквально расходу токенов.

## Масштабирование

Cloud Run масштабирует stateless Gateway горизонтально. Локальные session locks являются дополнительной защитой UX; распределённая production-версия обязана использовать общий idempotency/lock store. OpenAI rate-limit errors обрабатываются очередью, `Retry-After` и exponential backoff с jitter.

## Последствия

### Плюсы

- выше точность intent parsing;
- нет постоянной оплаты GPU;
- быстрый и обратимый пилот;
- единый контроль tenant-бюджетов;
- провайдер остаётся за существующим adapter contract.

### Минусы

- внешняя зависимость от OpenAI;
- требуется контроль RPM/TPM и бюджета;
- для production нужен распределённый lock/queue;
- голос оплачивается отдельно от GPT-5 mini.

## Возврат к self-hosted моделям

Только после реальной выборки пилота, воспроизводимого quality benchmark и подтверждённой экономии с учётом GPU, эксплуатации и fallback.
