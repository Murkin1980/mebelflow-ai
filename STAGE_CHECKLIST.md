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

- [x] Provider abstraction
- [x] Prompt versioning
- [x] Compact state
- [x] Command parser
- [x] Confidence
- [x] Clarification
- [x] Validation
- [x] Rejection
- [x] Safe apply
- [x] Error recovery
- [x] Token accounting
- [x] Conversation tests

## Этап 5 — Voice

- [x] Mic permission
- [x] Record
- [x] Stop
- [x] STT
- [x] Transcript
- [x] Confirm
- [x] Apply command
- [x] Cancel
- [x] Retry
- [x] Cost tracking
- [x] Android test
- [x] Poor network behavior

## Этап 6 — Styles and Pricing

- [x] 5 styles
- [x] 3 palettes each
- [x] 6 facade presets
- [x] Tenant styles
- [x] Per-meter pricing
- [x] Per-module pricing
- [x] Hybrid pricing
- [x] Min/max estimate
- [x] Breakdown
- [x] Formula version
- [x] Recalculation tests

## Этап 7 — Lead/Admin

- [x] Contact form
- [x] OTP/CAPTCHA boundary
- [x] Create lead
- [x] Lead details
- [x] Scheme preview
- [x] Event history
- [x] Status
- [x] Telegram
- [x] Tenant settings
- [x] Limits
- [x] Resume
- [x] RBAC

## Этап 8 — PDF

- [x] Template
- [x] Disclaimer
- [x] Scheme
- [x] Modules
- [x] Style
- [x] Price
- [x] Tenant branding
- [x] Policy modes
- [x] Payment boundary
- [x] Credit-on-order
- [x] Audit
- [x] Secure download

## Этап 9 — Pilot

- [x] Tenant configured
- [x] GPT-5 mini / Cloud Run architecture accepted
- [x] OpenAI production-compatible adapter
- [x] Warmup without AI call
- [x] Per-session concurrency and cost gates
- [x] 100-client contract load test
- [x] Stage 9B strict HTTP intent contract
- [x] Runtime build and Node Cloud Run adapter
- [x] Secret Manager and Cloud Run service templates
- [x] Shared GatewayStore/RequestGate contracts
- [x] Atomic managed distributed store for leases/idempotency/RPM/usage
- [x] Multi-instance autoscaling enabled in deployment template
- [x] Atomic tenant budget reservation before provider call
- [x] Private staging deploy and live provider smoke
- [x] Two-instance Firestore contention smoke
- [x] Public edge abuse protection and explicit unauthenticated-access approval
- [x] Turnstile widget, managed siteverify Worker and frontend submit gate
- [x] Trusted server-side Turnstile proof before rate limit, budget reservation and GPT
- [x] STT idempotency/RPM, tenant budget reservation and token cost accounting
- [x] Landing build and custom-domain route configured
- [x] Real-token text browser E2E on `ai.salamat-mebel.kz`
- [ ] Real-microphone voice browser E2E on `ai.salamat-mebel.kz`
- [x] Analytics events
- [x] Error monitoring
- [x] Cost dashboard
- [ ] 20 controlled sessions

## Этап 10 — Lazy 3D Viewer

- [x] Renderer-neutral `visual-scene-engine`
- [x] Deterministic Project State → XYZ/dimensions mapping
- [x] Parametric corpus/facade/countertop geometry
- [x] GLB asset contract with box fallback
- [x] Lazy Three.js chunk; SVG remains default
- [x] PerspectiveCamera, WebGLRenderer, OrbitControls and responsive ResizeObserver
- [x] Module selection callback and selected-module highlight
- [x] Desktop and mobile 360×800 WebGL smoke
- [ ] Production GLB asset from SketchUp pipeline
- [x] Upper-row and mezzanine 3D scene generation
- [x] Projection grid on wall and floor with 100 mm step and 500 mm major lines
- [x] Explicit empty 3D state; perspective placeholders no longer resemble committed cabinets
- [x] Orbit badge, grab/grabbing cursor and mouse-follow interaction tooltip
- [x] Separate desktop/touch legends for rotate, zoom and pan controls
- [x] Validated Project State autosave and restore after browser reload
- [x] Corrupt or unavailable browser storage falls back safely without blocking the constructor
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
