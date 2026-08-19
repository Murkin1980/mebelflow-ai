# SESSION NOTES — MebelFlow AI

## 2026-08-09 — 3D orbit and camera-control hints

- Cloudflare Worker `mebelflow-ai-landing` deployed as version `1093b572-30bc-4f3d-9eed-01739ef5e953`; production assets reference the new viewer chunk and contain orbit badge, desktop/touch legends, cursor tooltip and grab/grabbing styles.
- Added a persistent orbit badge, `grab`/`grabbing` cursor states and a mouse-follow tooltip inside the 3D canvas.
- Added compact SVG-icon legends for rotate, zoom and pan; desktop uses mouse-specific wording while mobile uses pinch/two-finger wording.
- The cursor tooltip is hidden from assistive technology, while the persistent legend is exposed as a labelled control group and the canvas label explains all gestures.
- Right-button pan and drag no longer trigger accidental module selection; selection requires a primary-button movement of at most 5 CSS px.
- Router `opencode-go/deepseek-v4-flash` reviewed the interaction pattern; Playwright verified desktop hover/grabbing/right-pan, mobile 360×800, touch wording, reduced motion and no horizontal overflow.

## 2026-08-09 — Empty 3D clarity and 100 mm projection grid

- Cloudflare Worker `mebelflow-ai-landing` deployed as version `1697148c-e8e1-4f8e-a91e-93b81fa85c61`; production `app.js` references the new viewer chunk and the deployed chunk contains the `projection-grid-100mm` and empty-note implementation.
- Production screenshots showed a truthful empty 3D scene while Perspective rendered five generated 600 mm placeholders; metrics (`3000 мм` free) confirmed that Project State contained no modules.
- Router `opencode-go/deepseek-v4-flash` traced the mismatch to `renderPerspective`; its repeated placeholder cabinets were replaced by one dashed `Свободное место` volume.
- Added wall/floor projection grids with 100 mm minor spacing and emphasized 500 mm lines, plus an explicit empty-state note explaining that perspective free sections are hints only.
- Empty-room camera framing now shows the whole coordinate context; the note disappears automatically when real modules enter Project State.
- Playwright verified empty desktop/mobile and populated WebGL scenes with no horizontal overflow; evidence is stored in `output/playwright/stage10-empty-grid-*.png` and `stage10-grid-populated-desktop.png`.

## 2026-08-09 — Stage 10 upper row and mezzanines

- Cloudflare Worker `mebelflow-ai-landing` deployed as version `b15d1495-e25f-4e0e-a772-8257276e4025`; production page, `app.js` and lazy viewer chunk return `200` and the chunk contains the new upper-row/camera logic.
- Router `opencode-go/deepseek-v4-flash` classified the specification and traced Project State/SVG geometry; strong-model review caught a 142 mm vertical-datum mismatch before release.
- `visual-scene-engine` now derives upper cabinets and mezzanines from lower widths, excludes refrigerators/tall units, keeps stable source-module selection and uses distinct mezzanine facades.
- Upper-row placement follows the visible countertop top plus apron height, matching the existing SVG scene while Layout Engine remains the authority for available-height validation.
- Three.js camera framing now derives its target and distance from actual scene content height, keeping tall units, upper cabinets and mezzanines visible.
- Added upper-row alignment, mezzanine placement, exclusion and disabled/null-state regressions; Playwright desktop/mobile WebGL evidence saved in `output/playwright/stage10-upper-*.png`.

## 2026-08-08 — Stage 10 lazy Three.js viewer

- Cloudflare Worker `mebelflow-ai-landing` deployed as version `98a27e4c-295b-47a8-bf10-da9726dea2c2` on `https://ai.salamat-mebel.kz/`.

- По присланной спецификации и explicit owner decision принят ADR-005: SVG остаётся default/fallback, 3D добавлен как optional Stage 10 mode.
- Через Router `opencode-go/deepseek-v4-flash` выполнены декомпозиция ТЗ, code inventory и классификация конфликтов с прежним SVG-first scope.
- Добавлен чистый TS `visual-scene-engine`: millimetre XYZ mapping, corpus/facade/countertop parts, style colors, `metadata.visualAssetId` + registry GLB contract и box fallback.
- Добавлен vanilla Three.js viewer с lazy chunk, OrbitControls, responsive resize containment, module selection, GLB timeout/fallback и graceful WebGL error state.
- Первый browser smoke обнаружил и помог исправить ResizeObserver feedback loop; итоговые размеры стабильны.
- Проверки: 21 test files, 252/252 tests; widget build emits `app.js` ~377 KB и optional Three.js chunk ~630 KB.
- Playwright evidence: `output/playwright/stage10-3d-desktop.png`, `stage10-3d-mobile.png`, `stage10-3d-mobile-orbit.png`; mobile horizontal overflow отсутствует (`scrollWidth=345`, `clientWidth=345`).

## 2026-08-08 — Voice sink movement regression

- По пользовательскому real-microphone smoke найден разрыв между allowed move commands и production prompt: AI не получал shape `payload.id`, правило разрешения «мойка» через `projectSummary.modules` и различие one-step/edge movement.
- Для `MOVE_LEFT`, `MOVE_RIGHT` и `MOVE_TO_EDGE` добавлен явный semantic/output contract с точным копированием существующего module id.
- Silent no-op на краю заменён понятной `LayoutError`, поэтому UI больше не сообщает ложное «Схема обновлена» без изменения геометрии.
- Добавлены prompt-contract и edge no-op регрессии; `npm run check` — 20 files, 245/245 tests; runtime build проходит.
- Cloud Build `166cf89f-dcd8-44db-804b-8235e134fa1e` собрал image `sink-move-20260808-1`; Cloud Run revision `mebelflow-api-staging-00012-j4b` обслуживает 100% traffic.
- Post-deploy warmup вернул `200` и `billableAiCalls: 0`; окончательный real-microphone regression smoke оставлен пользователю.

## 2026-08-08 — Stage 9F production smoke and security closure

### Выполнено

- Turnstile widget разрешает `ai.salamat-mebel.kz`, `salamat-mebel.kz`, `localhost` и `127.0.0.1`.
- После непреднамеренного появления прежнего Turnstile secret в локальном tool output секрет ротирован через официальный Cloudflare API с grace period; новый secret передан существующему Spin Worker только через stdin и не записывался в репозиторий или файлы.
- Cloud Run service `mebelflow-api-staging` развёрнут revision `mebelflow-api-staging-00011-t2b` из image `stage9g-20260808-1`.
- Cloudflare landing `mebelflow-ai-landing` финально развёрнут version `0321cda9-6eca-4f22-aaa7-cfcbb8a3383c` на `https://ai.salamat-mebel.kz/`.
- Real-token browser E2E до и после ротации прошёл: Turnstile proof принят, команды `стена 3000 мм` и `стена 3100 мм` применены, схема обновилась.
- Негативный smoke прошёл без AI-вызовов: warmup `200`, dummy Turnstile `403`, foreign origin `403`.
- Firestore после первого live smoke: tenant spend `4.2 KZT`, reservation `0`; фактическая стоимость зафиксирована после commit reservation.

### Проверки и handoff

- `npm run check` — 20 test files, 244/244 tests; runtime и widget builds проходят.
- Текстовый production gate закрыт. Голосовой E2E остаётся ручным gate: нужен настоящий микрофон/голос и визуальная проверка transcript, синтетически этот шаг не имитируется.
- Следующий этап проекта: 20 controlled sessions по `docs/pilot/PILOT_RUNBOOK.md`, затем 5 real prospects, интервью, funnel report и решение GO/NO_GO.

## 2026-08-08 — Pilot landing pre-deploy acceptance

### Выполнено

- Проведена read-only инвентаризация текущего Stage 9 через Router route `opencode-go/deepseek-v4-flash`; внешнее web-исследование не потребовалось.
- Widget TypeScript включён в основной `tsc --noEmit`.
- Исправлен горизонтальный overflow landing на Android 360×800.
- Исправлен donor fallback tenant в API runtime: `salamat-mebel-pilot`.
- Синхронизированы Stage 9 handoff-документы и создан UI review.

### Проверки

- `npm run check` — 19 test files, 235/235 tests.
- `npm run build:runtime` — успешно.
- `npm run build:widget` — успешно.
- Playwright 360×800: `scrollWidth=360`, `clientWidth=360`.

### Ограничения и следующий безопасный handoff

- Remote deploy и live-token вызовы не выполнялись.
- Перед полевым пилотом требуется добавить `ai.salamat-mebel.kz` в Turnstile hostnames, синхронизировать Cloud Run origin/expected hostname и выполнить real-token browser E2E.
- Реализован отдельный `TranscriptionGateway`: строгий request/MIME/audio contract, Turnstile, общий tenant RPM/idempotency, консервативная budget reservation, refund при ошибке и фактическое token cost accounting.
- Зафиксирован server-owned pricing snapshot `gpt-4o-mini-transcribe-2026-08-08`: $1.25/1M input tokens и $5/1M output tokens; источник — официальные OpenAI model/API docs.
- Widget передаёт tenant/session attribution; STT ledger использует отдельный `stt_` session namespace и общий tenant spend.
- Подготовлен Cloud Run template для origin/hostname `ai.salamat-mebel.kz`.
- `npm run check` — 20 test files, 244/244 tests; runtime и widget builds успешны.
- Следующий безопасный handoff: применить hostname в Turnstile, развернуть новую revision, выполнить real-token browser smoke и сверить Firestore cost ledger. Remote changes в этой сессии не выполнялись.

## 2026-08-02 — Формирование продукта

### Решения

- Новый проект создаётся отдельно.
- Рабочее название: MebelFlow AI.
- Репозиторий: `mebelflow-ai`.
- Основная ценность: разговорная квалификация и вовлечение клиента.
- Отказ от полноценного 3D и CAD-экспорта.
- Отказ от плагинов SketchUp и PRO100 в MVP.
- Первая категория: прямая кухня.
- Визуализация: SVG.
- Голос и текст преобразуются в строгие команды.
- Геометрия выполняется детерминированным движком.
- Pascal рассматривается только как state/core foundation.
- Выбран вариант B: Pascal-style Core + собственный SVG Renderer.
- Вводится SceneStoreAdapter, чтобы не зависеть от Pascal напрямую.
- PDF может быть бесплатным, платным или выдаваться после заявки.
- Цена предварительная и задаётся диапазоном.
- Мебельщик настраивает правила и лимиты.

### Репозитории-доноры

- `furniture-intake-agent`
- `furniture-orders-mvp`
- `furniture-configurator`
- `interactive-kp`
- `Furniture-web-platform-V2`

### Следующий шаг

Выполнить Pascal Core spike и принять решение:

- use;
- adapt;
- reject.

## 2026-08-02 — Новый интерфейсный skill

### Решение

- Рассмотрены специализированные frontend/UI skills.
- Основой выбран Microsoft `frontend-design-review`.
- Создан локальный адаптированный skill `mebelflow-conversational-interface`.
- Зафиксировано дизайн-направление «Спокойная мастерская».
- Введены три review pillars:
  - Frictionless;
  - Quality Craft;
  - Trustworthy.
- UI review стал обязательным gate.
- Для voice-команд закреплён цикл:
  `INPUT → TRANSCRIPT → INTERPRETATION → VALIDATION → APPLY → EXPLAIN → NEXT`.
- Закреплены WCAG 2.2 AA, mobile 360×800, touch targets 44px и прозрачность AI.

## 2026-08-02 — Старт Stage 0/1

### Выполнено

- Создан минимальный TypeScript-проект с Zod, Vitest и строгой проверкой типов.
- Выполнен spike `@pascal-app/core@0.9.2`.
- Решение по Pascal: `ADAPT`, без runtime-зависимости в MVP.
- Созданы Project State v1, Command Schema v1 и `SceneStoreAdapter`.
- Реализованы pure reducer, domain validation, idempotency, undo/redo.
- 39 unit-тестов проходят.

### Ограничения

- Android smoke Pascal Core отложен до появления browser harness.
- State migrations и corrupted-state recovery ещё не реализованы.

## 2026-08-02 — Закрытие Stage 0/1

### Выполнено

- Добавлены module catalog v1 и строгие правила ширин техники.
- Добавлена нормализация `mm/cm/m` в целые миллиметры.
- Добавлены migration и recovery повреждённого состояния с предупреждением.
- Idempotency расширена на `UNDO/REDO` и пустые команды.
- Реализован in-memory `SceneStoreAdapter`: CRUD, metadata, undo/redo, serialization.
- Настроен GitHub Actions CI.
- Локальный `mebelflow-conversational-interface` валидирован, дополнен `agents/openai.yaml` и установлен в Codex skills.

### Проверки

- `npm ci` — успешно, 0 vulnerabilities.
- `npm run check` — успешно.
- 74/74 unit-теста — успешно.
- Browser bundle core — успешно; browser globals/WebGPU отсутствуют.

### Решение

Stage 0 и Stage 1 приняты по самопроверке. Следующий безопасный шаг — Stage 2 Layout Engine без UI и AI.

## 2026-08-02 — Stage 2 Layout Engine

### Выполнено

- Расширен белый список команд: `INSERT_BEFORE`, `MOVE_LEFT`, `MOVE_RIGHT`, верхний ряд и антресоли.
- Реализован pure Layout Engine для прямой стены.
- Добавлены расчёт остатка, нормализация позиций, правила доборов и техники.
- Добавлены предупреждения и правила верхнего ряда.
- Layout Engine интегрирован с общей history, idempotency и undo/redo.
- Добавлены unit и property-based тесты.
- GitHub Actions обновлён до `checkout@v5` и `setup-node@v5`.

### Проверки

- `npm run check` — успешно.
- 115/115 тестов — успешно.
- 200 сгенерированных property cases — успешно.
- Scope UI/AI/SVG/backend не расширен.

### Следующий безопасный шаг

Stage 3 — SVG Renderer с обязательным локальным UI skill и визуальной приёмкой.

## 2026-08-02 — Stage 3 SVG Renderer

### Выполнено

- Реализован pure responsive SVG front-view renderer.
- Добавлены стена, пол, нижний/верхний ряд, антресоли, столешница, фартук, размеры, техника, остаток, selection и warnings.
- Добавлены ARIA title/description и описания модулей.
- Добавлены SVG data URL и browser PNG export.
- Создан изолированный visual-review demo с design tokens и disclaimer.
- Создан обязательный UI review по `mebelflow-conversational-interface`.

### Проверки

- 131/131 тест — успешно.
- SVG snapshot — успешно.
- Mobile 360×800 и desktop screenshots — сохранены.
- Keyboard, focus-visible, reduced motion, offline и screen-reader snapshot — успешно.
- PNG browser smoke — `image/png`, 28 002 bytes.
- Console — 0 ошибок.

### Следующий безопасный шаг

Stage 4 — Text AI только через fake provider и строгий command contract до подключения реального API.

## 2026-08-02 — Stage 4 Text AI Contract

### Выполнено

- Созданы `IntentProvider`, `FakeIntentProvider` и `IntentSession`.
- Prompt v1 содержит явный белый список команд и защитные ограничения.
- Compact state передаёт только необходимые размеры, IDs, остаток и stage.
- Parser принимает канонический top-level формат TECH_SPEC и временный nested fake format.
- Confidence ниже 0.9 требует подтверждения; `CLARIFY` ограничен тремя вариантами.
- Safe apply выполняется только через Layout Engine и сохраняет state при ошибке.
- Token usage валидируется и автоматически накапливается.
- Добавлен сквозной conversation replay с undo.

### Проверки

- 158/158 тестов — успешно.
- Реальные AI/API вызовы — отсутствуют.
- Секреты и платные зависимости — отсутствуют.

### Следующий безопасный шаг

Stage 5 Voice через fake STT provider до подключения реального сервиса.

## 2026-08-02 — Stage 5 Voice

### Выполнено

- Созданы `SttProvider`, `FakeSttProvider`, `VoiceSession` и `VoiceCostLedger`.
- Реализованы явные permission, record, stop и состояния voice flow.
- Транскрипт видим и редактируем; команда применяется только после подтверждения.
- Добавлены cancel, retry, offline recovery и постоянная текстовая альтернатива.
- Повторная отправка записи возможна только после явного действия пользователя.
- Добавлен Android view-model contract с одним CTA, aria-live status и touch target 44 px.

### Проверки

- `npm run check` — успешно.
- 168/168 тестов — успешно.
- Реальные STT/API вызовы и секреты отсутствуют.

### Следующий безопасный шаг

Stage 6 — Styles and Pricing с tenant-controlled preset catalog и детерминированными формулами.

## 2026-08-02 — Stage 6 Styles and Pricing

### Выполнено

- Добавлены 5 стилей, 15 палитр и 6 фасадных пресетов.
- Tenant filter ограничивает доступные стили; несовместимые палитры и фасады отклоняются.
- Реализованы per-meter, per-module и hybrid pricing strategies.
- Результат содержит min/max KZT, breakdown, uncertainty reasons и formula version.
- Цена всегда отображается как предварительная с обязательным disclaimer.
- Добавлены recalculation tests для ширины, модулей, верхнего ряда и фасадного коэффициента.

### Проверки

- `npm run check` — успешно.
- 180/180 тестов — успешно.
- AI не участвует в арифметике цены и не может менять tenant pricing.

### Следующий безопасный шаг

Stage 7 — Lead and Admin.

## 2026-08-02 — Stage 7 Lead and Admin

### Выполнено

- Добавлены contact schema и provider boundaries для OTP/CAPTCHA.
- Реализовано идемпотентное создание лида со снимком Project State.
- Lead details содержат append-only события, статусы и комментарии.
- Telegram adapter не блокирует сохранение лида при ошибке уведомления.
- Tenant settings валидируют бренд, стили, размеры, disclaimer и hard limits.
- Добавлены opaque resume tokens и RBAC для owner/admin/manager/viewer/public.

### Проверки

- `npm run check` — успешно.
- 190/190 тестов — успешно.
- Реальные внешние отправки и секреты отсутствуют.

### Следующий безопасный шаг

Stage 8 — PDF.

## 2026-08-02 — Stage 8 PDF

### Выполнено

- Создана document model для tenant-branded предварительного ТЗ.
- Включены контакт, SVG-схема, размеры, модули, стиль, цена, warnings и disclaimer.
- Реализованы free/after_contact/after_order/paid/credited_to_order policies.
- Payment provider остаётся безопасной внешней границей; credit-on-order учитывается отдельно.
- Secure download grants tenant-bound, ограничены временем, отзываются и пишут audit events.
- Создан и визуально принят двухстраничный PDF sample.

### Проверки

- `npm run check` — успешно.
- 197/197 тестов — успешно.
- PDF: A4, 2 страницы, кириллица/таблицы/footer/disclaimer визуально PASS.
- Реальные payment/storage вызовы и секреты отсутствуют.

### Следующий безопасный шаг

Stage 9 — Pilot.

## 2026-08-02 — Stage 9 Pilot Readiness

### Выполнено

- Подготовлены pilot tenant config и origin-allowlisted embed contract.
- Добавлены privacy-safe analytics events и sanitized error codes.
- Реализован cost dashboard с tenant budget hard stop.
- Добавлены controlled/real session registry и interview-note validation.
- Реализованы funnel formulas и GO/NO_GO gate с обязательной полной выборкой.
- Создан `docs/pilot/PILOT_RUNBOOK.md`.

### Проверки

- `npm run check` — успешно.
- 204/204 теста — успешно.
- При пустой выборке решение строго `WAITING_FOR_DATA`.

### Не завершено внешне

- Production landing embed.
- 20 controlled sessions.
- 5 real prospects и 5 интервью.
- Фактический funnel report и GO/NO_GO.

### Следующий безопасный шаг

Развернуть adapters на pilot environment и начать контролируемые сессии по runbook.

## 2026-08-02 — Stage 9A GPT-5 mini / Cloud Run Gateway

### Решения

- Основная intent-модель зафиксирована как GPT-5 mini.
- Self-hosted Qwen/GPU отложены до подтверждённого объёма и quality benchmark.
- Google Cloud Run используется как центральный MebelFlow Gateway без GPU.
- Landing warmup не создаёт AI-сессию, не включает микрофон и не вызывает OpenAI.
- Голос начинается только по явному действию; основной дешёвый flow — STT → видимый транскрипт → GPT-5 mini.
- Принят ADR-004 и подготовлено техническое ТЗ Stage 9A.

### Выполнено

- Добавлен `OpenAiIntentProvider` для Responses API через injected network sender.
- Добавлены compact request, versioned GPT-5 mini pricing и cached-token accounting.
- Добавлен `AiGateway` с warmup, одним in-flight запросом на session, лимитами calls/tokens, tenant budget и global concurrency.
- Добавлен contract load test для 100 одновременных независимых клиентов.

### Проверки

- `npm run check` — успешно.
- 16 test files, 211/211 тестов — успешно.
- Реальные API-вызовы, секреты и изменения Google Cloud отсутствуют.

### Ограничения

- Текущие locks и ledger in-memory; перед несколькими Cloud Run instances нужен distributed adapter.
- HTTP routing, Secret Manager, staging deploy и реальные STT/OpenAI smoke остаются Stage 9B.

### Следующий безопасный шаг

Stage 9B — HTTP Cloud Run adapter, distributed idempotency/rate limiting и persistent cost ledger без изменения доменной логики.

## 2026-08-02 — Stage 9B HTTP / Cloud Run pilot adapter

### Выполнено

- Добавлен strict HTTP handler для `/warmup` и `/v1/intent`.
- Prompt, GPT-5 mini model и pricing исключены из client input.
- Добавлены tenant origin allowlist, idempotency/RPM gate и повторная Zod-проверка provider output.
- `GatewayStore` вынесен как общий async contract для lock и usage/cost state.
- Добавлены runtime TypeScript build, Node HTTP server, multi-stage Dockerfile и Cloud Run template с Secret Manager reference.
- Cloud Run template ограничен `maxScale: 1` до managed distributed store; concurrency 100 покрывает pilot spike одним I/O-bound instance.

### Проверки

- `npm run check` — успешно.
- `npm run build:runtime` — успешно вне ограниченного sandbox Windows.
- Warmup HTTP smoke — `200`, `{status: ready, billableAiCalls: 0}`.
- Docker image build не запускался: Docker отсутствует в текущем окружении.
- Live OpenAI call не выполнялся; временный environment key не был прочитан или выведен.

### Следующий безопасный шаг

Stage 9C реализовал Firestore-backed lease locks, idempotency, RPM и usage/cost ledgers. Cloud Run template допускает `maxScale: 20`. Следующий шаг — atomic tenant-budget reservation, staging deploy, TTL setup и live provider smoke.

## 2026-08-02 — Stage 9C Firestore coordination

- Добавлен `FirestoreCoordinationStore` на Native Firestore transactions.
- Boolean lock заменён lease token: старый запрос не может снять новую блокировку после TTL.
- Node runtime использует единое хранилище для gateway usage, idempotency и RPM.
- Document IDs хешируются; для ephemeral records добавлено поле `ttlAt`.
- Template масштабируется до 20 instances.
- Добавлен reservation ledger: до provider call атомарно резервируется консервативный максимум, после ответа резерв заменяется фактической стоимостью.
- Provider failure возвращает резерв, а abandoned reservation очищается при следующей транзакции после 120 секунд.
- Следующий шаг — staging deploy, Firestore TTL setup и two-instance/live provider smoke.
- Подготовлены read-only prerequisite checker и Stage 9D staging runbook.
- Локальная проверка установила, что `gcloud` отсутствует в PATH; внешние Google Cloud ресурсы не создавались и не изменялись.

## 2026-08-02 — Stage 9D private Google Cloud staging

- Portable Google Cloud CLI 577.0.0 установлен отдельно от репозитория; официальный SHA-256 совпал.
- Создан project `mebelflow-ai-pilot`, подключён billing и включены минимальные APIs.
- Firestore Native `(default)` создан в `europe-central2` с delete protection; Artifact Registry `mebelflow` размещён там же.
- Runtime identity `mebelflow-api` получил `roles/datastore.user` и accessor только для `mebelflow-openai-api-key`.
- Невалидная secret version 1 отключена; user-created version 2 включена. Значение ключа не читалось и не выводилось.
- Cloud Build images `stage9d-20260802-1` и исправленный `stage9d-20260802-2` собраны успешно.
- Public unauthenticated deploy был отклонён как риск; staging развёрнут приватно revision `00003-z7c`, min 0, max 20.
- Warmup smoke: HTTP 200, `billableAiCalls=0`.
- Первый live smoke выявил слишком общий structured-output schema и был безопасно отклонён без изменения state.
- После исправления contract live GPT-5 mini smoke вернул `SET_WALL_WIDTH=3000`; 407 input, 81 output token, 0.12 KZT.
- Следующий шаг: two-instance contention smoke, затем edge abuse protection до публичного доступа.
- TTL policies для sessions, requests и rate windows подтверждены как `ACTIVE`.
- Two-instance smoke временно использовал min/max 2 и concurrency 1: получены ровно `200 OK` и `409 SESSION_REQUEST_IN_PROGRESS`.
- После smoke сервис возвращён на экономичные параметры min 0, max 20, concurrency 100; active revision `00005-fqh`.
- Следующий шаг: edge abuse protection до публичного доступа и landing integration.

## 2026-08-02 — Turnstile Spin foundation

- Создан managed widget `MebelFlow AI Spin` для `localhost`, `127.0.0.1`, `salamat-mebel.kz`.
- Public sitekey: `0x4AAAAAAEEX-k_-HA_wm4nv`; widget secret сохранён только как Worker secret binding.
- Развёрнут стандартный Spin Worker `turnstile-siteverify-mebelflow-ai`; CORS ограничен `https://salamat-mebel.kz`.
- Health, dummy rejection, managed metadata, hostname registration и CORS validation — PASS.
- `apps/widget/src/turnstile.ts` gates существующий AI submit callback только после `success=true`.
- 19 test files, 230/230 tests проходят.
- Turnstile Spin bundle сохранён в `.claude/skills/turnstile-spin`.
- Ограничение: frontend gate нельзя считать server authorization; Cloud Run остаётся private до trusted edge proof/proxy.
## 2026-08-02 — Stage 9E server-side Turnstile enforcement

- Одноразовый Turnstile token больше не проверяется браузером: widget передаёт его Cloud Run API.
- API вызывает стандартный Spin Worker и требует `success=true`, hostname `salamat-mebel.kz` и action `turnstile-spin-v1`.
- Проверка выполняется до idempotency/RPM gate, резервирования бюджета и вызова GPT; сбои закрывают доступ с 503.
- Cloud Build image `stage9e-20260802-1` собран успешно.
- Приватный Cloud Run revision `mebelflow-api-staging-00006-6xw` обслуживает 100% staging-трафика; min 0, max 20, concurrency 100.
- Authenticated smoke: warmup `200` и `billableAiCalls=0`; отсутствующий token — `400`; dummy token — `403 TURNSTILE_REJECTED`.
- 19 test files, 235/235 tests и runtime build проходят.
- Публичный unauthenticated доступ по-прежнему не включён; следующий шаг — встроить widget на разрешённый landing/subdomain и провести браузерный end-to-end smoke с настоящим token.
## 2026-08-02 — Public invocation enabled

- Владелец проекта явно разрешил публичный вызов `mebelflow-api-staging`.
- IAM binding: `allUsers` → `roles/run.invoker`; остальные проектные и secret-права не расширялись.
- Публичный URL: `https://mebelflow-api-staging-1013284205128.europe-central2.run.app`.
- Smoke без Google identity token: `/warmup` вернул `200` и `billableAiCalls=0`.
- `POST /v1/intent` с разрешённым origin и dummy Turnstile вернул `403 TURNSTILE_REJECTED`.
- Тот же маршрут с `https://evil.example` вернул `403 ORIGIN_NOT_ALLOWED`.
- Реальный browser token ещё не проверен end-to-end: для этого требуется встроить widget на `salamat-mebel.kz` или согласованный поддомен.
## 2026-08-02 — MebelFlow AI subdomain reserved

- В Cloudflare создана proxied CNAME-запись `ai.salamat-mebel.kz` → `salamat-mebel.kz`, TTL Auto.
- Внешняя DNS-проверка вернула адреса Cloudflare; HTTPS отвечает `200`.
- Пока поддомен показывает существующий сайт и его маршрут авторизации; MebelFlow widget ещё не развёрнут на этом hostname.
- Перед browser E2E необходимо добавить `ai.salamat-mebel.kz` в Turnstile widget hostnames, обновить Cloud Run allowed origin/expected hostname и опубликовать landing.

## 2026-08-12 — Project State persistence

- Router research through `opencode-go/deepseek-v4-flash` confirmed that the widget always created a fresh Project State on reload; server storage only coordinates requests and budgets.
- Added tenant-scoped browser persistence for `history.present` only. Stored data is parsed through `FurnitureProjectStateSchema`; transient conversation, audio, Turnstile tokens, API responses and undo history are not persisted.
- Every applied command and undo now saves the validated state. Storage denial or quota failure does not block the constructor and is reported in the UI.
- Local browser smoke restored a 3000 mm project with sink and drawers after reload and showed 1800 mm remaining. Corrupt JSON was removed and the constructor safely returned to the empty state.
- Cloudflare deployment `0e3c0522-e2af-4e5e-a086-66d70b4ca0ff` is live on `ai.salamat-mebel.kz`; page and bundle returned 200 and production browser smoke restored the same state. The test-only localStorage entry was removed afterwards.
- Next bounded slice: fix voice auto-submit so a successful transcription does not stall waiting for a second Turnstile success event; keep that change separate from persistence.

## 2026-08-12 — Voice auto-submit reliability

- Read-only Router audits used `opencode-go/deepseek-v4-flash`; no external research was needed because the repository contained the full token lifecycle.
- Confirmed that the STT endpoint consumes the first one-time Turnstile token and intent correctly requires a fresh token. The defect was unbounded waiting on the second success event plus a sticky shared boolean.
- Added a single-fire coordinator with a 12-second timeout, transcript matching, cancellation and manual recovery. Repeated/late events cannot submit again.
- The microphone and text field are temporarily disabled during server transcription, preventing overlapping recordings and manual-submit races; the recognized text remains available afterwards.
- Verification: 23 test files, 265 tests, widget build, desktop/mobile browser smoke and accessibility contract. Real-microphone production E2E remains pending.
- Cloudflare version `232f81be-4fd8-4d97-9472-6dc20ae9a121` is live on `ai.salamat-mebel.kz`; page and bundle returned 200 and the production bundle exactly matched the local verified build.

## 2026-08-12 — Single-challenge voice command

- User testing showed that the bounded two-token flow still displayed a second Cloudflare challenge after transcription.
- With explicit approval to change the production auth boundary, added `/v1/voice`: it verifies the browser Turnstile token once, then runs non-public preverified STT and intent handlers inside the same server request.
- Origin allowlist, request gates, idempotency namespaces, STT/intent budget reservations and strict intent validation remain active. No public route accepts the internal sentinel.
- Intent failure returns the recognized transcript so the user can recover without repeating the recording.
- Router audit used `opencode-go/deepseek-v4-flash`; strong-model architecture and self-review retained the server-side security boundary.
- Cloud Build `97b80b6b-9afb-4c16-b798-3f3fa8cd6591` produced image `single-voice-20260812-1`; Cloud Run revision `mebelflow-api-staging-00013-mmq` serves 100% traffic.
- Non-billable production smoke: `/warmup` returned 200 with `billableAiCalls: 0`; invalid `/v1/voice` failed closed with 400.
- Cloudflare widget version `f7117bc5-adb2-44e2-a57a-f5964c252d7b` is live. Production bundle exactly matches the verified local build, contains `/v1/voice`, and no longer contains `/v1/transcribe` or the second-challenge waiting copy.

## 2026-08-12 — Lazy Turnstile refresh

- User testing confirmed a remaining post-command Cloudflare panel. The combined endpoint was correct; the client still called `turnstile.reset()` unconditionally in both request `finally` blocks.
- Used tokens are now cleared without resetting the widget. A new challenge is requested only when the user next types a command, chooses an example or presses the microphone without a token.
- A refresh guard prevents repeated reset calls while typing. Expiry also clears state without immediately reopening the panel.
- Verification: 23 test files, 268 tests and widget build pass.
- Cloudflare version `9386ec91-138d-4582-9452-1abcf4dec058` is live; production `app.js` exactly matches the verified local bundle and no longer contains the post-transcription second-challenge flow.
