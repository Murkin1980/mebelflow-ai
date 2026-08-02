# ROADMAP — MebelFlow AI

## Этап 0. Foundation

- создать репозиторий;
- сохранить фундамент;
- провести Pascal spike;
- утвердить стек;
- выбрать источник инфраструктурных модулей;
- создать прогресс-дашборд.

## Этап 1. Domain Core

- Project State v1;
- Furniture Node schemas;
- Command Schema v1;
- unit normalization;
- reducer;
- undo/redo;
- deterministic validation;
- unit tests.

## Этап 2. Layout Engine

- прямая стена;
- нижние модули;
- стандартные ширины;
- insert before/after;
- move;
- delete;
- остаток;
- добор;
- верхний ряд;
- антресоли;
- предупреждения.

## Этап 3. SVG Renderer

- фронтальная схема;
- размеры;
- подписи;
- техника;
- selected state;
- предупреждения;
- цвета;
- responsive mobile;
- export PNG/SVG.

## Этап 4. Text Conversation

- prompt contract;
- AI provider abstraction;
- intent parser;
- validation;
- clarification;
- compact context;
- safe command execution;
- conversation UI.

## Этап 5. Voice

- Speech-to-Text;
- microphone permissions;
- transcript preview;
- confidence;
- retries;
- mobile testing;
- cost counters.

## Этап 6. Styles and Pricing

- style presets;
- facade presets;
- tenant material options;
- pricing strategies;
- breakdown;
- uncertainty;
- price versioning.

## Этап 7. Lead and Admin

- contact capture;
- OTP/CAPTCHA;
- lead card;
- events;
- Telegram;
- tenant settings;
- status pipeline;
- session resume.

## Этап 8. PDF and Monetization

- brief template;
- free/paid policy;
- payment adapter boundary;
- credit to order;
- download controls;
- storage;
- audit.

## Этап 9. Pilot

- one tenant;
- one landing;
- real mobile users;
- funnel analytics;
- AI cost;
- abandonment;
- qualitative interviews;
- fix critical issues.

## Этап 10. Expansion Decision

Только по результатам пилота решить:

- угловые кухни;
- шкафы;
- WhatsApp inbound;
- KZ;
- lightweight pseudo-3D;
- Pascal packages deeper adoption;
- CRM integrations.

```mermaid
gantt
    title MebelFlow AI — ориентировочная последовательность
    dateFormat  YYYY-MM-DD
    axisFormat  %d.%m

    section Foundation
    Foundation и Pascal spike     :a1, 2026-08-03, 7d
    Domain contracts              :a2, after a1, 7d

    section Core
    Layout Engine                 :b1, after a2, 14d
    SVG Renderer                  :b2, after a2, 12d

    section AI
    Text commands                 :c1, after b1, 10d
    Voice input                   :c2, after c1, 7d

    section Product
    Styles and Pricing            :d1, after b2, 9d
    Lead and Admin                :d2, after c1, 10d
    PDF and Monetization          :d3, after d2, 8d

    section Pilot
    Hardening                     :e1, after d3, 7d
    Pilot                         :e2, after e1, 14d
```
