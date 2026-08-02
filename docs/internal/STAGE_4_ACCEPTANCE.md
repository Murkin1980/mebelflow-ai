# Stage 4 Acceptance — Text AI Contract

**Дата:** 2026-08-02  
**Тип проверки:** самопроверка автора, fake-provider contract tests  
**Вердикт:** ПРИНЯТО

## Принято

- provider-neutral `IntentProvider` и детерминированный `FakeIntentProvider`;
- versioned prompt v1 с явным белым списком команд;
- compact project state без tenant pricing и лишнего контекста;
- канонический top-level output из `TECH_SPEC.md`;
- confidence boundary и обязательное подтверждение ниже 0.9;
- `CLARIFY` максимум с тремя вариантами;
- Zod validation и отклонение неизвестных команд/размеров;
- safe apply только через Layout Engine и history;
- сохранение состояния при provider/domain error;
- автоматический token ledger через `IntentSession`;
- сквозной conversation replay с undo.

## Проверки

```text
npm ci          PASS
npm run check   PASS, 158/158
npm audit       PASS, 0 vulnerabilities
real AI calls   0
secrets         не требуются
```

## Основной сценарий

`кухня три метра` → `мойка слева` → `после мойки ПММ 600` → `после неё тумба с ящиками` → `верни предыдущий вариант` воспроизводимо проходит через fake provider. После undo состояние содержит `sink-1` и `dw-1`.

## Ограничения

- Реальный OpenAI-compatible provider сознательно не подключён.
- UI чата и voice не входят в Stage 4 core contract.
- Token ledger считает usage, заявленный provider; фактический биллинг проверяется будущим adapter.

## Следующий этап

Stage 5 Voice: permission, record/stop, STT abstraction, transcript confirmation, retry/cancel, cost tracking и Android/poor-network tests.
