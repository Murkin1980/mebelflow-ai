# UI Review

## User task

Сказать команду, проверить распознанный текст и применить её без риска скрытого изменения схемы.

## Direction

Conversation-first mobile flow с одним контекстным CTA и постоянной текстовой альтернативой.

## Blocking

Нет.

## Major

Нет в рамках core/view-model среза. Browser MediaRecorder остаётся задачей production widget integration.

## Minor

Визуальные screenshots переносятся в клиентский widget slice: Stage 5 не создаёт новый экран и проверяет UI-контракт как view model.

## Accessibility

Статус предназначен для `aria-live`, запись имеет текстовый индикатор, минимальная цель касания — 44 px, голос всегда имеет текстовую альтернативу.

## Mobile

Android contract фиксирует один primary CTA: разрешить → записать → стоп → подтвердить/повторить. Транскрипт остаётся видимым перед применением.

## Trust and AI transparency

Разделены распознанный текст, интерпретация и применённое изменение. Схема не меняется до подтверждения; ошибки сохраняют исходное состояние.

## Verification evidence

`packages/voice-input/src/voice-input.test.ts`: permission, recording indicator, transcript, 44 px target, offline, retry, cancel и safe apply. 168/168 тестов проходят.

## Decision

PASS для Stage 5 core/view-model scope.
