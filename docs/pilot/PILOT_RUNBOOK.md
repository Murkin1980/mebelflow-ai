# MebelFlow AI Pilot Runbook

## Цель

Проверить, что потенциальный клиент может завершить разговорный сценарий, увидеть предварительную компоновку и цену и оставить квалифицированный контакт при приемлемой стоимости сессии.

## До запуска

1. Развернуть widget/API adapters и заменить `widgetScriptUrl` на фактический URL.
2. Добавить фактический origin лендинга в allowlist.
3. Подключить error и analytics sinks без телефона, имени, текста разговора и аудио.
4. Настроить tenant monthly budget и hard stop.
5. Проверить disclaimer, consent, OTP/CAPTCHA и secure PDF download.

## Выборка

- 20 контролируемых сессий с кодами `TEST-01`…`TEST-20`;
- 5 реальных prospects с кодами `REAL-01`…`REAL-05`;
- по одному интервью после каждой реальной сессии.

Не записывать в analytics имя, телефон, email, аудио или свободный текст клиента.

## Обязательные события

`session_started`, `dimensions_completed`, `layout_completed`, `style_selected`, `price_viewed`, `contact_submitted`, `pdf_downloaded`, `order_clicked`, `session_abandoned`, `error`.

## Gate

GO возможен только если выборка полная, completion ≥50%, contact ≥20%, error ≤10% и расходы не превышают tenant budget. До этого решение — `WAITING_FOR_DATA`.

## Текущий статус

Landing, custom-domain route, Turnstile hostname, Cloud Run revision и STT budget/rate/cost gateway развёрнуты. Real-token text E2E и Firestore cost commit проверены. До controlled sessions остаётся ручной real-microphone voice E2E с проверкой показанного transcript. Фактические controlled sessions, real prospects и interview notes ещё не проведены.
