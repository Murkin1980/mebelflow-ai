import type { VisualAssetRef } from "../../../packages/visual-scene-engine/src/index.js";

export const VISUAL_ASSETS: Record<string, VisualAssetRef> = {
  "mf-base-cabinet-600": {
    assetId: "mf-base-cabinet-600",
    glbUrl: "/assets/mf-base-cabinet-600.glb",
    dimensionsMm: { width: 600, depth: 504, height: 720 },
  },
  "mf-kaykit-sink-600": {
    assetId: "mf-kaykit-sink-600",
    glbUrl: "/assets/mf-kaykit-sink-600.glb",
    dimensionsMm: { width: 2000, depth: 2041.903, height: 1801.626 },
    fit: "xyz",
  },
  "mf-kaykit-cooktop-600": {
    assetId: "mf-kaykit-cooktop-600",
    glbUrl: "/assets/mf-kaykit-cooktop-600.glb",
    dimensionsMm: { width: 2000, depth: 2287.86, height: 1207.69 },
    fit: "xyz",
  },
};
