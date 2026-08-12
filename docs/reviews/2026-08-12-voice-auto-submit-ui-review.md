# UI Review

## User task

После серверной расшифровки автоматически и безопасно передать голосовую команду в intent API, не зависнуть при задержке повторной Turnstile-проверки и не потерять распознанный текст.

## Direction

Сохранён существующий разговорный интерфейс. Изменены только состояния и координация: расшифровка видима, повторная проверка безопасности объяснена, при таймауте текст остаётся доступным для ручной отправки.

## Blocking

Нет.

## Major

Нет после исправления. Координатор single-fire отменяет поздние и повторные события, изменение текста отменяет автоотправку, параллельная расшифровка заблокирована.

## Minor

Реальный микрофонный E2E остаётся отдельным pilot gate: автоматизированный smoke не создавал платные STT/intent вызовы.

## Accessibility

Проверено: микрофон имеет `aria-label`, статус объявляется через `aria-live=polite`, текстовое поле остаётся альтернативой голосу, Send корректно disabled без токена.

## Mobile

Снимок 360×800 сохранён в `output/playwright/stage11-voice-submit-mobile.png`; основной CTA и начало формы доступны, горизонтального переполнения не обнаружено.

## Trust and AI transparency

Статусы различают расшифровку, обновление проверки безопасности, задержку и ручное восстановление. Распознанный текст не удаляется при таймауте или истечении проверки.

## Verification evidence

- `npm run check`: 23 test files, 265 tests.
- `npm run build:widget`: pass.
- Browser snapshots: desktop and mobile 360×800.
- Unit scenarios: single submit, repeated success, timeout, edited transcript, cancellation.

## Decision

PASS WITH LIMITATION: production deployment допустим; реальный микрофонный E2E остаётся незакрытым pilot evidence.
