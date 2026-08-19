# AGENTS — правила работы над MebelFlow AI

## 1. Перед началом задачи

Кодер обязан прочитать:

1. `FOUNDATION.md`
2. `PRODUCT.md`
3. `ARCHITECTURE.md`
4. `TECH_SPEC.md`
5. `STAGE_CHECKLIST.md`
6. `PROJECT_PROGRESS.md`
7. `SESSION_NOTES.md`
8. применимый ADR

В начале отчёта написать:

```text
Прочитаны: ...
Применимы разделы: ...
Конфликты с фундаментом: нет / перечислить.
```

## 2. Основной принцип

Не расширять scope без отдельного решения.

Запрещено самовольно добавлять:

- 3D (единственное исключение — принятый ADR-005: ленивый Three.js viewer в widget);
- SketchUp;
- PRO100;
- БАЗИС;
- CAD-экспорт;
- угловую кухню;
- arbitrary formulas;
- arbitrary code execution;
- сложный workflow engine;
- SaaS-функции, не нужные пилоту.

## 3. Работа маленькими срезами

Каждая итерация должна:

- решать одну проверяемую задачу;
- иметь тест;
- не ломать существующие контракты;
- обновлять документы;
- завершаться кратким handoff.

## 4. Архитектурные правила

- Pure functions для геометрии и цены.
- AI только интерпретирует.
- Команды проходят Zod.
- Неизвестная команда отклоняется.
- Состояние versioned.
- Все размеры в мм.
- UI не является источником истины.
- Tenant data изолированы.
- Pricing versioned.
- Network sender injected.
- Production actions gated.
- Формат и линт — Biome (`npm run lint`, `npm run format`); CI падает на lint-ошибках.
- Примеры в `docs/templates/` валидируются схемами тестом `docs-contract.test.ts` — менять их только вместе с тестами.
- Владелец undo/redo — `ProjectHistory` (reducer + layout-engine). `SceneStoreAdapter` — низкоуровневый Pascal-совместимый CRUD-слой; его внутренняя история не участвует в доменном undo и в runtime-потоке не используется.

## 5. Pascal

Не завязывать доменную модель напрямую на Pascal.

Обязательно использовать `SceneStoreAdapter`.

Перед подключением пакета проверить:

- лицензию;
- API;
- размер;
- tree shaking;
- browser support;
- maintenance risk;
- тестируемость;
- отсутствие ненужного WebGPU.

## 6. Тесты

Минимум:

- unit для каждой команды;
- boundary размеры;
- invalid command;
- corrupted state;
- undo/redo;
- deterministic replay;
- pricing;
- SVG snapshots;
- mobile e2e;
- AI contract tests с fake provider.

## 7. Документация

После каждой итерации обновить:

- `PROJECT_PROGRESS.md`;
- `SESSION_NOTES.md`;
- соответствующий checklist;
- ADR, если изменилось решение.

## 8. Handoff формат

```markdown
## Выполнено

## Изменённые файлы

## Тесты

## Ограничения

## Риски

## Следующий безопасный шаг
```

## 9. Stop conditions

Остановиться и сообщить, если:

- задача конфликтует с FOUNDATION;
- требует расширения MVP;
- Pascal API не подходит;
- нет подтверждённого формата;
- нужна платная зависимость;
- требуется секрет;
- тесты не проходят;
- поведение на Android неизвестно.

## 10. Обязательный UI skill

Перед любой задачей в:

- `apps/widget`;
- `packages/svg-renderer`;
- клиентском voice/text flow;
- style selection;
- price presentation;
- confirmation flow;

прочитать:

```text
skills/mebelflow-conversational-interface/SKILL.md
skills/mebelflow-conversational-interface/references/QUICK_CHECKLIST.md
```

Перед завершением UI-задачи выполнить review mode и сохранить результат в:

```text
docs/reviews/YYYY-MM-DD-<feature>-ui-review.md
```

Запрещено принимать интерфейс только по факту компиляции. Нужны визуальные и accessibility evidence.

