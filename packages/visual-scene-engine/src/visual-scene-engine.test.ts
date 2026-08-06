import { describe, expect, it } from "vitest";
import { createInitialProject, createModule } from "../../project-state/src/index.js";
import { projectStateToScene, type VisualAssetRef } from "./index.js";

function state() {
  const value = createInitialProject("scene", "tenant");
  value.room.wallWidth = 3000;
  value.lowerRow.modules = [createModule("sink", "sink_cabinet", 600), { ...createModule("drawers", "base_cabinet_drawers", 800), position: 600 }];
  return value;
}

describe("projectStateToScene", () => {
  it("positions modules on X from their deterministic layout", () => {
    const scene = projectStateToScene(state());
    expect(scene.modules.map(item => item.position.x)).toEqual([300, 1000]);
    expect(scene.modules.every(item => item.position.y > 0 && item.position.z > 0)).toBe(true);
  });

  it("preserves project dimensions in millimetres", () => {
    expect(projectStateToScene(state()).modules[1]?.dimensionsMm).toEqual({ width: 800, depth: 560, height: 720 });
  });

  it("selects GLB only when the module references a registered asset", () => {
    const value = state();
    value.lowerRow.modules[0]!.metadata = { visualAssetId: "sink-v1" };
    const assets: Record<string, VisualAssetRef> = { "sink-v1": { assetId: "sink-v1", glbUrl: "/assets/sink.glb", dimensionsMm: { width: 600, depth: 560, height: 720 }, status: "accepted" } };
    const module = projectStateToScene(value, assets).modules[0]!;
    expect(module.kind).toBe("glb");
    expect(module.glbUrl).toBe("/assets/sink.glb");
  });

  it("falls back to parametric geometry for a missing asset", () => {
    const value = state();
    value.lowerRow.modules[0]!.metadata = { visualAssetId: "missing" };
    expect(projectStateToScene(value, {}).modules[0]?.kind).toBe("box");
  });

  it("never loads a catalog asset before acceptance", () => {
    const value = state();
    value.lowerRow.modules[0]!.metadata = { visualAssetId: "sink-v1" };
    const pending = { assetId: "sink-v1", glbUrl: "/assets/sink.glb", dimensionsMm: { width: 600, depth: 560, height: 720 }, status: "pending" };
    expect(projectStateToScene(value, { "sink-v1": pending as unknown as VisualAssetRef }).modules[0]?.kind).toBe("box");
  });


  it("creates a coordinated upper row when enabled", () => {
    const value = state();
    value.upperRow.enabled = true;
    const upper = projectStateToScene(value).modules.filter(item => item.row === "upper");
    expect(upper).toHaveLength(2);
    expect(upper[0]?.position.x).toBe(300);
  });
});
