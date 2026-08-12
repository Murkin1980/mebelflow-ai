# UI Review

## User task

После серверной расшифровки автоматически и безопасно передать голосовую команду в intent API, не зависнуть при задержке повторной Turnstile-проверки и не потерять распознанный текст.

## Direction

Сохранён существующий разговорный интерфейс. Голосовая запись, расшифровка и intent теперь проходят одним защищённым запросом и одной Turnstile-проверкой; при ошибке intent распознанный текст остаётся доступным для ручной отправки.

## Blocking

Нет.

## Major

Нет после исправления. Единый серверный endpoint исключает промежуточную повторную проверку, а параллельная расшифровка заблокирована.

## Minor

Реальный микрофонный E2E остаётся отдельным pilot gate: автоматизированный smoke не создавал платные STT/intent вызовы.

## Accessibility

Проверено: микрофон имеет `aria-label`, статус объявляется через `aria-live=polite`, текстовое поле остаётся альтернативой голосу, Send корректно disabled без токена.

## Mobile

Снимок 360×800 сохранён в `output/playwright/stage11-voice-submit-mobile.png`; основной CTA и начало формы доступны, горизонтального переполнения не обнаружено.

## Trust and AI transparency

Статусы различают расшифровку, применение команды и ручное восстановление. Распознанный текст не удаляется при ошибке intent или истечении проверки.

## Verification evidence

- `npm run check`: 23 test files, 265 tests.
- `npm run build:widget`: pass.
- Browser snapshots: desktop and mobile 360×800.
- Unit scenarios: one Turnstile verification, rejected proof, STT failure and transcript recovery after intent failure.

## Decision

PASS WITH LIMITATION: production deployment допустим; реальный микрофонный E2E остаётся незакрытым pilot evidence.
