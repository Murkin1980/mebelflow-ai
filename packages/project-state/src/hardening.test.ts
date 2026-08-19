import { describe, expect, it } from "vitest";
import { CommandSchema } from "../../command-schema/src/index.js";
import { createModule } from "./catalog.js";
import { MAX_APPLIED_COMMAND_IDS, MAX_HISTORY, MAX_METADATA_BYTES } from "./limits.js";
import { MemorySceneStoreAdapter } from "./memory-adapter.js";
import { applyCommand, createHistory } from "./reducer.js";
import { createInitialProject, FurnitureModuleSchema } from "./schema.js";
import { toMillimetres } from "./units.js";

const fresh = () => createHistory(createInitialProject("p1", "t1"));

describe("strict command validation", () => {
  it("rejects unknown top-level keys", () => {
    expect(CommandSchema.safeParse({ commandId: "x", type: "UNDO", evil: "injected" }).success).toBe(false);
  });
  it("rejects unknown payload keys", () => {
    expect(
      CommandSchema.safeParse({
        commandId: "x",
        type: "ADD_MODULE",
        payload: { id: "m", moduleType: "sink_cabinet", width: 600, edge: "right", hacked: true },
      }).success,
    ).toBe(false);
  });
  it("accepts clean commands", () => {
    expect(CommandSchema.safeParse({ commandId: "x", type: "UNDO" }).success).toBe(true);
    expect(
      CommandSchema.safeParse({
        commandId: "x",
        type: "ADD_MODULE",
        payload: { id: "m", moduleType: "sink_cabinet", width: 600, edge: "right" },
      }).success,
    ).toBe(true);
    expect(
      CommandSchema.safeParse({ commandId: "x", type: "GENERATE_UPPER_ROW", payload: { preferredMainHeight: 800 } })
        .success,
    ).toBe(true);
  });
});

describe("idempotency across session restore", () => {
  it("rejects replayed command after serialize/restore", () => {
    const wall = { commandId: "wall", type: "SET_WALL_WIDTH", payload: { width: 3000 } };
    const applied = applyCommand(fresh(), wall);
    const restored = createHistory(JSON.parse(JSON.stringify(applied.present)));
    expect(restored.processedCommandIds).toEqual(["wall"]);
    const replay = applyCommand(restored, wall);
    expect(replay).toBe(restored);
    expect(replay.present.historyMeta.revision).toBe(1);
  });
  it("still applies new commands after restore", () => {
    const applied = applyCommand(fresh(), { commandId: "wall", type: "SET_WALL_WIDTH", payload: { width: 3000 } });
    const restored = createHistory(JSON.parse(JSON.stringify(applied.present)));
    const next = applyCommand(restored, {
      commandId: "add",
      type: "ADD_MODULE",
      payload: { id: "m", moduleType: "sink_cabinet", width: 600, edge: "right" },
    });
    expect(next.present.lowerRow.modules).toHaveLength(1);
    expect(next.present.historyMeta.revision).toBe(2);
  });
});

describe("history caps", () => {
  it("caps past at MAX_HISTORY and undo exhausts exactly", () => {
    let history = fresh();
    for (let i = 0; i < MAX_HISTORY + 50; i++) {
      history = applyCommand(history, { commandId: `c${i}`, type: "SET_ROOM_HEIGHT", payload: { height: 2300 } });
    }
    expect(history.past).toHaveLength(MAX_HISTORY);
    for (let i = 0; i < MAX_HISTORY; i++) {
      history = applyCommand(history, { commandId: `u${i}`, type: "UNDO" });
    }
    const empty = applyCommand(history, { commandId: "u-final", type: "UNDO" });
    expect(empty.present).toEqual(history.present);
    expect(empty.past).toEqual(history.past);
    expect(empty.future).toEqual(history.future);
  });

  it("caps future at MAX_HISTORY", () => {
    let history = fresh();
    for (let i = 0; i < 2; i++) {
      history = applyCommand(history, { commandId: `c${i}`, type: "SET_ROOM_HEIGHT", payload: { height: 2300 } });
    }
    for (let i = 0; i < MAX_HISTORY + 50; i++) {
      history = applyCommand(history, { commandId: `w${i}`, type: "SET_WALL_WIDTH", payload: { width: 3000 } });
    }
    for (let i = 0; i < MAX_HISTORY + 52; i++) {
      history = applyCommand(history, { commandId: `u${i}`, type: "UNDO" });
    }
    expect(history.future).toHaveLength(MAX_HISTORY);
    const redo = applyCommand(history, { commandId: "r0", type: "REDO" });
    expect(redo.present.room.wallWidth).toBe(3000);
  });

  it("caps appliedCommandIds and processedCommandIds at MAX_APPLIED_COMMAND_IDS", () => {
    let history = fresh();
    for (let i = 0; i < MAX_APPLIED_COMMAND_IDS + 25; i++) {
      history = applyCommand(history, { commandId: `c${i}`, type: "SET_ROOM_HEIGHT", payload: { height: 2300 } });
    }
    expect(history.present.historyMeta.appliedCommandIds).toHaveLength(MAX_APPLIED_COMMAND_IDS);
    expect(history.processedCommandIds).toHaveLength(MAX_APPLIED_COMMAND_IDS);
    expect(history.present.historyMeta.appliedCommandIds[0]).toBe("c25");
    expect(history.present.historyMeta.appliedCommandIds.at(-1)).toBe(`c${MAX_APPLIED_COMMAND_IDS + 24}`);
    // команды за пределами окна идемпотентности применяются повторно — принятый trade-off кэпа
    const old = applyCommand(history, { commandId: "c0", type: "SET_ROOM_HEIGHT", payload: { height: 2300 } });
    expect(old.present.historyMeta.revision).toBe(history.present.historyMeta.revision + 1);
  });

  it("restore caps processedCommandIds for legacy oversized state", () => {
    const state = createInitialProject("p1", "t1");
    state.historyMeta.appliedCommandIds = Array.from({ length: MAX_APPLIED_COMMAND_IDS + 100 }, (_, i) => `old-${i}`);
    const history = createHistory(state);
    expect(history.processedCommandIds).toHaveLength(MAX_APPLIED_COMMAND_IDS);
    expect(history.processedCommandIds[0]).toBe("old-100");
  });

  it("memory adapter caps its undo/redo history", () => {
    const adapter = new MemorySceneStoreAdapter();
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      adapter.createNode(createModule(`m${i}`, "sink_cabinet", 600));
    }
    for (let i = 0; i < MAX_HISTORY; i++) {
      adapter.undo();
    }
    expect(adapter.listNodes()).toHaveLength(10);
    adapter.undo();
    expect(adapter.listNodes()).toHaveLength(10);
  });
});

describe("metadata size cap", () => {
  it("rejects oversized module metadata", () => {
    const module = createModule("m", "sink_cabinet", 600);
    module.metadata = { blob: "x".repeat(MAX_METADATA_BYTES + 10) };
    expect(FurnitureModuleSchema.safeParse(module).success).toBe(false);
  });
  it("accepts small metadata", () => {
    const module = createModule("m", "sink_cabinet", 600);
    module.metadata = { drawerCount: 3 };
    expect(FurnitureModuleSchema.safeParse(module).success).toBe(true);
  });
});

describe("unit normalization", () => {
  it("accepts strings from LLM/STT", () => {
    expect(toMillimetres("3", "m")).toBe(3000);
    expect(toMillimetres("2.5", "cm")).toBe(25);
  });
  it("rounds float artifacts within tolerance", () => {
    expect(toMillimetres(1.005, "m")).toBe(1005);
    expect(toMillimetres(2.7, "m")).toBe(2700);
  });
  it("rejects genuinely fractional millimetres", () => {
    expect(() => toMillimetres(0.05, "cm")).toThrow();
    expect(() => toMillimetres(1.25, "cm")).toThrow();
  });
  it("rejects garbage strings", () => {
    expect(() => toMillimetres("abc", "m")).toThrow();
  });
});
