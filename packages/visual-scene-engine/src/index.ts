import type { FurnitureModule, FurnitureProjectState } from "../../project-state/src/schema.js";
import type { AcceptedVisualAsset } from "../../visual-asset-library/src/index.js";

export type Vector3Mm = { x: number; y: number; z: number };
export type VisualAssetRef = Pick<AcceptedVisualAsset, "assetId" | "glbUrl" | "dimensionsMm" | "status">;
export type SceneModule = {
  id: string;
  sourceModuleId: string;
  row: "lower" | "upper";
  kind: "box" | "glb";
  moduleType: FurnitureModule["type"];
  position: Vector3Mm;
  dimensionsMm: { width: number; depth: number; height: number };
  colors: { carcass: string; facade: string; countertop: string };
  glbUrl?: string;
  assetDimensionsMm?: VisualAssetRef["dimensionsMm"];
};
export type SceneDefinition = {
  modules: SceneModule[];
  floor: { width: number; depth: number };
  wall: { width: number; height: number };
};

const STYLE_COLORS: Record<string, SceneModule["colors"]> = {
  modern_minimal: { carcass: "#e7e4dd", facade: "#d6c6ad", countertop: "#6e655b" },
  japandi: { carcass: "#e8e0d2", facade: "#c7a77b", countertop: "#5d6258" },
  neoclassic: { carcass: "#eee9dd", facade: "#b9aa9a", countertop: "#70655d" },
  warm_modern: { carcass: "#d7c5ac", facade: "#6c4b37", countertop: "#252827" },
  scandinavian: { carcass: "#f5f4ef", facade: "#d8bc8c", countertop: "#737a78" },
};
const DEFAULT_COLORS = { carcass: "#e8e5de", facade: "#f5f3ee", countertop: "#7d746b" };

function assetFor(module: FurnitureModule, assets: Record<string, VisualAssetRef>) {
  const visualAssetId = typeof module.metadata?.visualAssetId === "string" ? module.metadata.visualAssetId : undefined;
  const asset = visualAssetId ? assets[visualAssetId] : undefined;
  return asset?.status === "accepted" ? asset : undefined;
}

function makeSceneModule(
  module: FurnitureModule,
  row: "lower" | "upper",
  y: number,
  depth: number,
  height: number,
  colors: SceneModule["colors"],
  assets: Record<string, VisualAssetRef>,
): SceneModule {
  const asset = assetFor(module, assets);
  return {
    id: row === "lower" ? module.id : `upper:${module.id}`,
    sourceModuleId: module.id,
    row,
    kind: asset ? "glb" : "box",
    moduleType: module.type,
    position: { x: module.position + module.width / 2, y, z: depth / 2 },
    dimensionsMm: { width: module.width, depth, height },
    colors,
    ...(asset ? { glbUrl: asset.glbUrl, assetDimensionsMm: asset.dimensionsMm } : {}),
  };
}

export function projectStateToScene(
  state: FurnitureProjectState,
  visualAssets: Record<string, VisualAssetRef> = {},
): SceneDefinition {
  const wallWidth = state.room.wallWidth ?? Math.max(3000, state.lowerRow.modules.reduce((sum, item) => sum + item.width, 0));
  const wallHeight = state.room.roomHeight ?? 2700;
  const styleId = state.style.presetId?.split(":")[0] ?? "";
  const colors = STYLE_COLORS[styleId] ?? DEFAULT_COLORS;
  const modules = state.lowerRow.modules.map(module => makeSceneModule(
    module,
    "lower",
    module.height / 2 + Math.max(0, state.lowerRow.totalHeight - module.height - 40),
    module.depth,
    module.height,
    colors,
    visualAssets,
  ));

  if (state.upperRow.enabled) {
    const upperBottom = state.lowerRow.totalHeight + state.upperRow.apronHeight;
    for (const module of state.lowerRow.modules.filter(item => !["fridge", "fridge_tall_unit", "oven_tall_unit", "pantry_tall_unit", "utility_tall_unit"].includes(item.type))) {
      modules.push(makeSceneModule(module, "upper", upperBottom + state.upperRow.mainCabinetHeight / 2, 340, state.upperRow.mainCabinetHeight, colors, visualAssets));
    }
  }

  return {
    modules,
    floor: { width: wallWidth + 1200, depth: 2400 },
    wall: { width: wallWidth, height: wallHeight },
  };
}
