import { z } from "zod";

const DimensionsMmSchema = z.object({
  width: z.number().int().positive(),
  depth: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const AssetCandidateSchema = z.object({
  assetId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  moduleType: z.string().min(1),
  dimensionsMm: DimensionsMmSchema,
  glbUrl: z.string().refine(value => value.startsWith("/") || value.startsWith("https://"), "GLB URL must be root-relative or HTTPS"),
  validationReportUrl: z.string().refine(value => value.startsWith("/") || value.startsWith("https://"), "Report URL must be root-relative or HTTPS"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteSize: z.number().int().positive(),
  triangleCount: z.number().int().nonnegative(),
  drawCallCount: z.number().int().nonnegative(),
  format: z.literal("glTF-2.0"),
  pipeline: z.object({
    exporter: z.string().min(1),
    optimizer: z.string().min(1),
    validator: z.string().min(1),
  }),
});

export const KhronosValidationReportSchema = z.object({
  issues: z.object({
    numErrors: z.number().int().nonnegative(),
    numWarnings: z.number().int().nonnegative().default(0),
    numInfos: z.number().int().nonnegative().default(0),
    numHints: z.number().int().nonnegative().default(0),
  }),
}).passthrough();

export type AssetCandidate = z.infer<typeof AssetCandidateSchema>;
export type KhronosValidationReport = z.infer<typeof KhronosValidationReportSchema>;

export type AssetAcceptanceLimits = {
  maxBytes: number;
  maxTriangles: number;
  maxDrawCalls: number;
  maxWarnings: number;
};

export const DEFAULT_ASSET_LIMITS: AssetAcceptanceLimits = {
  maxBytes: 8 * 1024 * 1024,
  maxTriangles: 150_000,
  maxDrawCalls: 120,
  maxWarnings: 20,
};

export type AssetRejectionCode =
  | "INVALID_CANDIDATE"
  | "INVALID_VALIDATION_REPORT"
  | "KHRONOS_ERRORS"
  | "TOO_MANY_WARNINGS"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_TRIANGLES"
  | "TOO_MANY_DRAW_CALLS";

export type AcceptedVisualAsset = AssetCandidate & {
  status: "accepted";
  acceptedAt: string;
};

export type AssetAcceptance =
  | { accepted: true; asset: AcceptedVisualAsset }
  | { accepted: false; reasons: Array<{ code: AssetRejectionCode; message: string }> };

export function acceptVisualAsset(
  candidateInput: unknown,
  reportInput: unknown,
  options: { limits?: Partial<AssetAcceptanceLimits>; acceptedAt?: string } = {},
): AssetAcceptance {
  const candidateResult = AssetCandidateSchema.safeParse(candidateInput);
  if (!candidateResult.success) {
    return { accepted: false, reasons: [{ code: "INVALID_CANDIDATE", message: candidateResult.error.issues[0]?.message ?? "Invalid asset candidate" }] };
  }
  const reportResult = KhronosValidationReportSchema.safeParse(reportInput);
  if (!reportResult.success) {
    return { accepted: false, reasons: [{ code: "INVALID_VALIDATION_REPORT", message: reportResult.error.issues[0]?.message ?? "Invalid Khronos report" }] };
  }

  const candidate = candidateResult.data;
  const report = reportResult.data;
  const limits = { ...DEFAULT_ASSET_LIMITS, ...options.limits };
  const reasons: Array<{ code: AssetRejectionCode; message: string }> = [];
  if (report.issues.numErrors > 0) reasons.push({ code: "KHRONOS_ERRORS", message: `Khronos Validator errors: ${report.issues.numErrors}` });
  if (report.issues.numWarnings > limits.maxWarnings) reasons.push({ code: "TOO_MANY_WARNINGS", message: `Warnings ${report.issues.numWarnings} exceed ${limits.maxWarnings}` });
  if (candidate.byteSize > limits.maxBytes) reasons.push({ code: "FILE_TOO_LARGE", message: `Bytes ${candidate.byteSize} exceed ${limits.maxBytes}` });
  if (candidate.triangleCount > limits.maxTriangles) reasons.push({ code: "TOO_MANY_TRIANGLES", message: `Triangles ${candidate.triangleCount} exceed ${limits.maxTriangles}` });
  if (candidate.drawCallCount > limits.maxDrawCalls) reasons.push({ code: "TOO_MANY_DRAW_CALLS", message: `Draw calls ${candidate.drawCallCount} exceed ${limits.maxDrawCalls}` });
  if (reasons.length) return { accepted: false, reasons };

  return {
    accepted: true,
    asset: { ...candidate, status: "accepted", acceptedAt: options.acceptedAt ?? new Date().toISOString() },
  };
}

export function indexAcceptedAssets(assets: readonly AcceptedVisualAsset[]) {
  return Object.fromEntries(assets.map(asset => [asset.assetId, asset]));
}
