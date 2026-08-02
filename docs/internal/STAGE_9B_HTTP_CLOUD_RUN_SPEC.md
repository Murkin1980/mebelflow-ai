# Stage 9B — HTTP и Cloud Run pilot adapter

## Цель

Сделать локально запускаемый HTTP Gateway, который можно упаковать в Cloud Run container, не раскрывая OpenAI key и не выдавая несколько Cloud Run instances за безопасные до появления distributed store.

## Реализованный срез

- Node HTTP adapter;
- `GET /warmup` без provider call;
- `POST /v1/intent` с strict request schema;
- server-owned prompt/model/pricing;
- tenant origin allowlist;
- idempotency и RPM gate interface;
- `GatewayStore` для session lock и cost usage;
- OpenAI output revalidation перед ответом клиенту;
- 64 KiB HTTP body limit;
- runtime TypeScript build;
- multi-stage non-root Dockerfile;
- Cloud Run YAML с Secret Manager reference.

## Pilot deployment gate

`maxScale` обязан оставаться `1`, пока используются `MemoryGatewayStore` и `MemoryRequestGate`. При одном instance допускается concurrency до 100, поскольку основная работа I/O-bound. Масштабирование до 10 instances разрешается только после атомарной реализации session lock с TTL, idempotency reservation, tenant RPM/TPM counters, usage/cost commit и tenant budget hard stop.

## Security

- `OPENAI_API_KEY` берётся только из environment/Secret Manager;
- клиент не может выбрать model, prompt, price или allowed commands;
- origin проверяется до AI call;
- provider output проверяется Zod/CommandSchema;
- ошибки не содержат provider body, prompt, utterance или key;
- image работает от непривилегированного пользователя `node`.

## Acceptance

- `npm run check` проходит;
- `npm run build:runtime` создаёт runtime output;
- warmup HTTP smoke возвращает `200` и `billableAiCalls: 0`;
- unsafe output, foreign origin, duplicate idempotency и client prompt injection отклоняются до применения;
- shared store contract блокирует одну session между двумя gateway instances;
- Dockerfile build отмечается непроверенным, если Docker отсутствует;
- live OpenAI smoke не обязателен до staging secret configuration.

## Не входит

- изменение Google Cloud;
- создание/загрузка Secret Manager secret;
- distributed managed-store implementation;
- live paid OpenAI call;
- STT HTTP endpoint;
- production landing embed.
