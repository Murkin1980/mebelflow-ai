import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CommandSchema } from "../../command-schema/src/index.js";
import { applyCommand, createHistory, DomainError } from "./reducer.js";
import { createInitialProject, FurnitureProjectStateSchema } from "./schema.js";

const fresh = () => createHistory(createInitialProject("p1", "t1"));
const apply = (h: ReturnType<typeof fresh>, command: Record<string, unknown>) => applyCommand(h, command);
const wall = (h = fresh(), width = 3000) => apply(h, { commandId: "wall", type: "SET_WALL_WIDTH", payload: { width } });
const add = (h: ReturnType<typeof fresh>, id = "m1", width = 600, edge = "right") =>
  apply(h, {
    commandId: `add-${id}`,
    type: "ADD_MODULE",
    payload: { id, moduleType: "base_cabinet_doors", width, edge },
  });
describe("Project State v1", () => {
  it("creates valid state", () => expect(FurnitureProjectStateSchema.safeParse(fresh().present).success).toBe(true));
  it("unknown dimensions are null", () => expect(fresh().present.room.wallWidth).toBeNull());
  it("rejects wall below min", () => expect(() => wall(fresh(), 1199)).toThrow(z.ZodError));
  it("accepts min wall", () => expect(wall(fresh(), 1200).present.room.wallWidth).toBe(1200));
  it("accepts max wall", () => expect(wall(fresh(), 7000).present.room.wallWidth).toBe(7000));
  it("rejects wall above max", () => expect(() => wall(fresh(), 7001)).toThrow(z.ZodError));
  it("accepts min room height", () =>
    expect(
      apply(fresh(), { commandId: "h", type: "SET_ROOM_HEIGHT", payload: { height: 2200 } }).present.room.roomHeight,
    ).toBe(2200));
  it("accepts max room height", () =>
    expect(
      apply(fresh(), { commandId: "h", type: "SET_ROOM_HEIGHT", payload: { height: 4000 } }).present.room.roomHeight,
    ).toBe(4000));
  it("rejects bad room height", () =>
    expect(() => apply(fresh(), { commandId: "h", type: "SET_ROOM_HEIGHT", payload: { height: 4001 } })).toThrow(
      z.ZodError,
    ));
  it("rejects corrupted state", () =>
    expect(FurnitureProjectStateSchema.safeParse({ schemaVersion: 1 }).success).toBe(false));
});
describe("commands", () => {
  it("rejects unknown command", () =>
    expect(() => apply(fresh(), { commandId: "x", type: "DROP_TABLE" })).toThrow(z.ZodError));
  it("requires command id", () => expect(CommandSchema.safeParse({ type: "UNDO" }).success).toBe(false));
  it("adds module", () => expect(add(wall()).present.lowerRow.modules).toHaveLength(1));
  it("adds left", () => {
    let h = add(wall(), "a");
    h = add(h, "b", 400, "left");
    expect(h.present.lowerRow.modules.map((m) => m.id)).toEqual(["b", "a"]);
  });
  it("adds right", () => {
    let h = add(wall(), "a");
    h = add(h, "b");
    expect(h.present.lowerRow.modules.map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("recalculates positions", () => {
    let h = add(wall(), "a", 800);
    h = add(h, "b");
    expect(h.present.lowerRow.modules[1]?.position).toBe(800);
  });
  it("rejects duplicate ids", () => {
    const h = add(wall());
    expect(() =>
      apply(h, {
        commandId: "dup",
        type: "ADD_MODULE",
        payload: { id: "m1", moduleType: "filler", width: 100, edge: "right" },
      }),
    ).toThrow(DomainError);
  });
  it("rejects overflow", () => {
    const h = add(wall(fresh(), 1200), "a", 1000);
    expect(() => add(h, "b", 300)).toThrow(DomainError);
  });
  it("rejects wall shrink overflow", () => {
    let h = add(wall(), "x", 1000);
    h = add(h, "y", 1000);
    expect(() => apply(h, { commandId: "small", type: "SET_WALL_WIDTH", payload: { width: 1200 } })).toThrow(
      DomainError,
    );
  });
  it("removes module", () =>
    expect(
      apply(add(wall()), { commandId: "rm", type: "REMOVE_MODULE", payload: { id: "m1" } }).present.lowerRow.modules,
    ).toHaveLength(0));
  it("rejects missing remove", () =>
    expect(() => apply(wall(), { commandId: "rm", type: "REMOVE_MODULE", payload: { id: "no" } })).toThrow(
      DomainError,
    ));
  it("inserts after", () => {
    let h = add(wall(), "a");
    h = apply(h, {
      commandId: "ins",
      type: "INSERT_AFTER",
      referenceId: "a",
      payload: { id: "b", moduleType: "dishwasher_600", width: 600 },
    });
    expect(h.present.lowerRow.modules[1]?.id).toBe("b");
  });
  it("rejects missing reference", () =>
    expect(() =>
      apply(wall(), {
        commandId: "ins",
        type: "INSERT_AFTER",
        referenceId: "no",
        payload: { id: "b", moduleType: "dishwasher_600", width: 600 },
      }),
    ).toThrow(DomainError));
  it("moves left", () => {
    let h = add(wall(), "a");
    h = add(h, "b");
    h = apply(h, { commandId: "mv", type: "MOVE_TO_EDGE", payload: { id: "b", edge: "left" } });
    expect(h.present.lowerRow.modules[0]?.id).toBe("b");
  });
  it("moves right", () => {
    let h = add(wall(), "a");
    h = add(h, "b");
    h = apply(h, { commandId: "mv", type: "MOVE_TO_EDGE", payload: { id: "a", edge: "right" } });
    expect(h.present.lowerRow.modules[1]?.id).toBe("a");
  });
  it("rejects missing move", () =>
    expect(() => apply(wall(), { commandId: "mv", type: "MOVE_TO_EDGE", payload: { id: "no", edge: "left" } })).toThrow(
      DomainError,
    ));
  it("changes width", () =>
    expect(
      apply(add(wall()), { commandId: "cw", type: "CHANGE_WIDTH", payload: { id: "m1", width: 800 } }).present.lowerRow
        .modules[0]?.width,
    ).toBe(800));
  it("rejects zero width", () =>
    expect(() =>
      apply(add(wall()), { commandId: "cw", type: "CHANGE_WIDTH", payload: { id: "m1", width: 0 } }),
    ).toThrow(z.ZodError));
  it("rejects unknown module", () =>
    expect(() =>
      apply(wall(), {
        commandId: "bad",
        type: "ADD_MODULE",
        payload: { id: "x", moduleType: "spaceship", width: 600, edge: "right" },
      }),
    ).toThrow(z.ZodError));
  it("increments revision", () => expect(wall().present.historyMeta.revision).toBe(1));
  it("records command id", () => expect(wall().present.historyMeta.appliedCommandIds).toContain("wall"));
  it("is idempotent", () => {
    const h = add(wall());
    expect(
      apply(h, {
        commandId: "add-m1",
        type: "ADD_MODULE",
        payload: { id: "m1", moduleType: "base_cabinet_doors", width: 600, edge: "right" },
      }),
    ).toBe(h);
  });
  it("undo restores state", () =>
    expect(apply(add(wall()), { commandId: "u", type: "UNDO" }).present.lowerRow.modules).toHaveLength(0));
  it("redo restores state", () => {
    const h = add(wall());
    const u = apply(h, { commandId: "u", type: "UNDO" });
    expect(apply(u, { commandId: "r", type: "REDO" }).present.lowerRow.modules).toHaveLength(1);
  });
  it("empty undo preserves state", () => {
    const h = fresh();
    expect(apply(h, { commandId: "u", type: "UNDO" }).present).toEqual(h.present);
  });
  it("empty redo preserves state", () => {
    const h = fresh();
    expect(apply(h, { commandId: "r", type: "REDO" }).present).toEqual(h.present);
  });
  it("repeated undo id is idempotent", () => {
    const h = add(wall());
    const u = apply(h, { commandId: "u", type: "UNDO" });
    expect(apply(u, { commandId: "u", type: "UNDO" })).toBe(u);
  });
  it("new command clears redo", () => {
    const u = apply(add(wall()), { commandId: "u", type: "UNDO" });
    expect(add(u, "new").future).toHaveLength(0);
  });
  it("does not mutate input", () => {
    const h = wall();
    const before = structuredClone(h.present);
    add(h);
    expect(h.present).toEqual(before);
  });
  it("replay is deterministic", () => {
    const run = () => add(wall(), "sink", 800).present;
    expect(run()).toEqual(run());
  });
});
