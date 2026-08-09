import { describe, expect, it } from "vitest";
import { createInitialProject, createModule } from "../../project-state/src/index.js";
import { projectStateToScene, type VisualAssetRef } from "./index.js";

function state() {
  const value = createInitialProject("scene", "tenant"); value.room.wallWidth = 3000; value.room.roomHeight = 2700;
  value.lowerRow.modules = [createModule("sink", "sink_cabinet", 800), { ...createModule("drawers", "base_cabinet_drawers", 600), position: 800 }];
  return value;
}
describe("visual scene engine", () => {
  it("maps dimensions and centered XYZ positions in millimetres", () => { const scene = projectStateToScene(state()); expect(scene.modules[0]).toMatchObject({ id: "sink", kind: "box", position: { x: 400, y: 360, z: 280 }, dimensionsMm: { width: 800, height: 720, depth: 560 } }); expect(scene.modules[1]?.position.x).toBe(1100) });
  it("creates corpus, facade and countertop fallback parts", () => expect(projectStateToScene(state()).modules[0]?.parts.map(part => part.kind)).toEqual(["corpus", "facade", "countertop"]));
  it("uses GLB and computes scale from declared dimensions", () => { const value = state(); value.lowerRow.modules[0]!.metadata = { visualAssetId: "sink-glb" }; const assets: Record<string, VisualAssetRef> = { "sink-glb": { assetId: "sink-glb", glbUrl: "/assets/sink.glb", dimensionsMm: { width: 400, height: 720, depth: 280 } } }; expect(projectStateToScene(value, assets).modules[0]).toMatchObject({ kind: "glb", glbUrl: "/assets/sink.glb", glbScale: { x: 2, y: 1, z: 2 } }) });
  it("falls back when asset is missing", () => { const value = state(); value.lowerRow.modules[0]!.metadata = { visualAssetId: "missing" }; expect(projectStateToScene(value, {}).modules[0]?.kind).toBe("box") });
  it("falls back when declared GLB dimensions are unsafe", () => { const value = state(); value.lowerRow.modules[0]!.metadata = { visualAssetId: "bad" }; expect(projectStateToScene(value, { bad: { assetId: "bad", glbUrl: "/bad.glb", dimensionsMm: { width: 0, height: 720, depth: 560 } } }).modules[0]?.kind).toBe("box") });
  it("creates aligned upper cabinets at countertop plus apron height", () => { const value = state(); value.upperRow.enabled = true; value.upperRow.mainCabinetHeight = 800; value.upperRow.apronHeight = 600; const scene = projectStateToScene(value); expect(scene.modules.filter(module => module.tier === "upper")).toMatchObject([{ id: "upper:sink", sourceModuleId: "sink", position: { x: 400, y: 1758, z: 175 }, dimensionsMm: { width: 800, height: 800, depth: 350 } }, { id: "upper:drawers", sourceModuleId: "drawers", position: { x: 1100, y: 1758, z: 175 }, dimensionsMm: { width: 600, height: 800, depth: 350 } }]) });
  it("places mezzanines directly above the main upper row", () => { const value = state(); value.upperRow.enabled = true; value.upperRow.mainCabinetHeight = 800; value.upperRow.mezzanineHeight = 400; const mezzanine = projectStateToScene(value).modules.find(module => module.id === "mezzanine:sink"); expect(mezzanine).toMatchObject({ tier: "mezzanine", position: { x: 400, y: 2358, z: 175 }, dimensionsMm: { width: 800, height: 400, depth: 350 } }) });
  it("omits upper geometry while the upper row is disabled", () => expect(projectStateToScene(state()).modules.every(module => module.tier === "lower")).toBe(true));
  it("omits mezzanines when their height is null", () => { const value = state(); value.upperRow.enabled = true; value.upperRow.mezzanineHeight = null; expect(projectStateToScene(value).modules.some(module => module.tier === "mezzanine")).toBe(false) });
  it("does not place upper cabinets above refrigerators or tall units", () => { const value = state(); value.upperRow.enabled = true; value.lowerRow.modules = [{ ...createModule("fridge", "fridge", 600), position: 0 }, { ...createModule("tall", "pantry_tall_unit", 600), position: 600 }, { ...createModule("base", "base_cabinet_doors", 600), position: 1200 }]; expect(projectStateToScene(value).modules.filter(module => module.tier === "upper").map(module => module.sourceModuleId)).toEqual(["base"]) });
  it("does not mutate Project State", () => { const value = state(); const before = structuredClone(value); projectStateToScene(value); expect(value).toEqual(before) });
});
