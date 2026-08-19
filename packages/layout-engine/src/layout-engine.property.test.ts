import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createInitialProject } from "../../project-state/src/schema.js";
import { applyLayoutCommand } from "./index.js";

const widths = [150, 200, 300, 400, 450, 500, 600, 700, 800, 900, 1000] as const;
describe("layout properties", () => {
  it("keeps sequential positions and exact remaining width", () =>
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...widths), { minLength: 0, maxLength: 6 }), (values) => {
        const sum = values.reduce((a, b) => a + b, 0);
        if (sum > 7000) return;
        const state = createInitialProject("p", "t");
        state.room.wallWidth = Math.max(1200, sum);
        let current = state;
        values.forEach((width, index) => {
          current = applyLayoutCommand(current, {
            commandId: `a${index}`,
            type: "ADD_MODULE",
            payload: { id: `m${index}`, moduleType: "base_cabinet_doors", width, edge: "right" },
          }).state;
        });
        let position = 0;
        for (const module of current.lowerRow.modules) {
          expect(module.position).toBe(position);
          position += module.width;
        }
        expect(
          applyLayoutCommand(current, {
            commandId: "w",
            type: "SET_WALL_WIDTH",
            payload: { width: Math.max(1200, sum) },
          }).remainingWidth,
        ).toBe(Math.max(1200, sum) - sum);
      }),
      { numRuns: 100 },
    ));
  it("is deterministic", () =>
    fc.assert(
      fc.property(fc.constantFrom(...widths), (width) => {
        const state = createInitialProject("p", "t");
        state.room.wallWidth = 3000;
        const command = {
          commandId: "a",
          type: "ADD_MODULE" as const,
          payload: { id: "m", moduleType: "base_cabinet_doors" as const, width, edge: "right" as const },
        };
        expect(applyLayoutCommand(state, command)).toEqual(applyLayoutCommand(state, command));
      }),
      { numRuns: 50 },
    ));
  it("never mutates its input", () =>
    fc.assert(
      fc.property(fc.constantFrom(...widths), (width) => {
        const state = createInitialProject("p", "t");
        state.room.wallWidth = 3000;
        const before = structuredClone(state);
        applyLayoutCommand(state, {
          commandId: "a",
          type: "ADD_MODULE",
          payload: { id: "m", moduleType: "base_cabinet_doors", width, edge: "right" },
        });
        expect(state).toEqual(before);
      }),
      { numRuns: 50 },
    ));
});
