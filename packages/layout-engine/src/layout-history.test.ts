import { describe, expect, it } from "vitest";
import { applyCommand as applyStageOne, createHistory, DomainError } from "../../project-state/src/reducer.js";
import { createInitialProject } from "../../project-state/src/schema.js";
import { applyLayoutCommandToHistory } from "./index.js";

const fresh = () => {
  const state = createInitialProject("p", "t");
  state.room.wallWidth = 3000;
  return createHistory(state);
};
const add = {
  commandId: "add",
  type: "ADD_MODULE",
  payload: { id: "sink", moduleType: "sink_cabinet", width: 600, edge: "left" },
};
describe("layout history", () => {
  it("applies Stage 2 through history", () =>
    expect(applyLayoutCommandToHistory(fresh(), add).present.lowerRow.modules).toHaveLength(1));
  it("increments revision", () =>
    expect(applyLayoutCommandToHistory(fresh(), add).present.historyMeta.revision).toBe(1));
  it("records command id", () =>
    expect(applyLayoutCommandToHistory(fresh(), add).present.historyMeta.appliedCommandIds).toContain("add"));
  it("is idempotent", () => {
    const h = applyLayoutCommandToHistory(fresh(), add);
    expect(applyLayoutCommandToHistory(h, add)).toBe(h);
  });
  it("undoes layout command", () => {
    const h = applyLayoutCommandToHistory(fresh(), add);
    expect(applyLayoutCommandToHistory(h, { commandId: "u", type: "UNDO" }).present.lowerRow.modules).toHaveLength(0);
  });
  it("redoes layout command", () => {
    const h = applyLayoutCommandToHistory(fresh(), add);
    const u = applyLayoutCommandToHistory(h, { commandId: "u", type: "UNDO" });
    expect(applyLayoutCommandToHistory(u, { commandId: "r", type: "REDO" }).present.lowerRow.modules).toHaveLength(1);
  });
  it("clears redo after new command", () => {
    const h = applyLayoutCommandToHistory(fresh(), add);
    const u = applyLayoutCommandToHistory(h, { commandId: "u", type: "UNDO" });
    expect(
      applyLayoutCommandToHistory(u, { commandId: "height", type: "SET_ROOM_HEIGHT", payload: { height: 2700 } })
        .future,
    ).toHaveLength(0);
  });
  it("rejects unknown commands", () =>
    expect(() => applyLayoutCommandToHistory(fresh(), { commandId: "x", type: "UNKNOWN" })).toThrow());
  it("legacy reducer explicitly rejects Stage 2 commands", () =>
    expect(() => applyStageOne(fresh(), { commandId: "left", type: "MOVE_LEFT", payload: { id: "sink" } })).toThrow(
      DomainError,
    ));
});
