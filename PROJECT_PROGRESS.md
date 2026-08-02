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
SVG Renderer                ░░░░░░░░░░   0%
Text AI                     ░░░░░░░░░░   0%
Voice                       ░░░░░░░░░░   0%
Pricing and Styles          ░░░░░░░░░░   0%
Admin and Lead              ░░░░░░░░░░   0%
PDF                         ░░░░░░░░░░   0%
Pilot                       ░░░░░░░░░░   0%
```

## Current phase

**Stage 0/1/2 приняты. Следующий этап: Stage 3 — SVG Renderer**

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

## Next actions

1. Начать Stage 3 с SVG-контракта и front-view стены.
2. Отрисовать нижний ряд, размеры и остаток.
3. Добавить selected/warning states и accessibility metadata.
4. Настроить visual regression и mobile 360×800 evidence.

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
