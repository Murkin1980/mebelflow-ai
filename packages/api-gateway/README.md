# API Gateway

Framework-neutral HTTP boundary для Stage 9B.

- `GET /warmup` не вызывает AI.
- `POST /v1/intent` принимает только tenant/session/idempotency, locale, utterance и compact state.
- Prompt, модель и тариф формируются на сервере и не принимаются от клиента.
- Origin allowlist, idempotency/rate gate и безопасная проверка provider output выполняются до передачи результата виджету.
- `GatewayStore` и `RequestGate` являются границами для production distributed adapters.

`MemoryGatewayStore` и `MemoryRequestGate` предназначены только для тестов и одного процесса. Для нескольких Cloud Run instances нужны атомарные managed-store реализации.
