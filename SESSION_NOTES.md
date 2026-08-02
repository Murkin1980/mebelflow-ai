# SESSION NOTES — MebelFlow AI

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
