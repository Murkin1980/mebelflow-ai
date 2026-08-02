# AI Gateway

Production-compatible Stage 9A core для центрального MebelFlow Gateway.

- `OpenAiIntentProvider` вызывает GPT-5 mini через injected network sender и OpenAI Responses API.
- `AiGateway.warmup()` прогревает только локальные зависимости и не вызывает AI.
- Один opaque session ID имеет не более одного in-flight запроса.
- Session token/call limits и tenant budget проверяются до provider call.
- Стоимость GPT-5 mini считается по versioned price snapshot и фактической usage.

Пакет не содержит API-ключей, HTTP-framework, распределённого lock store или production deployment. Эти adapters подключаются на следующем внешнем срезе по `docs/internal/STAGE_9A_AI_CLOUD_RUN_SPEC.md`.
