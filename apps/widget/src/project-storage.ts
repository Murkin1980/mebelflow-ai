import { type FurnitureProjectState, FurnitureProjectStateSchema } from "../../../packages/project-state/src/index.js";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const projectStorageKey = (tenantId: string) => `mebelflow:project-state:v1:${tenantId}`;

export function loadStoredProject(storage: StorageLike, tenantId: string): FurnitureProjectState | undefined {
  try {
    const raw = storage.getItem(projectStorageKey(tenantId));
    if (!raw) return undefined;
    const parsed = FurnitureProjectStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.tenantId !== tenantId) {
      storage.removeItem(projectStorageKey(tenantId));
      return undefined;
    }
    return parsed.data;
  } catch {
    try {
      storage.removeItem(projectStorageKey(tenantId));
    } catch {
      /* storage may be unavailable */
    }
    return undefined;
  }
}

export function storeProject(storage: StorageLike, state: FurnitureProjectState): boolean {
  try {
    storage.setItem(projectStorageKey(state.tenantId), JSON.stringify(FurnitureProjectStateSchema.parse(state)));
    return true;
  } catch {
    return false;
  }
}
