import type { FurnitureProjectState } from "../../project-state/src/index.js";

export type Vec3 = { x: number; y: number; z: number };
export type VisualAssetRef = { assetId: string; glbUrl: string; dimensionsMm: { width: number; depth: number; height: number }; fit?: "xy" | "xyz" };
export type ScenePart = { kind: "corpus" | "facade" | "countertop"; position: Vec3; dimensionsMm: { width: number; depth: number; height: number }; color: string };
export type SceneModule = {
  id: string; sourceModuleId: string; moduleType: string; tier: "lower" | "upper" | "mezzanine"; kind: "box" | "glb"; position: Vec3;
  dimensionsMm: { width: number; depth: number; height: number }; color: string; glbUrl?: string; glbScale?: Vec3; parts: ScenePart[];
};
export type SceneDefinition = { modules: SceneModule[]; floor: boolean; walls: boolean; room: { width: number; height: number; depth: number } };

const styleColors = (presetId: string | null) => {
  const key = presetId?.toLowerCase() ?? "";
  if (key.includes("sage") || key.includes("green")) return { corpus: "#d8d5cf", facade: "#87947f", mezzanine: "#aab3a5", countertop: "#d6b987" };
  if (key.includes("dark") || key.includes("graphite")) return { corpus: "#c8c5c0", facade: "#3f4143", mezzanine: "#595b5c", countertop: "#a98968" };
  if (key.includes("wood") || key.includes("oak")) return { corpus: "#d7d1c7", facade: "#b88e63", mezzanine: "#c5a27f", countertop: "#ebe1d2" };
  return { corpus: "#d8d5cf", facade: "#eee9df", mezzanine: "#d8d2c6", countertop: "#b99067" };
};
const visualAssetId = (metadata: Record<string, unknown> | undefined) => typeof metadata?.visualAssetId === "string" && metadata.visualAssetId.trim() ? metadata.visualAssetId : undefined;
const conventionalVisualAssetId = (type: string, width: number) => {
  if (type === "base_cabinet_doors" && width === 600) return "mf-base-cabinet-600";
  if (type === "sink_cabinet" && width === 600) return "mf-kaykit-sink-600";
  if (type === "cooktop_base" && width === 600) return "mf-kaykit-cooktop-600";
  return undefined;
};
const validAsset = (asset: VisualAssetRef | undefined) => asset && asset.glbUrl.trim() && asset.dimensionsMm.width > 0 && asset.dimensionsMm.height > 0 && asset.dimensionsMm.depth > 0 ? asset : undefined;
const supportsUpperCabinet = (type: string) => type !== "fridge" && !type.includes("tall");
const cabinetParts = (position: Vec3, dimensionsMm: { width: number; depth: number; height: number }, colors: { corpus: string; facade: string; countertop?: string }, countertop = false): ScenePart[] => [
  { kind: "corpus", position, dimensionsMm, color: colors.corpus },
  { kind: "facade", position: { x: position.x, y: position.y, z: dimensionsMm.depth + 9 }, dimensionsMm: { width: Math.max(1, dimensionsMm.width - 8), depth: 18, height: Math.max(1, dimensionsMm.height - 8) }, color: colors.facade },
  ...(countertop ? [{ kind: "countertop" as const, position: { x: position.x, y: dimensionsMm.height + 19, z: dimensionsMm.depth / 2 }, dimensionsMm: { width: dimensionsMm.width, depth: dimensionsMm.depth + 20, height: 38 }, color: colors.countertop ?? colors.facade }] : []),
];

export function projectStateToScene(state: FurnitureProjectState, visualAssets: Record<string, VisualAssetRef> = {}): SceneDefinition {
  const colors = styleColors(state.style.presetId);
  const lowerModules: SceneModule[] = state.lowerRow.modules.map(module => {
    const dimensionsMm = { width: module.width, depth: module.depth, height: module.height };
    const position = { x: module.position + module.width / 2, y: module.height / 2, z: module.depth / 2 };
    const assetId = visualAssetId(module.metadata) ?? conventionalVisualAssetId(module.type, module.width);
    const asset = validAsset(visualAssets[assetId ?? ""]);
    return {
      id: module.id, sourceModuleId: module.id, moduleType: module.type, tier: "lower", kind: asset ? "glb" : "box", position, dimensionsMm, color: colors.facade,
      ...(asset ? { glbUrl: asset.glbUrl, glbScale: { x: dimensionsMm.width / asset.dimensionsMm.width, y: dimensionsMm.height / asset.dimensionsMm.height, z: asset.fit === "xyz" ? dimensionsMm.depth / asset.dimensionsMm.depth : 1 } } : {}),
      parts: cabinetParts(position, dimensionsMm, colors, true),
    };
  });
  const upperModules: SceneModule[] = [];
  if (state.upperRow.enabled) {
    const depth = 350;
    const supportedLowerModules = state.lowerRow.modules.filter(module => supportsUpperCabinet(module.type));
    const countertopTop = Math.max(720, ...supportedLowerModules.map(module => module.height)) + 38;
    const mainBottom = countertopTop + state.upperRow.apronHeight;
    for (const module of supportedLowerModules) {
      const mainDimensions = { width: module.width, depth, height: state.upperRow.mainCabinetHeight };
      const mainPosition = { x: module.position + module.width / 2, y: mainBottom + mainDimensions.height / 2, z: depth / 2 };
      upperModules.push({ id: `upper:${module.id}`, sourceModuleId: module.id, moduleType: `upper_${module.type}`, tier: "upper", kind: "box", position: mainPosition, dimensionsMm: mainDimensions, color: colors.facade, parts: cabinetParts(mainPosition, mainDimensions, colors) });
      if (state.upperRow.mezzanineHeight) {
        const mezzanineDimensions = { width: module.width, depth, height: state.upperRow.mezzanineHeight };
        const mezzaninePosition = { x: mainPosition.x, y: mainBottom + mainDimensions.height + mezzanineDimensions.height / 2, z: depth / 2 };
        upperModules.push({ id: `mezzanine:${module.id}`, sourceModuleId: module.id, moduleType: `mezzanine_${module.type}`, tier: "mezzanine", kind: "box", position: mezzaninePosition, dimensionsMm: mezzanineDimensions, color: colors.mezzanine, parts: cabinetParts(mezzaninePosition, mezzanineDimensions, { corpus: colors.corpus, facade: colors.mezzanine }) });
      }
    }
  }
  const modules = [...lowerModules, ...upperModules];
  return { modules, floor: true, walls: true, room: { width: state.room.wallWidth ?? Math.max(3000, lowerModules.reduce((sum, module) => sum + module.dimensionsMm.width, 0)), height: state.room.roomHeight ?? 2700, depth: 2200 } };
}
