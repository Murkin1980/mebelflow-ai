import { z } from "zod";
import { FurnitureProjectStateSchema, type FurnitureProjectState } from "../../project-state/src/schema.js";
import { selectedFacade } from "../../style-presets/src/index.js";

const CommonSchema = z.object({
  formulaVersion: z.number().int().positive(),
  uncertaintyPercent: z.number().min(0).max(.5),
  upperRowRatePerMeter: z.number().nonnegative(),
  facadeRatePerMeter: z.number().nonnegative(),
  hardwarePerModule: z.number().nonnegative(),
});
const PerMeterSchema = CommonSchema.extend({ strategy: z.literal("per_meter"), baseRatePerMeter: z.number().positive() });
const PerModuleSchema = CommonSchema.extend({ strategy: z.literal("per_module"), defaultModulePrice: z.number().positive(), modulePrices: z.record(z.string(), z.number().positive()).default({}) });
const HybridSchema = CommonSchema.extend({ strategy: z.literal("hybrid"), baseRatePerMeter: z.number().positive(), defaultModuleSurcharge: z.number().nonnegative(), moduleSurcharges: z.record(z.string(), z.number().nonnegative()).default({}) });
export const PricingConfigSchema = z.discriminatedUnion("strategy", [PerMeterSchema, PerModuleSchema, HybridSchema]);
export type PricingConfig = z.infer<typeof PricingConfigSchema>;

export type PriceBreakdown = { code: "base_modules" | "upper_modules" | "facades" | "hardware"; min: number; max: number };
export type PriceEstimate = {
  min: number; max: number; currency: "KZT"; formulaVersion: number; confidence: "preliminary";
  strategy: PricingConfig["strategy"]; breakdown: PriceBreakdown[]; reasons: string[];
  disclaimer: "Предварительная стоимость. Окончательная цена подтверждается мебельщиком после проверки и замера.";
};

const roundKzt = (value: number) => Math.round(value / 1_000) * 1_000;
function ranged(code: PriceBreakdown["code"], nominal: number, uncertainty: number): PriceBreakdown {
  return { code, min: Math.max(0, roundKzt(nominal * (1 - uncertainty))), max: Math.max(0, roundKzt(nominal * (1 + uncertainty))) };
}

export function calculatePrice(state: FurnitureProjectState, input: PricingConfig): PriceEstimate {
  const config = PricingConfigSchema.parse(input);
  if (state.room.wallWidth === null) throw new Error("Для расчёта цены укажите ширину стены.");
  const meters = state.room.wallWidth / 1_000;
  const modules = state.lowerRow.modules.filter(module => module.type !== "filler");
  let baseNominal: number;
  if (config.strategy === "per_meter") baseNominal = meters * config.baseRatePerMeter;
  else if (config.strategy === "per_module") baseNominal = modules.reduce((sum, module) => sum + (config.modulePrices[module.type] ?? config.defaultModulePrice), 0);
  else baseNominal = meters * config.baseRatePerMeter + modules.reduce((sum, module) => sum + (config.moduleSurcharges[module.type] ?? config.defaultModuleSurcharge), 0);
  const upperNominal = state.upperRow.enabled ? meters * config.upperRowRatePerMeter : 0;
  const facadeMultiplier = selectedFacade(state)?.priceMultiplier ?? 1;
  const facadeNominal = meters * config.facadeRatePerMeter * facadeMultiplier;
  const hardwareNominal = modules.length * config.hardwarePerModule;
  const breakdown = [
    ranged("base_modules", baseNominal, config.uncertaintyPercent),
    ranged("upper_modules", upperNominal, config.uncertaintyPercent),
    ranged("facades", facadeNominal, config.uncertaintyPercent),
    ranged("hardware", hardwareNominal, config.uncertaintyPercent),
  ];
  return {
    min: breakdown.reduce((sum, item) => sum + item.min, 0),
    max: breakdown.reduce((sum, item) => sum + item.max, 0),
    currency: "KZT", formulaVersion: config.formulaVersion, confidence: "preliminary", strategy: config.strategy, breakdown,
    reasons: ["Точные материалы и фурнитура уточняются после замера.", ...(state.style.presetId ? [] : ["Стиль ещё не выбран; применён базовый коэффициент фасада."])],
    disclaimer: "Предварительная стоимость. Окончательная цена подтверждается мебельщиком после проверки и замера.",
  };
}

export function pricePresentation(estimate: PriceEstimate) {
  return {
    label: `Ориентировочно ${estimate.min.toLocaleString("ru-RU")}–${estimate.max.toLocaleString("ru-RU")} ₸`,
    disclaimer: estimate.disclaimer,
    breakdownVisible: true,
    isFinal: false,
    maxRecommendations: 3 as const,
  };
}

export function applyPriceEstimate(state: FurnitureProjectState, estimate: PriceEstimate): FurnitureProjectState {
  const next = structuredClone(state);
  next.pricing = {
    currency: "KZT",
    estimateMin: estimate.min,
    estimateMax: estimate.max,
    formulaVersion: estimate.formulaVersion,
    status: "preliminary",
  };
  next.stage = "price_shown";
  next.historyMeta.revision += 1;
  return FurnitureProjectStateSchema.parse(next);
}
