# FIRST STAGE INSTRUCTION — MebelFlow AI

## Цель

Завершить Stage 0 и Stage 1 без UI и без реального AI.

## Обязательные входные документы

Прочитать:

- FOUNDATION.md
- PRODUCT.md
- ARCHITECTURE.md
- TECH_SPEC.md
- AGENTS.md
- ADR-001
- ADR-002
- ADR-003

## Задачи

### 1. Pascal spike

Создать отдельный эксперимент:

```text
spikes/pascal-core/
```

Проверить:

- импорт пакета;
- node create/update/delete;
- metadata;
- undo/redo;
- сериализацию;
- bundle size;
- отсутствие обязательного WebGPU;
- Android browser smoke.

Подготовить:

```text
docs/research/PASCAL_CORE_SPIKE_RESULT.md
```

И дать решение:

- USE;
- ADAPT;
- REJECT.

### 2. SceneStoreAdapter

Создать интерфейс, независимый от Pascal.

### 3. Project State v1

Создать Zod schema и TypeScript types.

### 4. Command Schema v1

Поддержать:

- SET_WALL_WIDTH;
- SET_ROOM_HEIGHT;
- ADD_MODULE;
- REMOVE_MODULE;
- INSERT_AFTER;
- MOVE_TO_EDGE;
- CHANGE_WIDTH;
- UNDO;
- REDO.

### 5. Reducer

Pure deterministic reducer.

### 6. Tests

Минимум 30 unit-тестов:

- valid;
- invalid;
- boundaries;
- idempotency;
- undo;
- redo;
- corrupted state.

## Запрещено

- делать UI;
- подключать реальный AI;
- делать voice;
- делать SVG;
- делать backend;
- делать admin;
- добавлять угловую кухню;
- делать 3D.

## Результат

Stage 1 считается завершённым, когда Project State и команды воспроизводимо работают в тестах.
