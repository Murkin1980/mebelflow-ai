# Widget

Production UI adapter запланирован поверх принятых domain/view-model packages. Stage 9 добавляет origin-allowlisted embed contract и pilot telemetry; фактический landing embed остаётся внешним шагом развертывания.

## Turnstile gate

`src/turnstile.ts` содержит публичный managed widget sitekey и передаёт одноразовый browser token существующему AI submit callback. Токен проверяет Cloud Run API через стандартный Spin Worker до rate limit, резервирования бюджета и вызова GPT. Интеграция сохраняет marker `data-action="turnstile-spin-v1"`.

Это frontend gate, а не авторизация Cloud Run. Приватный staging остаётся закрытым IAM. До публичного запуска нужен доверенный edge/backend, который не позволит вызвать `/v1/intent` в обход Turnstile из произвольного HTTP-клиента.
