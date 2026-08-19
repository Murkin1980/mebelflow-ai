/**
 * Нейтральные доменные константы MebelFlow AI.
 *
 * Модуль намеренно не имеет внутренних зависимостей: и `command-schema`
 * (белый список команд), и `project-state` (схема состояния) импортируют
 * типы модулей отсюда, что исключает циклическую зависимость пакетов.
 */

export const LOWER_MODULE_TYPES = [
  "base_cabinet_doors",
  "base_cabinet_drawers",
  "sink_cabinet",
  "dishwasher_450",
  "dishwasher_600",
  "oven_base",
  "cooktop_base",
  "washing_machine",
  "filler",
  "open_base",
  "fridge",
  "fridge_tall_unit",
  "oven_tall_unit",
  "pantry_tall_unit",
  "utility_tall_unit",
] as const;

export type LowerModuleType = (typeof LOWER_MODULE_TYPES)[number];

/**
 * Составные высоты нижнего ряда (TECH_SPEC §5).
 *
 * Сумма компонентов — 858 мм. MVP default `lowerRow.totalHeight` — 900 мм
 * (внутри рекомендованной рабочей высоты 860–920, настраивается tenant);
 * смена default'а — продуктовое решение владельца, а не рефакторинг.
 */
export const LOWER_CABINET_HEIGHT_MM = 720;
export const PLINTH_HEIGHT_MM = 100;
export const COUNTERTOP_THICKNESS_MM = 38;
export const CALCULATED_LOWER_ROW_HEIGHT_MM = LOWER_CABINET_HEIGHT_MM + PLINTH_HEIGHT_MM + COUNTERTOP_THICKNESS_MM; // 858
export const RECOMMENDED_WORK_HEIGHT_MIN_MM = 860;
export const RECOMMENDED_WORK_HEIGHT_MAX_MM = 920;
