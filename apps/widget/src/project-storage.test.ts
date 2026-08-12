import { describe, expect, it } from "vitest";
import { createInitialProject, createModule } from "../../../packages/project-state/src/index.js";
import { loadStoredProject, projectStorageKey, storeProject, type StorageLike } from "./project-storage.js";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: StorageLike = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  return { storage, values };
}

describe("widget project storage", () => {
  it("round-trips a valid project state", () => { const { storage } = memoryStorage(); const state = createInitialProject("project-1", "tenant-1"); state.room.wallWidth = 3000; state.lowerRow.modules = [createModule("sink", "sink_cabinet", 600)]; expect(storeProject(storage, state)).toBe(true); expect(loadStoredProject(storage, "tenant-1")).toEqual(state); });
  it("isolates projects by tenant", () => { const state = createInitialProject("project-1", "tenant-1"); const { storage } = memoryStorage({ [projectStorageKey("tenant-2")]: JSON.stringify(state) }); expect(loadStoredProject(storage, "tenant-2")).toBeUndefined(); });
  it("removes corrupt or invalid stored data", () => { const key = projectStorageKey("tenant-1"); const { storage, values } = memoryStorage({ [key]: "{bad json" }); expect(loadStoredProject(storage, "tenant-1")).toBeUndefined(); expect(values.has(key)).toBe(false); });
  it("fails closed when browser storage is unavailable", () => { const unavailable: StorageLike = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("blocked"); } }; const state = createInitialProject("project-1", "tenant-1"); expect(loadStoredProject(unavailable, "tenant-1")).toBeUndefined(); expect(storeProject(unavailable, state)).toBe(false); });
});
