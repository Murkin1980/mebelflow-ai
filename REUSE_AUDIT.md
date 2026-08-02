# REUSE AUDIT — существующие наработки

## 1. `furniture-intake-agent`

### Забрать

- intent;
- extract;
- questions;
- summary;
- conversation state;
- кухня как предметная область;
- FastAPI-подход как reference.

### Не копировать целиком

Новый проект должен быть TypeScript-first и ориентирован на widget.

## 2. `furniture-orders-mvp`

### Забрать

- tenant boundaries;
- lead/order model;
- Cloudflare;
- D1;
- admin shell;
- landing embed;
- AI provider abstraction;
- rate limiting;
- Telegram;
- audit;
- calculator settings.

### Не переносить в MVP

- OCR pipeline;
- SketchUp pipeline;
- R2 render artifacts;
- experimental 3D;
- усложнённые production gates, не относящиеся к текущей функции.

## 3. `furniture-configurator`

### Забрать

- dimensions;
- ranges;
- option schema;
- pricing rules;
- colors;
- counters;
- URL state ideas;
- validation.

### Переделать

- товар → композиция модулей;
- image viewer → SVG renderer;
- single config → project state.

## 4. `interactive-kp`

### Забрать

- public token;
- confirmation;
- client comment;
- price update;
- versioning;
- status transition;
- locked confirmed state.

## 5. `Furniture-web-platform-V2`

### Забрать

- free/paid project depth;
- credit-on-order;
- simplicity first;
- package and entitlement ideas;
- supplier-aware pricing позднее.

## 6. Pascal Editor

### Изучить

- core;
- node schemas;
- scene operations;
- store;
- undo/redo;
- plugin registration;
- metadata;
- lingo/units.

### Не использовать

- full editor;
- building systems;
- WebGPU renderer;
- BIM;
- MEP;
- Studio;
- полный viewer в MVP.

## 7. Новые модули

- Project State;
- Command Schema;
- Layout Engine;
- SVG Renderer;
- Voice command workflow;
- Style Presets;
- Calm gamification.
