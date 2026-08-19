export type ApplianceAssetLicense = {
  license: "CC0-1.0" | "CC-BY-4.0";
  sourceUrl: string;
  author?: string;
  attribution?: string;
};

export type ApplianceAsset = ApplianceAssetLicense & {
  assetId: string;
  category: "sink" | "faucet" | "cooktop" | "oven" | "dishwasher" | "refrigerator" | "washing_machine" | "hood";
  glbUrl: string;
  dimensionsMm: { width: number; depth: number; height: number };
};

// Add an asset only after its source page, commercial-use license, scale,
// orientation, file size and browser rendering have been verified.
export const APPLIANCE_ASSETS: Record<string, ApplianceAsset> = {
  "mf-kaykit-sink-600": {
    assetId: "mf-kaykit-sink-600", category: "sink", glbUrl: "/assets/mf-kaykit-sink-600.glb",
    dimensionsMm: { width: 600, depth: 560, height: 720 }, license: "CC0-1.0",
    sourceUrl: "https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0",
    author: "Kay Lousberg", attribution: "KayKit Restaurant Bits — CC0 1.0",
  },
  "mf-kaykit-cooktop-600": {
    assetId: "mf-kaykit-cooktop-600", category: "cooktop", glbUrl: "/assets/mf-kaykit-cooktop-600.glb",
    dimensionsMm: { width: 600, depth: 560, height: 720 }, license: "CC0-1.0",
    sourceUrl: "https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0",
    author: "Kay Lousberg", attribution: "KayKit Restaurant Bits — CC0 1.0",
  },
};
