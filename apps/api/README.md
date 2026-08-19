# API

HTTP/Google Cloud Run adapter запланирован поверх принятых `packages/lead-admin` и `packages/ai-gateway` core. Stage 9A фиксирует GPT-5 mini, бесплатный warmup, server-only API key boundary, token/cost gates и 100-client contract load test. До production deploy остаются HTTP routing, Secret Manager, общий distributed lock/rate limiter и persistent cost ledger.

## Stage 9B pilot server

`server.mjs` адаптирует framework-neutral handler к Node HTTP. Runtime TypeScript собирается командой `npm run build:runtime`, локальный сервер запускается `npm run start:api` при наличии server-only environment.

Stage 9B первоначально ограничивал Cloud Run одним instance. В Stage 9C process-local coordination заменена Firestore-транзакциями, поэтому актуальный template допускает multi-instance scaling.

Секрет передаётся только через Secret Manager reference `mebelflow-openai-api-key`; в image, YAML и git значение отсутствует. Перед deploy требуется заменить `PROJECT_ID`, `REGION`, `IMAGE_TAG`, service account и проверить origin/tenant.

## Stage 9C Firestore coordination

Runtime теперь использует `FirestoreCoordinationStore` для shared lease locks, idempotency, RPM windows и cost ledgers. Cloud Run template разрешает `maxScale: 20`; Application Default Credentials должны принадлежать service account с Firestore data access.

Firestore Native database следует размещать рядом с Cloud Run. TTL policies на поле `ttlAt` нужны для `mebelflowGatewaySessions`, `mebelflowGatewayRequests` и `mebelflowGatewayRateWindows`. TTL-удаление асинхронно: корректность lease всегда определяется транзакционной проверкой `leaseExpiresAtMs`, а не фактом удаления документа.

Read-only проверка staging prerequisites: `scripts/check-cloud-run-prerequisites.ps1`. Она не читает значение Secret Manager и не изменяет Google Cloud.
Required runtime variables for the protected intent endpoint:

- `TURNSTILE_VERIFY_URL` — HTTPS URL of the stock Spin siteverify Worker;
- `TURNSTILE_EXPECTED_HOSTNAME` — exact landing hostname;
- `PILOT_ALLOWED_ORIGIN` — exact browser origin;
- `PILOT_TENANT_ID` — server-owned tenant identifier.

`POST /v1/intent` requires `turnstileToken`. The API consumes it once on the server and rejects invalid proof before Firestore request gating, budget reservation or OpenAI.
