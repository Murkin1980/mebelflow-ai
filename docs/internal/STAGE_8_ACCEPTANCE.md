# Stage 8 Acceptance — PDF

**Дата:** 2026-08-02  
**Тип проверки:** contract tests + real PDF render and visual QA  
**Вердикт:** ПРИНЯТО

## Принято

- tenant-branded brief template;
- обязательный disclaimer;
- SVG scheme, dimensions, modules, style, preliminary price and warnings;
- free, after_contact, after_order, paid and credited_to_order policies;
- external payment boundary without trusting client flags;
- tenant-bound expiring/revocable download grants;
- append-only access audit.

## Проверки

```text
npm run check   PASS, 197/197
PDF metadata    A4, 2 pages, no JS, no forms
visual render   PASS: Cyrillic, tables, scheme, disclaimer, footer
secrets         не требуются
```

Финальный sample: `output/pdf/mebelflow-stage8-sample.pdf`.

## Ограничения

- Production renderer/storage/payment подключаются adapters.
- PDF является предварительным ТЗ, не производственным чертежом.
- Secure download core не заменяет серверную авторизацию и rate limits.

## Следующий этап

Stage 9 — Pilot.
