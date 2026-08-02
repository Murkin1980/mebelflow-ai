# Interface Skill Selection

**Дата:** 2026-08-02

## Рассмотренные варианты

- Anthropic frontend-design;
- OpenAI curated frontend skill;
- UI/UX Pro Max;
- Microsoft frontend-design-review;
- Bencium controlled UX designer;
- Claude Code Frontend Design Toolkit как каталог.

## Выбор

Основой выбран Microsoft `frontend-design-review`, потому что он сочетает:

- создание интерфейса;
- системное ревью;
- понятность действий;
- design system compliance;
- accessibility;
- AI transparency;
- error transparency;
- responsive review.

Это лучше соответствует MebelFlow AI, чем навыки, ориентированные преимущественно на декоративную выразительность лендингов.

## Локальная адаптация

Создан отдельный skill:

```text
skills/mebelflow-conversational-interface/
```

Он жёстко закрепляет:

- conversation-first;
- mobile-first;
- SVG-first;
- calm gamification;
- voice transparency;
- один CTA;
- undo/recovery;
- предварительный статус цены;
- мебельный характер;
- запрет generic AI UI;
- обязательные review gates.

## Применение

Навык обязателен для:

- `apps/widget`;
- SVG-сцены;
- voice/text UI;
- этапов прогресса;
- выбора стиля;
- цены;
- PDF CTA;
- клиентского подтверждения.

Для `apps/admin` применяется review mode, но административный интерфейс может иметь более плотную информационную структуру.
