import { describe, expect, it } from "vitest";
import { acceptVisualAsset, indexAcceptedAssets } from "./index.js";

const candidate = {
  assetId: "sink-cabinet-600-v1",
  moduleType: "sink_cabinet",
  dimensionsMm: { width: 600, depth: 560, height: 720 },
  glbUrl: "/models/sink-cabinet-600-v1.glb",
  validationReportUrl: "/reports/sink-cabinet-600-v1.json",
  sha256: "a".repeat(64),
  byteSize: 2_000_000,
  triangleCount: 45_000,
  drawCallCount: 34,
  format: "glTF-2.0" as const,
  pipeline: { exporter: "SketchUp GLB Export", optimizer: "glTF Transform", validator: "Khronos glTF Validator" },
};
const report = { issues: { numErrors: 0, numWarnings: 2, numInfos: 1, numHints: 0 } };

describe("visual asset acceptance", () => {
  it("accepts a valid optimized GLB package", () => {
    const result = acceptVisualAsset(candidate, report, { acceptedAt: "2026-08-06T00:00:00.000Z" });
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(result.asset.status).toBe("accepted");
  });

  it("rejects Khronos errors and project limit violations together", () => {
    const result = acceptVisualAsset(
      { ...candidate, byteSize: 20_000_000, triangleCount: 300_000 },
      { issues: { ...report.issues, numErrors: 1 } },
    );
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reasons.map(reason => reason.code)).toEqual(["KHRONOS_ERRORS", "FILE_TOO_LARGE", "TOO_MANY_TRIANGLES"]);
  });

  it("does not index rejected or unvalidated values", () => {
    const result = acceptVisualAsset(candidate, report, { acceptedAt: "2026-08-06T00:00:00.000Z" });
    if (!result.accepted) throw new Error("fixture should be accepted");
    expect(indexAcceptedAssets([result.asset])[candidate.assetId]?.glbUrl).toBe(candidate.glbUrl);
  });
});
