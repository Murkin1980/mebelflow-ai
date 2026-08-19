import { z } from "zod";
import { type FurnitureProjectState, FurnitureProjectStateSchema } from "../../project-state/src/schema.js";

export const STYLE_IDS = ["modern_minimal", "japandi", "neoclassic", "warm_modern", "scandinavian"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const FacadePresetSchema = z.object({
  id: z.enum(["smooth_matte", "smooth_gloss", "shaker", "narrow_frame", "wood_veneer", "fluted"]),
  name: z.string().min(1),
  material: z.string().min(1),
  priceMultiplier: z.number().min(0.8).max(2),
});
export type FacadePreset = z.infer<typeof FacadePresetSchema>;

export const FACADE_PRESETS: readonly FacadePreset[] = [
  { id: "smooth_matte", name: "Гладкий матовый", material: "МДФ в плёнке", priceMultiplier: 1 },
  { id: "smooth_gloss", name: "Гладкий глянец", material: "МДФ эмаль", priceMultiplier: 1.25 },
  { id: "shaker", name: "Шейкер", material: "Фрезерованный МДФ", priceMultiplier: 1.35 },
  { id: "narrow_frame", name: "Тонкая рамка", material: "Фрезерованный МДФ", priceMultiplier: 1.4 },
  { id: "wood_veneer", name: "Шпон дерева", material: "Шпонированный МДФ", priceMultiplier: 1.6 },
  { id: "fluted", name: "Рифлёный", material: "Фрезерованный МДФ", priceMultiplier: 1.5 },
] as const;

const PaletteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colors: z.tuple([z.string(), z.string(), z.string()]),
});
const StylePresetSchema = z.object({
  id: z.enum(STYLE_IDS),
  name: z.string().min(1),
  description: z.string().min(1),
  palettes: z.array(PaletteSchema).min(3).max(5),
  facadeIds: z.array(FacadePresetSchema.shape.id).min(1),
  handles: z.string().min(1),
  countertop: z.string().min(1),
});
export type StylePreset = z.infer<typeof StylePresetSchema>;

const palette = (id: string, name: string, colors: [string, string, string]) => ({ id, name, colors });
export const STYLE_PRESETS: readonly StylePreset[] = [
  {
    id: "modern_minimal",
    name: "Современный минимализм",
    description: "Чистые линии и спокойные матовые поверхности.",
    palettes: [
      palette("graphite", "Графит", ["#303236", "#E8E5DE", "#B9A98F"]),
      palette("sand", "Песок", ["#D6C6AD", "#F4F0E8", "#6E655B"]),
      palette("white_oak", "Белый дуб", ["#F5F3EE", "#C8A77A", "#3C4142"]),
    ],
    facadeIds: ["smooth_matte", "smooth_gloss", "narrow_frame"],
    handles: "Профиль Gola",
    countertop: "Кварцевый агломерат",
  },
  {
    id: "japandi",
    name: "Джапанди",
    description: "Тёплое дерево, природные оттенки и визуальная тишина.",
    palettes: [
      palette("natural_oak", "Натуральный дуб", ["#C7A77B", "#E8E0D2", "#5D6258"]),
      palette("clay", "Глина", ["#A77D66", "#E6D8C7", "#4C5149"]),
      palette("sage", "Шалфей", ["#899584", "#E9E5DA", "#A98663"]),
    ],
    facadeIds: ["smooth_matte", "wood_veneer", "fluted"],
    handles: "Скрытая ручка",
    countertop: "Светлый компакт-ламинат",
  },
  {
    id: "neoclassic",
    name: "Неоклассика",
    description: "Сдержанная рамка и мягкие светлые оттенки.",
    palettes: [
      palette("ivory", "Слоновая кость", ["#EEE9DD", "#BDA88C", "#56504A"]),
      palette("dusty_blue", "Пыльно-синий", ["#71808A", "#EEE9DF", "#B18D68"]),
      palette("cashmere", "Кашемир", ["#B9AA9A", "#F1ECE3", "#4D4743"]),
    ],
    facadeIds: ["shaker", "narrow_frame"],
    handles: "Ручка-скоба",
    countertop: "Кварц под мрамор",
  },
  {
    id: "warm_modern",
    name: "Тёплый модерн",
    description: "Глубокие тона, дерево и лаконичная фурнитура.",
    palettes: [
      palette("walnut", "Орех", ["#6C4B37", "#D7C5AC", "#252827"]),
      palette("terracotta", "Терракота", ["#A45F45", "#E7D4BE", "#55584E"]),
      palette("olive", "Олива", ["#66705A", "#D8C9AE", "#5C4434"]),
    ],
    facadeIds: ["smooth_matte", "wood_veneer", "fluted"],
    handles: "Тонкая накладная ручка",
    countertop: "Тёмный кварц",
  },
  {
    id: "scandinavian",
    name: "Скандинавский",
    description: "Светлая практичная кухня с натуральными акцентами.",
    palettes: [
      palette("snow", "Снег", ["#F5F4EF", "#D2B48C", "#737A78"]),
      palette("fjord", "Фьорд", ["#7E9698", "#F0EEE7", "#C5A172"]),
      palette("birch", "Берёза", ["#D8BC8C", "#F7F4EA", "#89917D"]),
    ],
    facadeIds: ["smooth_matte", "shaker", "wood_veneer"],
    handles: "Кнопка или интегрированная",
    countertop: "Древесный HPL",
  },
] as const;

STYLE_PRESETS.forEach((value) => {
  StylePresetSchema.parse(value);
});
FACADE_PRESETS.forEach((value) => {
  FacadePresetSchema.parse(value);
});

export function getTenantStyles(enabledStyleIds: readonly StyleId[]): StylePreset[] {
  const enabled = new Set(enabledStyleIds);
  return STYLE_PRESETS.filter((style) => enabled.has(style.id)).map((style) => structuredClone(style));
}

export type StyleSelection = { styleId: StyleId; paletteId: string; facadeId: FacadePreset["id"] };
export function applyStyleSelection(
  state: FurnitureProjectState,
  selection: StyleSelection,
  enabledStyleIds: readonly StyleId[],
): FurnitureProjectState {
  const style = getTenantStyles(enabledStyleIds).find((item) => item.id === selection.styleId);
  if (!style) throw new Error("Стиль недоступен у этого мебельщика.");
  if (!style.palettes.some((item) => item.id === selection.paletteId))
    throw new Error("Палитра не относится к выбранному стилю.");
  if (!style.facadeIds.includes(selection.facadeId)) throw new Error("Фасад не относится к выбранному стилю.");
  const next = structuredClone(state);
  next.style.presetId = `${selection.styleId}:${selection.paletteId}:${selection.facadeId}`;
  next.stage = "style_selected";
  next.historyMeta.revision += 1;
  return FurnitureProjectStateSchema.parse(next);
}

export function selectedFacade(state: FurnitureProjectState): FacadePreset | null {
  const facadeId = state.style.presetId?.split(":")[2];
  return FACADE_PRESETS.find((item) => item.id === facadeId) ?? null;
}
