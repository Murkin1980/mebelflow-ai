import { describe, expect, it } from "vitest";
import { createInitialProject, type FurnitureProjectState } from "../../project-state/src/schema.js";
import { applyStyleSelection } from "../../style-presets/src/index.js";
import { applyPriceEstimate, calculatePrice, pricePresentation, type PricingConfig } from "./index.js";

const project = (): FurnitureProjectState => {
  const state = createInitialProject("price", "tenant");
  state.room.wallWidth = 3000;
  state.lowerRow.modules = [
    { id: "sink", type: "sink_cabinet", width: 800, height: 720, depth: 560, position: 0 },
    { id: "dw", type: "dishwasher_600", width: 600, height: 820, depth: 560, position: 800 },
    { id: "drawers", type: "base_cabinet_drawers", width: 600, height: 720, depth: 560, position: 1400 },
  ];
  state.upperRow.enabled = true;
  return state;
};
const common = { formulaVersion: 3, uncertaintyPercent: .1, upperRowRatePerMeter: 70_000, facadeRatePerMeter: 50_000, hardwarePerModule: 15_000 };

describe("pricing strategies", () => {
  it.each<PricingConfig>([
    { ...common, strategy: "per_meter", baseRatePerMeter: 180_000 },
    { ...common, strategy: "per_module", defaultModulePrice: 160_000, modulePrices: { dishwasher_600: 120_000 } },
    { ...common, strategy: "hybrid", baseRatePerMeter: 120_000, defaultModuleSurcharge: 20_000, moduleSurcharges: { sink_cabinet: 40_000 } },
  ])("calculates deterministic $strategy range and breakdown", config => {
    const result = calculatePrice(project(), config);
    expect(result.strategy).toBe(config.strategy);
    expect(result.formulaVersion).toBe(3);
    expect(result.breakdown.map(item => item.code)).toEqual(["base_modules", "upper_modules", "facades", "hardware"]);
    expect(result.min).toBe(result.breakdown.reduce((sum, item) => sum + item.min, 0));
    expect(result.max).toBe(result.breakdown.reduce((sum, item) => sum + item.max, 0));
    expect(result.max).toBeGreaterThan(result.min);
  });

  it("recalculates when width, modules, upper row or facade changes", () => {
    const config: PricingConfig = { ...common, strategy: "hybrid", baseRatePerMeter: 120_000, defaultModuleSurcharge: 20_000, moduleSurcharges: {} };
    const first = calculatePrice(project(), config);
    const wider = project(); wider.room.wallWidth = 4000;
    const second = calculatePrice(wider, config);
    const styled = applyStyleSelection(wider, { styleId: "japandi", paletteId: "sage", facadeId: "wood_veneer" }, ["japandi"]);
    const third = calculatePrice(styled, config);
    expect(second.max).toBeGreaterThan(first.max);
    expect(third.breakdown.find(item => item.code === "facades")!.max).toBeGreaterThan(second.breakdown.find(item => item.code === "facades")!.max);
  });

  it("excludes fillers from module and hardware pricing", () => {
    const state = project(); state.lowerRow.modules.push({ id: "fill", type: "filler", width: 50, height: 720, depth: 560, position: 2000 });
    const config: PricingConfig = { ...common, strategy: "per_module", defaultModulePrice: 100_000, modulePrices: {} };
    expect(calculatePrice(state, config).breakdown.find(item => item.code === "base_modules")?.min).toBe(270_000);
  });

  it("requires wall width and validates tenant configuration", () => {
    const state = project(); state.room.wallWidth = null;
    expect(() => calculatePrice(state, { ...common, strategy: "per_meter", baseRatePerMeter: 100_000 })).toThrow("ширину стены");
    expect(() => calculatePrice(project(), { ...common, uncertaintyPercent: .8, strategy: "per_meter", baseRatePerMeter: 100_000 })).toThrow();
  });

  it("presents a transparent preliminary range, never a final price", () => {
    const estimate = calculatePrice(project(), { ...common, strategy: "per_meter", baseRatePerMeter: 180_000 });
    const view = pricePresentation(estimate);
    expect(view.label).toContain("Ориентировочно");
    expect(view.disclaimer).toContain("Окончательная цена");
    expect(view).toMatchObject({ breakdownVisible: true, isFinal: false, maxRecommendations: 3 });
  });

  it("stores a preliminary estimate without mutating the source state", () => {
    const source = project();
    const estimate = calculatePrice(source, { ...common, strategy: "per_meter", baseRatePerMeter: 180_000 });
    const next = applyPriceEstimate(source, estimate);
    expect(source.pricing.estimateMin).toBeNull();
    expect(next).toMatchObject({ stage: "price_shown", pricing: { estimateMin: estimate.min, estimateMax: estimate.max, formulaVersion: 3, status: "preliminary" } });
    expect(next.historyMeta.revision).toBe(source.historyMeta.revision + 1);
  });
});
