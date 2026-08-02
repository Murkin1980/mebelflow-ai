# PROJECT PROGRESS — MebelFlow AI

Обновлять после каждого завершённого рабочего этапа.

## Общий статус

```text
Идея и позиционирование     ██████████ 100%
Аудит прошлых проектов      ██████████ 100%
Фундамент                   ██████████ 100%
Архитектура                 ██████████ 100%
Pascal Core spike           ██████████ 100%
Domain Core                 ██████████ 100%
Layout Engine               ██████████ 100%
SVG Renderer                ██████████ 100%
Text AI                     ██████████ 100%
Voice                       ██████████ 100%
Pricing and Styles          ██████████ 100%
Admin and Lead              ██████████ 100%
PDF                         ██████████ 100%
Pilot                       ████░░░░░░  40%
```

## Current phase

**Stage 0/1/2/3/4/5/6/7/8 приняты. Stage 9 readiness готов; требуется полевой Pilot**

## Completed

- [x] Сформулирована новая упрощённая идея
- [x] Отказались от CAD-интеграций
- [x] Выбран разговорный UX
- [x] Выбран SVG-first
- [x] Выбран вариант B
- [x] Проведён аудит существующих репозиториев
- [x] Определены донорские модули
- [x] Подготовлен комплект проектной документации
- [x] Создан TypeScript-проект и настроены проверки
- [x] Pascal Core 0.9.2 проверен; принято решение ADAPT
- [x] Создан независимый `SceneStoreAdapter`
- [x] Созданы Project State v1 и Command Schema v1
- [x] Реализован pure deterministic reducer, idempotency и undo/redo
- [x] Проходят 39 unit-тестов
- [x] Добавлены module catalog и unit normalization
- [x] Добавлены state migration и corrupted-state recovery
- [x] Реализован и проверен in-memory `SceneStoreAdapter`
- [x] Настроен GitHub Actions CI
- [x] Чистая установка и 74 unit-теста проходят
- [x] Локальный UI skill валиден и установлен в Codex
- [x] Реализован deterministic Layout Engine прямой кухни
- [x] Добавлены операции ряда, правила доборов и техники
- [x] Реализованы верхний ряд и антресоли
- [x] Общая history поддерживает Stage 2, undo/redo и idempotency
- [x] Проходят 115 unit/property-based тестов
- [x] Реализован доступный responsive SVG Renderer
- [x] Добавлены selected/warning/empty состояния и экспорт SVG/PNG
- [x] Mobile 360×800, desktop, keyboard, reduced-motion и offline проверены
- [x] Добавлен SVG snapshot baseline и UI review PASS
- [x] Проходят 131 unit/property/snapshot тест
- [x] Реализованы provider abstraction и fake provider
- [x] Зафиксированы versioned prompt и канонический TECH_SPEC contract
- [x] Реализованы confidence, clarification, validation и rejection
- [x] Safe apply сохраняет state при provider/domain errors
- [x] Token ledger интегрирован в IntentSession
- [x] Сквозной conversation replay и 158 тестов проходят
- [x] Реализованы `SttProvider`, `FakeSttProvider` и Voice state machine
- [x] Явные permission/record/stop и подтверждение транскрипта защищают от скрытого применения
- [x] Cancel/retry, offline recovery и текстовая альтернатива сохраняют данные пользователя
- [x] STT cost ledger считает оплачиваемые секунды и ориентировочную стоимость в KZT
- [x] Android voice view contract и 168 тестов проходят
- [x] Добавлены 5 style presets с тремя палитрами каждый и 6 facade presets
- [x] Tenant settings ограничивают доступные стили, палитры и фасады
- [x] Реализованы per-meter, per-module и hybrid pricing strategies
- [x] Диапазон KZT содержит breakdown, причины неопределённости и formula version
- [x] Recalculation и trust presentation покрыты тестами; 180 тестов проходят
- [x] Contact schema, OTP/CAPTCHA boundaries и idempotent lead creation реализованы
- [x] Lead details содержат project snapshot и append-only event history
- [x] Status transitions, comments и Telegram notification adapter покрыты тестами
- [x] Tenant settings, hard limits, opaque resume tokens и RBAC реализованы
- [x] 190 unit/property/snapshot/contract тестов проходят
- [x] Brief model содержит branding, contact, SVG scheme, modules, style, price и disclaimer
- [x] Реализованы пять PDF policy modes и payment/credit-on-order boundary
- [x] Secure tenant-bound download grants поддерживают expiry, revoke и audit
- [x] Двухстраничный sample PDF отрендерен и визуально принят
- [x] 197 unit/property/snapshot/contract тестов проходят
- [x] Pilot tenant и origin-allowlisted landing embed contract настроены
- [x] Privacy-safe analytics, sanitized error events и cost dashboard реализованы
- [x] Controlled/real session registry, interview validation и funnel formulas реализованы
- [x] Go/no-go gate не принимает решение без полной реальной выборки
- [x] 204 unit/property/snapshot/contract теста проходят

## Next actions

1. Развернуть production adapters и встроить widget на разрешённый landing origin.
2. Провести 20 controlled sessions и исправить подтверждённые blockers.
3. Провести 5 real prospect sessions и 5 интервью без PII в analytics.
4. Сформировать фактический funnel report и принять GO/NO_GO.

## Risks

| Риск | Вероятность | Влияние | Митигирование |
|---|---:|---:|---|
| AI ошибочно понимает команды | Средняя | Высокое | Белый список + подтверждение |
| Сложный UX на телефоне | Средняя | Высокое | Conversation first + SVG |
| Рост токенов | Высокая | Среднее | Compact state + rules |
| Pascal утяжелит bundle | Средняя | Среднее | Spike + adapter |
| Неточные цены | Высокая | Высокое | Диапазон + disclaimer |
| Клиент вводит неверные размеры | Высокая | Высокое | Вопросы + предупреждения |
| Абьюз бесплатных ТЗ | Средняя | Среднее | Лимиты, OTP, CAPTCHA, paywall |
