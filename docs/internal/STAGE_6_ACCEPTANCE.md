# Stage 6 Acceptance — Styles and Pricing

**Дата:** 2026-08-02  
**Тип проверки:** самопроверка автора, deterministic contract tests  
**Вердикт:** ПРИНЯТО

## Принято

- пять обязательных стилей и три палитры для каждого;
- шесть фасадных пресетов с проверяемым коэффициентом;
- tenant-controlled доступность и строгая совместимость style/palette/facade;
- per-meter, per-module и hybrid pricing;
- min/max estimate в KZT, breakdown, reasons и formula version;
- пересчёт при изменении стены, модулей, верхнего ряда и фасада;
- presentation contract с явным preliminary disclaimer и `isFinal: false`.

## Проверки

```text
npm run check   PASS, 180/180
AI arithmetic   отсутствует
secrets         не требуются
```

## Ограничения

- Конкретные tenant-тарифы поступают из будущего Admin adapter; в core передаётся валидированный config.
- Пресеты описывают направление, а не обещают точный материал в наличии.
- Окончательная цена подтверждается мебельщиком после проверки и замера.

## Следующий этап

Stage 7 — Lead and Admin.
