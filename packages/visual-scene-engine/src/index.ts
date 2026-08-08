import type { FurnitureProjectState } from "../../project-state/src/index.js";

export type Vec3 = { x: number; y: number; z: number };
export type VisualAssetRef = { assetId: string; glbUrl: string; dimensionsMm: { width: number; depth: number; height: number } };
export type ScenePart = { kind: "corpus" | "facade" | "countertop"; position: Vec3; dimensionsMm: { width: number; depth: number; height: number }; color: string };
export type SceneModule = {
  id: string; sourceModuleId: string; moduleType: string; kind: "box" | "glb"; position: Vec3;
  dimensionsMm: { width: number; depth: number; height: number }; color: string; glbUrl?: string; glbScale?: Vec3; parts: ScenePart[];
};
export type SceneDefinition = { modules: SceneModule[]; floor: boolean; walls: boolean; room: { width: number; height: number; depth: number } };

const styleColors = (presetId: string | null) => {
  const key = presetId?.toLowerCase() ?? "";
  if (key.includes("sage") || key.includes("green")) return { corpus: "#d8d5cf", facade: "#87947f", countertop: "#d6b987" };
  if (key.includes("dark") || key.includes("graphite")) return { corpus: "#c8c5c0", facade: "#3f4143", countertop: "#a98968" };
  if (key.includes("wood") || key.includes("oak")) return { corpus: "#d7d1c7", facade: "#b88e63", countertop: "#ebe1d2" };
  return { corpus: "#d8d5cf", facade: "#eee9df", countertop: "#b99067" };
};
const visualAssetId = (metadata: Record<string, unknown> | undefined) => typeof metadata?.visualAssetId === "string" && metadata.visualAssetId.trim() ? metadata.visualAssetId : undefined;
const validAsset = (asset: VisualAssetRef | undefined) => asset && asset.glbUrl.trim() && asset.dimensionsMm.width > 0 && asset.dimensionsMm.height > 0 && asset.dimensionsMm.depth > 0 ? asset : undefined;

export function projectStateToScene(state: FurnitureProjectState, visualAssets: Record<string, VisualAssetRef> = {}): SceneDefinition {
  const colors = styleColors(state.style.presetId);
  const modules: SceneModule[] = state.lowerRow.modules.map(module => {
    const dimensionsMm = { width: module.width, depth: module.depth, height: module.height };
    const position = { x: module.position + module.width / 2, y: module.height / 2, z: module.depth / 2 };
    const asset = validAsset(visualAssets[visualAssetId(module.metadata) ?? ""]);
    return {
      id: module.id, sourceModuleId: module.id, moduleType: module.type, kind: asset ? "glb" : "box", position, dimensionsMm, color: colors.facade,
      ...(asset ? { glbUrl: asset.glbUrl, glbScale: { x: dimensionsMm.width / asset.dimensionsMm.width, y: dimensionsMm.height / asset.dimensionsMm.height, z: dimensionsMm.depth / asset.dimensionsMm.depth } } : {}),
      parts: [
        { kind: "corpus", position, dimensionsMm, color: colors.corpus },
        { kind: "facade", position: { x: position.x, y: position.y, z: module.depth + 9 }, dimensionsMm: { width: Math.max(1, module.width - 8), depth: 18, height: Math.max(1, module.height - 8) }, color: colors.facade },
        { kind: "countertop", position: { x: position.x, y: module.height + 19, z: module.depth / 2 }, dimensionsMm: { width: module.width, depth: module.depth + 20, height: 38 }, color: colors.countertop },
      ],
    };
  });
  return { modules, floor: true, walls: true, room: { width: state.room.wallWidth ?? Math.max(3000, modules.reduce((sum, module) => sum + module.dimensionsMm.width, 0)), height: state.room.roomHeight ?? 2700, depth: 2200 } };
}
