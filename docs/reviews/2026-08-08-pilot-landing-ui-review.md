# UI Review

## User task

Описать прямую кухню текстом или голосом, увидеть предварительную схему и безопасно отменить изменение.

## Direction

«Спокойная мастерская»: разговорный CTA, заметная схема, предварительный статус результата и постоянный disclaimer.

## Blocking

Исправлен горизонтальный overflow на Android 360×800: mobile grid теперь использует `minmax(0, 1fr)`.

Remote origin/Turnstile hostname, transcription gateway revision и real-token text E2E применены и проверены. Перед controlled pilot остаётся ручной real-microphone voice E2E.

## Major

Нет подтверждённых visual blockers после исправления. Live Turnstile и text flow приняты на production hostname; голосовой сценарий требует настоящего микрофона и проверки transcript пользователем.

## Minor

Локальный preview ожидаемо пишет CORS/Turnstile сообщения для `127.0.0.1`; они не считаются production evidence.

## Accessibility

Semantic regions, form labels, aria-live status, SVG descriptions, keyboard-visible controls и touch targets присутствуют. Полный screen-reader smoke на production hostname остаётся частью real-token E2E.

## Mobile

Playwright viewport 360×800: `scrollWidth=360`, `clientWidth=360`; горизонтальная прокрутка отсутствует. Основной CTA, текстовая альтернатива голосу и disclaimer сохранены.

## Trust and AI transparency

Интерфейс различает пользовательскую фразу, обработку AI, применённое изменение и ошибку. Цена помечена как расход AI-запроса, схема — как предварительная; production disclaimer видим.

## Verification evidence

- `npm run check`: 20 test files, 244/244 tests.
- `npm run build:runtime`: PASS.
- `npm run build:widget`: PASS.
- Playwright mobile screenshot: `.playwright-cli/page-2026-08-08T11-57-33-216Z.png`.
- Mobile overflow assertion: 360/360.

## Decision

PASS WITH HANDOFF — UI slice, Turnstile, text flow и STT cost-safety gate приняты; controlled pilot ждёт только ручной real-microphone voice smoke.
