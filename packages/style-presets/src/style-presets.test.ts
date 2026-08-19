import { describe, expect, it } from "vitest";
import { createInitialProject } from "../../project-state/src/schema.js";
import { applyStyleSelection, FACADE_PRESETS, getTenantStyles, selectedFacade, STYLE_PRESETS } from "./index.js";

describe("style presets", () => {
  it("provides five styles with three palettes each and six facade presets", () => {
    expect(STYLE_PRESETS).toHaveLength(5);
    expect(STYLE_PRESETS.every(style => style.palettes.length >= 3)).toBe(true);
    expect(FACADE_PRESETS).toHaveLength(6);
  });
  it("filters styles by tenant settings without mutating the catalog", () => {
    const styles = getTenantStyles(["japandi", "scandinavian"]);
    styles[0]!.name = "changed";
    expect(styles.map(style => style.id)).toEqual(["japandi", "scandinavian"]);
    expect(STYLE_PRESETS[1]?.name).toBe("Джапанди");
  });
  it("applies an allowed style selection and advances project stage", () => {
    const state = applyStyleSelection(createInitialProject("p", "t"), { styleId: "japandi", paletteId: "sage", facadeId: "wood_veneer" }, ["japandi"]);
    expect(state.style.presetId).toBe("japandi:sage:wood_veneer");
    expect(state.stage).toBe("style_selected");
    expect(selectedFacade(state)?.priceMultiplier).toBe(1.6);
  });
  it("rejects tenant-disabled styles and mismatched palettes/facades", () => {
    const state = createInitialProject("p", "t");
    expect(() => applyStyleSelection(state, { styleId: "japandi", paletteId: "sage", facadeId: "wood_veneer" }, ["scandinavian"])).toThrow("недоступен");
    expect(() => applyStyleSelection(state, { styleId: "japandi", paletteId: "snow", facadeId: "wood_veneer" }, ["japandi"])).toThrow("Палитра");
    expect(() => applyStyleSelection(state, { styleId: "japandi", paletteId: "sage", facadeId: "shaker" }, ["japandi"])).toThrow("Фасад");
  });
});
