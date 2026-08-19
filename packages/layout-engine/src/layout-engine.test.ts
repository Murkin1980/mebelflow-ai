import { describe, expect, it } from "vitest";
import { createInitialProject, type FurnitureProjectState } from "../../project-state/src/schema.js";
import {
  applyLayoutCommand,
  calculateAvailableUpperHeight,
  calculateRemainingWidth,
  generateUpperRow,
  LayoutError,
} from "./index.js";

const initial = (wall: number | null = 3000, height: number | null = 2700) => {
  const state = createInitialProject("p", "t");
  state.room.wallWidth = wall;
  state.room.roomHeight = height;
  return state;
};
let id = 0;
const command = (type: string, payload: object = {}, extra: object = {}) =>
  ({ commandId: `c${++id}`, type, payload, ...extra }) as never;
const apply = (state: FurnitureProjectState, type: string, payload: object = {}, extra: object = {}) =>
  applyLayoutCommand(state, command(type, payload, extra));
describe("lower row", () => {
  it("calculates empty remaining width", () => expect(calculateRemainingWidth(initial())).toBe(3000));
  it("returns null without wall", () => expect(calculateRemainingWidth(initial(null))).toBeNull());
  it("adds right", () =>
    expect(
      apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state.lowerRow
        .modules[0]?.id,
    ).toBe("a"));
  it("adds left", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 400, edge: "left" }).state;
    expect(s.lowerRow.modules.map((m) => m.id)).toEqual(["b", "a"]);
  });
  it("inserts before", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(
      s,
      "INSERT_BEFORE",
      { id: "b", moduleType: "base_cabinet_doors", width: 400 },
      { referenceId: "a" },
    ).state;
    expect(s.lowerRow.modules.map((m) => m.id)).toEqual(["b", "a"]);
  });
  it("inserts after", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "INSERT_AFTER", { id: "b", moduleType: "dishwasher_600", width: 600 }, { referenceId: "a" }).state;
    expect(s.lowerRow.modules.map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("removes", () => {
    const s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    expect(apply(s, "REMOVE_MODULE", { id: "a" }).state.lowerRow.modules).toHaveLength(0);
  });
  it("moves left", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 400, edge: "right" }).state;
    expect(apply(s, "MOVE_LEFT", { id: "b" }).state.lowerRow.modules.map((m) => m.id)).toEqual(["b", "a"]);
  });
  it("moves right", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 400, edge: "right" }).state;
    expect(apply(s, "MOVE_RIGHT", { id: "a" }).state.lowerRow.modules.map((m) => m.id)).toEqual(["b", "a"]);
  });
  it("reports a no-op move at either edge", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "sink", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "cabinet", moduleType: "base_cabinet_doors", width: 400, edge: "right" }).state;
    expect(() => apply(s, "MOVE_LEFT", { id: "sink" })).toThrow("уже находится слева");
    expect(() => apply(s, "MOVE_RIGHT", { id: "cabinet" })).toThrow("уже находится справа");
  });
  it("moves to edge", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 400, edge: "right" }).state;
    expect(apply(s, "MOVE_TO_EDGE", { id: "a", edge: "right" }).state.lowerRow.modules.map((m) => m.id)).toEqual([
      "b",
      "a",
    ]);
  });
  it("reports a no-op move to the current edge", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "sink", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "cabinet", moduleType: "base_cabinet_doors", width: 400, edge: "right" }).state;
    expect(() => apply(s, "MOVE_TO_EDGE", { id: "sink", edge: "left" })).toThrow("левого края");
    expect(() => apply(s, "MOVE_TO_EDGE", { id: "cabinet", edge: "right" })).toThrow("правого края");
  });
  it("changes width", () => {
    const s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    expect(apply(s, "CHANGE_WIDTH", { id: "a", width: 800 }).state.lowerRow.modules[0]?.width).toBe(800);
  });
  it("normalizes positions", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 800, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 400, edge: "right" }).state;
    expect(s.lowerRow.modules.map((m) => m.position)).toEqual([0, 800]);
  });
  it("rejects overflow", () => {
    const s = apply(initial(1200), "ADD_MODULE", {
      id: "a",
      moduleType: "sink_cabinet",
      width: 1000,
      edge: "right",
    }).state;
    expect(() =>
      apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 300, edge: "right" }),
    ).toThrow(LayoutError);
  });
  it("rejects invalid appliance width", () =>
    expect(() =>
      apply(initial(), "ADD_MODULE", { id: "d", moduleType: "dishwasher_600", width: 450, edge: "right" }),
    ).toThrow(LayoutError));
  it("rejects middle filler", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 400, edge: "right" }).state;
    expect(() => apply(s, "INSERT_AFTER", { id: "f", moduleType: "filler", width: 100 }, { referenceId: "a" })).toThrow(
      LayoutError,
    );
  });
  it("rejects moving filler into middle", () => {
    let s = apply(initial(), "ADD_MODULE", { id: "f", moduleType: "filler", width: 100, edge: "left" }).state;
    s = apply(s, "ADD_MODULE", { id: "a", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    s = apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 400, edge: "right" }).state;
    expect(() => apply(s, "MOVE_RIGHT", { id: "f" })).toThrow(LayoutError);
  });
});
describe("warnings", () => {
  it("warns technology gap", () => {
    const s = apply(initial(1200), "ADD_MODULE", {
      id: "a",
      moduleType: "base_cabinet_doors",
      width: 1000,
      edge: "right",
    }).state;
    expect(
      apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 150, edge: "right" }).warnings.some(
        (w) => w.code === "technology_gap",
      ),
    ).toBe(true);
  });
  it("warns filler recommendation", () => {
    const s = apply(initial(1200), "ADD_MODULE", {
      id: "a",
      moduleType: "base_cabinet_doors",
      width: 900,
      edge: "right",
    }).state;
    expect(
      apply(s, "ADD_MODULE", { id: "b", moduleType: "base_cabinet_doors", width: 200, edge: "right" }).warnings.some(
        (w) => w.code === "filler_recommended",
      ),
    ).toBe(true);
  });
  it("warns module space", () =>
    expect(apply(initial(3000), "SET_WALL_WIDTH", { width: 3000 }).warnings[0]?.code).toBe("module_space_available"));
  it("warns dishwasher away from sink", () =>
    expect(
      apply(initial(), "ADD_MODULE", {
        id: "d",
        moduleType: "dishwasher_600",
        width: 600,
        edge: "right",
      }).warnings.some((w) => w.code === "dishwasher_away_from_sink"),
    ).toBe(true));
  it("does not warn adjacent dishwasher", () => {
    const s = apply(initial(), "ADD_MODULE", { id: "s", moduleType: "sink_cabinet", width: 600, edge: "right" }).state;
    expect(
      apply(s, "ADD_MODULE", { id: "d", moduleType: "dishwasher_600", width: 600, edge: "right" }).warnings.some(
        (w) => w.code === "dishwasher_away_from_sink",
      ),
    ).toBe(false);
  });
});
describe("upper row", () => {
  it("calculates available height", () => expect(calculateAvailableUpperHeight(initial(3000, 2700))).toBe(1170));
  it("requires room height", () => expect(() => generateUpperRow(initial(3000, null))).toThrow(LayoutError));
  it("generates standard main row", () => expect(generateUpperRow(initial()).upperRow.mainCabinetHeight).toBe(900));
  it("uses preferred height", () => expect(generateUpperRow(initial(), 800).upperRow.mainCabinetHeight).toBe(800));
  it("adds valid mezzanine", () => expect(generateUpperRow(initial(3000, 3000)).upperRow.mezzanineHeight).toBe(570));
  it("omits too-small mezzanine", () => expect(generateUpperRow(initial()).upperRow.mezzanineHeight).toBeNull());
  it("rejects oversized mezzanine", () => {
    const s = generateUpperRow(initial());
    expect(() => apply(s, "SET_MEZZANINE_HEIGHT", { height: 400 })).toThrow(LayoutError);
  });
  it("accepts apron boundary", () =>
    expect(apply(initial(), "SET_APRON_HEIGHT", { height: 550 }).state.upperRow.apronHeight).toBe(550));
});
