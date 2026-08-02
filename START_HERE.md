# START HERE — MebelFlow AI

## Порядок начала работы

Перед любыми изменениями кодер обязан прочитать:

1. `FOUNDATION.md`
2. `PRODUCT.md`
3. `TECH_SPEC.md`
4. `ARCHITECTURE.md`
5. `AGENTS.md`
6. `ROADMAP.md`
7. `STAGE_CHECKLIST.md`
8. `PROJECT_PROGRESS.md`
9. `SESSION_NOTES.md`
10. `docs/internal/FIRST_STAGE_INSTRUCTION.md`
11. `docs/decisions/ADR-001-PASCAL-CORE-SVG.md`
12. `docs/decisions/ADR-002-NO-CAD-IN-MVP.md`
13. `docs/decisions/ADR-003-LLM-NOT-GEOMETRY.md`

Для любой задачи по клиентскому интерфейсу дополнительно прочитать:

- `skills/mebelflow-conversational-interface/SKILL.md`
- `skills/mebelflow-conversational-interface/references/QUICK_CHECKLIST.md`

## Первая задача

Выполнить только инструкции из:

```text
docs/internal/FIRST_STAGE_INSTRUCTION.md
```

Первый этап включает:

- Pascal Core spike;
- `SceneStoreAdapter`;
- Project State v1;
- Command Schema v1;
- pure reducer;
- минимум 30 unit-тестов.

## На первом этапе запрещено

- делать полноценный UI;
- подключать реальный AI;
- подключать голос;
- делать backend и админку;
- делать 3D;
- добавлять CAD-интеграции;
- добавлять угловые кухни;
- расширять MVP без отдельного ADR.

## Формат первого ответа кодера

```text
FOUNDATION.md, PRODUCT.md, TECH_SPEC.md, ARCHITECTURE.md,
AGENTS.md, ROADMAP.md, STAGE_CHECKLIST.md, PROJECT_PROGRESS.md,
SESSION_NOTES.md и применимые ADR прочитаны.

Для текущей задачи применимы разделы: ...
Конфликтов с фундаментом: нет / перечислить.

Начинаю Stage 0/1 согласно FIRST_STAGE_INSTRUCTION.md.
```

## После каждой рабочей сессии

Обновить:

- `PROJECT_PROGRESS.md`;
- `SESSION_NOTES.md`;
- соответствующие пункты `STAGE_CHECKLIST.md`;
- UI-review, если менялся интерфейс.

Не считать задачу завершённой только потому, что код компилируется.
