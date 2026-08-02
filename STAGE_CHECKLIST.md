# STAGE CHECKLIST — MebelFlow AI

## Global Definition of Done

Каждый этап завершён только если:

- код написан;
- тесты добавлены;
- документация обновлена;
- нет скрытых зависимостей;
- mobile flow проверен;
- ошибки понятны пользователю;
- PROJECT_PROGRESS.md обновлён;
- SESSION_NOTES.md обновлён;
- решение соответствует FOUNDATION.md.

## Этап 0 — Foundation

- [x] Создан репозиторий `mebelflow-ai`
- [x] Добавлены корневые документы
- [x] Проверена лицензия Pascal-пакетов
- [x] Выполнен spike `@pascal-app/core`
- [x] Измерен bundle impact
- [x] Проверена browser-neutral совместимость выбранного core; Android UI smoke перенесён в первый UI-срез
- [x] Принято решение use/adapt/reject
- [x] Утверждён state adapter
- [x] Определён стек
- [x] Настроены CI checks

## Этап 1 — Domain Core

- [x] Project State v1
- [x] Zod schemas
- [x] Module catalog v1
- [x] Command Schema v1
- [x] Unit normalization
- [x] Reducer
- [x] Undo/redo
- [x] Idempotency
- [x] State migrations
- [x] Unit tests
- [x] Corrupted state recovery

## Этап 2 — Layout Engine

- [x] Wall width
- [x] Room height
- [x] Add module
- [x] Remove module
- [x] Insert before
- [x] Insert after
- [x] Move left/right
- [x] Change width
- [x] Remaining width
- [x] Filler rules
- [x] Appliance rules
- [x] Upper row
- [x] Mezzanine rules
- [x] Warnings
- [x] Property-based tests

## Этап 3 — SVG

- [x] Wall
- [x] Lower row
- [x] Countertop
- [x] Apron
- [x] Upper row
- [x] Mezzanine
- [x] Appliances
- [x] Labels
- [x] Dimensions
- [x] Selection
- [x] Warnings
- [x] Style colors
- [x] Mobile
- [x] PNG/SVG export
- [x] Visual regression

## Этап 4 — Text AI

- [ ] Provider abstraction
- [ ] Prompt versioning
- [ ] Compact state
- [ ] Command parser
- [ ] Confidence
- [ ] Clarification
- [ ] Validation
- [ ] Rejection
- [ ] Safe apply
- [ ] Error recovery
- [ ] Token accounting
- [ ] Conversation tests

## Этап 5 — Voice

- [ ] Mic permission
- [ ] Record
- [ ] Stop
- [ ] STT
- [ ] Transcript
- [ ] Confirm
- [ ] Apply command
- [ ] Cancel
- [ ] Retry
- [ ] Cost tracking
- [ ] Android test
- [ ] Poor network behavior

## Этап 6 — Styles and Pricing

- [ ] 5 styles
- [ ] 3 palettes each
- [ ] 6 facade presets
- [ ] Tenant styles
- [ ] Per-meter pricing
- [ ] Per-module pricing
- [ ] Hybrid pricing
- [ ] Min/max estimate
- [ ] Breakdown
- [ ] Formula version
- [ ] Recalculation tests

## Этап 7 — Lead/Admin

- [ ] Contact form
- [ ] OTP/CAPTCHA boundary
- [ ] Create lead
- [ ] Lead details
- [ ] Scheme preview
- [ ] Event history
- [ ] Status
- [ ] Telegram
- [ ] Tenant settings
- [ ] Limits
- [ ] Resume
- [ ] RBAC

## Этап 8 — PDF

- [ ] Template
- [ ] Disclaimer
- [ ] Scheme
- [ ] Modules
- [ ] Style
- [ ] Price
- [ ] Tenant branding
- [ ] Policy modes
- [ ] Payment boundary
- [ ] Credit-on-order
- [ ] Audit
- [ ] Secure download

## Этап 9 — Pilot

- [ ] Tenant configured
- [ ] Landing embedded
- [ ] Analytics events
- [ ] Error monitoring
- [ ] Cost dashboard
- [ ] 20 controlled sessions
- [ ] 5 real prospects
- [ ] Interview notes
- [ ] Funnel report
- [ ] Go/no-go decision

## UI Quality Gate — для каждого клиентского среза

- [ ] Применён `mebelflow-conversational-interface`
- [ ] Определена одна пользовательская задача
- [ ] Один основной CTA
- [ ] Проверен flow INPUT → TRANSCRIPT → INTERPRETATION → VALIDATION → APPLY
- [ ] Undo/recovery доступны
- [ ] Mobile 360×800
- [ ] Touch targets ≥44px
- [ ] Keyboard
- [ ] Screen reader smoke
- [ ] Contrast AA
- [ ] Reduced motion
- [ ] Slow network
- [ ] Error/empty/offline
- [ ] AI transparency
- [ ] Preliminary price disclaimer
- [ ] Visual regression
- [ ] UI review report сохранён
