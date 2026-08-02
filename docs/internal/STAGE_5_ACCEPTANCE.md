# Stage 5 Acceptance — Voice

**Дата:** 2026-08-02  
**Тип проверки:** самопроверка автора, fake-provider contract tests  
**Вердикт:** ПРИНЯТО

## Принято

- provider-neutral STT contract и детерминированный fake provider;
- явное разрешение микрофона, record и stop;
- состояния `idle`, `requesting_permission`, `listening`, `processing`, `transcript_ready`, `applying`, `error`;
- видимый и редактируемый транскрипт до интерпретации;
- применение команды только после подтверждения;
- cancel без изменения проекта и retry только по явному действию;
- сохранение записи в рамках сессии при offline/STT error;
- текстовая альтернатива во всех ошибочных состояниях;
- учёт запросов, оплачиваемых секунд и ориентировочной стоимости STT в KZT;
- Android view-model contract: один контекстный CTA, touch target 44 px, видимый recording indicator и aria-live status.

## Проверки

```text
npm run check   PASS, 168/168
real STT calls  0
secrets         не требуются
```

## Ограничения

- Конкретные browser `MediaRecorder` и STT adapters подключаются на этапе production widget integration.
- Аудио не сохраняется постоянно и не отправляется повторно без явного `retry()`.
- Проверка Android выполнена на детерминированном UI/view-model контракте; полноценный браузерный widget создаётся отдельным клиентским срезом.

## Следующий этап

Stage 6 — Styles and Pricing.
