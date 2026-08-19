import { createInitialProject, type FurnitureProjectState, FurnitureProjectStateSchema } from "./schema.js";

export type RecoveryResult = { state: FurnitureProjectState; recovered: boolean; reason?: string };

export function migrateProjectState(input: unknown): FurnitureProjectState {
  if (typeof input !== "object" || input === null) throw new Error("State must be an object.");
  const candidate = structuredClone(input) as Record<string, unknown>;
  if (candidate.schemaVersion === undefined) candidate.schemaVersion = 1;
  if (candidate.projectId === undefined && typeof candidate.id === "string") candidate.projectId = candidate.id;
  return FurnitureProjectStateSchema.parse(candidate);
}

export function recoverProjectState(input: unknown, projectId: string, tenantId: string): RecoveryResult {
  try {
    return { state: migrateProjectState(input), recovered: false };
  } catch (error) {
    const state = createInitialProject(projectId, tenantId);
    state.warnings.push({
      code: "state_recovered",
      message: "Повреждённое состояние не применено. Создан безопасный новый проект.",
    });
    return { state, recovered: true, reason: error instanceof Error ? error.message : "Unknown state error" };
  }
}
