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
  it("does not mutate Project State", () => { const value = state(); const before = structuredClone(value); projectStateToScene(value); expect(value).toEqual(before) });
});
