import { describe, expect, it } from "vitest";
import { createModule, isAllowedModuleWidth } from "./catalog.js";
import { migrateProjectState, recoverProjectState } from "./migration.js";
import { createInitialProject } from "./schema.js";
import { toMillimetres } from "./units.js";

describe("module catalog", () => {
  it("allows standard cabinet width", () => expect(isAllowedModuleWidth("base_cabinet_doors", 600)).toBe(true));
  it("rejects non-standard cabinet width", () => expect(isAllowedModuleWidth("base_cabinet_doors", 610)).toBe(false));
  it("allows dishwasher 450 only at 450", () => {
    expect(isAllowedModuleWidth("dishwasher_450", 450)).toBe(true);
    expect(isAllowedModuleWidth("dishwasher_450", 600)).toBe(false);
  });
  it("allows dishwasher 600 only at 600", () => expect(isAllowedModuleWidth("dishwasher_600", 600)).toBe(true));
  it("allows filler up to 149", () => expect(isAllowedModuleWidth("filler", 149)).toBe(true));
  it("rejects filler at module width", () => expect(isAllowedModuleWidth("filler", 150)).toBe(false));
  it("uses appliance dimensions", () =>
    expect(createModule("dw", "dishwasher_600", 600)).toMatchObject({ height: 820, depth: 560 }));
  it("supports tenant widths", () => expect(isAllowedModuleWidth("sink_cabinet", 550, [550])).toBe(true));
});
describe("units", () => {
  it("keeps millimetres", () => expect(toMillimetres(3000, "mm")).toBe(3000));
  it("converts centimetres", () => expect(toMillimetres(300, "cm")).toBe(3000));
  it("converts metres", () => expect(toMillimetres(3, "m")).toBe(3000));
  it("converts decimal metres exactly", () => expect(toMillimetres(2.7, "m")).toBe(2700));
  it("rejects zero", () => expect(() => toMillimetres(0, "mm")).toThrow());
  it("rejects fractional millimetres", () => expect(() => toMillimetres(1.25, "cm")).toThrow());
});
describe("migration and recovery", () => {
  it("accepts current state", () => {
    const state = createInitialProject("p", "t");
    expect(migrateProjectState(state)).toEqual(state);
  });
  it("migrates legacy id", () => {
    const state = createInitialProject("p", "t") as unknown as Record<string, unknown>;
    delete state.projectId;
    state.id = "legacy";
    delete state.schemaVersion;
    expect(migrateProjectState(state).projectId).toBe("legacy");
  });
  it("does not mutate migration input", () => {
    const state = createInitialProject("p", "t");
    const copy = structuredClone(state);
    migrateProjectState(state);
    expect(state).toEqual(copy);
  });
  it("recovers corrupt state", () => {
    const result = recoverProjectState({ bad: true }, "safe", "tenant");
    expect(result.recovered).toBe(true);
    expect(result.state.projectId).toBe("safe");
  });
  it("adds recovery warning", () =>
    expect(recoverProjectState(null, "safe", "tenant").state.warnings[0]?.code).toBe("state_recovered"));
  it("recovers duplicate module ids", () => {
    const state = createInitialProject("p", "t");
    state.room.wallWidth = 3000;
    state.lowerRow.modules = [
      createModule("x", "sink_cabinet", 600),
      { ...createModule("x", "dishwasher_600", 600), position: 600 },
    ];
    expect(recoverProjectState(state, "safe", "tenant").recovered).toBe(true);
  });
  it("recovers invalid module positions", () => {
    const state = createInitialProject("p", "t");
    state.lowerRow.modules = [{ ...createModule("x", "sink_cabinet", 600), position: 100 }];
    expect(recoverProjectState(state, "safe", "tenant").recovered).toBe(true);
  });
  it("recovers wall overflow", () => {
    const state = createInitialProject("p", "t");
    state.room.wallWidth = 1200;
    state.lowerRow.modules = [
      createModule("a", "sink_cabinet", 1000),
      { ...createModule("b", "base_cabinet_doors", 1000), position: 1000 },
    ];
    expect(recoverProjectState(state, "safe", "tenant").recovered).toBe(true);
  });
  it("does not recover valid state", () =>
    expect(recoverProjectState(createInitialProject("p", "t"), "x", "y").recovered).toBe(false));
});
