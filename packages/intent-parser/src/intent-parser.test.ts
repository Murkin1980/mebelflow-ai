import { describe, expect, it } from "vitest";
import { createInitialProject } from "../../project-state/src/schema.js";
import { compactProjectState, FakeIntentProvider, parseIntent } from "./index.js";

const usage = { inputTokens: 12, outputTokens: 8 };
const state = () => {
  const s = createInitialProject("p", "t");
  s.room.wallWidth = 3000;
  return s;
};
const provider = (output: unknown) => new FakeIntentProvider([{ output, usage }]);
describe("intent parser contract", () => {
  it("builds compact state", () =>
    expect(compactProjectState(state())).toMatchObject({ wallWidth: 3000, moduleIds: [], remainingWidth: 3000 }));
  it("returns valid command", async () =>
    expect(
      await parseIntent(
        provider({
          command: { commandId: "c", type: "SET_ROOM_HEIGHT", payload: { height: 2700 } },
          confidence: 0.97,
          explanation: "Установить высоту 2700 мм",
        }),
        "высота 2700",
        state(),
      ),
    ).toMatchObject({ kind: "command", needsConfirmation: false }));
  it("accepts canonical top-level TECH_SPEC output", async () =>
    expect(
      await parseIntent(
        provider({
          commandId: "cmd_uuid",
          type: "INSERT_AFTER",
          referenceId: "sink-1",
          payload: { id: "dw-1", moduleType: "dishwasher_600", width: 600 },
          confidence: 0.97,
          needsConfirmation: false,
        }),
        "после мойки ПММ 600",
        state(),
      ),
    ).toMatchObject({
      kind: "command",
      command: { type: "INSERT_AFTER", referenceId: "sink-1" },
      needsConfirmation: false,
    }));
  it("requires confirmation below .9", async () =>
    expect(
      await parseIntent(
        provider({
          command: { commandId: "c", type: "SET_ROOM_HEIGHT", payload: { height: 2700 } },
          confidence: 0.7,
          explanation: "Высота 2700 мм",
        }),
        "два семьдесят",
        state(),
      ),
    ).toMatchObject({ kind: "command", needsConfirmation: true }));
  it("auto-applies at confidence boundary .9", async () =>
    expect(
      await parseIntent(
        provider({ commandId: "c", type: "SET_ROOM_HEIGHT", payload: { height: 2700 }, confidence: 0.9 }),
        "2700",
        state(),
      ),
    ).toMatchObject({ kind: "command", needsConfirmation: false }));
  it("returns clarification", async () =>
    expect(
      await parseIntent(
        provider({ type: "CLARIFY", question: "ПММ 450 или 600 мм?", options: ["450", "600"], confidence: 0.4 }),
        "добавь ПММ",
        state(),
      ),
    ).toMatchObject({ kind: "clarify", options: ["450", "600"] }));
  it("rejects unknown command", async () =>
    expect(
      await parseIntent(
        provider({ command: { commandId: "x", type: "EXECUTE_CODE" }, confidence: 1, explanation: "x" }),
        "x",
        state(),
      ),
    ).toMatchObject({ kind: "rejected" }));
  it("rejects invalid dimensions", async () =>
    expect(
      await parseIntent(
        provider({
          command: { commandId: "x", type: "SET_WALL_WIDTH", payload: { width: -1 } },
          confidence: 1,
          explanation: "x",
        }),
        "x",
        state(),
      ),
    ).toMatchObject({ kind: "rejected" }));
  it("rejects malformed provider output", async () =>
    expect(await parseIntent(provider({ anything: true }), "x", state())).toMatchObject({ kind: "rejected" }));
  it("rejects empty input without provider call", async () => {
    const p = provider({});
    expect(await parseIntent(p, "  ", state())).toMatchObject({ kind: "rejected" });
    expect(p.requests).toHaveLength(0);
  });
  it("preserves usage", async () =>
    expect((await parseIntent(provider({ type: "CLARIFY", question: "Уточните" }), "x", state())).usage).toEqual(
      usage,
    ));
  it("handles provider failure without mutation", async () => {
    const p = new FakeIntentProvider([]);
    const before = state();
    const copy = structuredClone(before);
    expect(await parseIntent(p, "x", before)).toMatchObject({ kind: "rejected" });
    expect(before).toEqual(copy);
  });
  it("sends versioned prompt and locale", async () => {
    const p = provider({ type: "CLARIFY", question: "Уточните" });
    await parseIntent(p, " x ", state());
    expect(p.requests[0]).toMatchObject({ utterance: "x", locale: "ru-KZ", prompt: { version: 1 } });
    expect(p.requests[0]?.prompt.system).toContain("allowedCommands");
    expect(p.requests[0]?.prompt.allowedCommands).toContain("INSERT_AFTER");
  });
  it("limits clarification options", async () =>
    expect(
      (await parseIntent(provider({ type: "CLARIFY", question: "x", options: ["1", "2", "3", "4"] }), "x", state()))
        .kind,
    ).toBe("rejected"));
  it("rejects negative token usage", async () =>
    expect(
      (
        await parseIntent(
          new FakeIntentProvider([
            { output: { type: "CLARIFY", question: "x" }, usage: { inputTokens: -1, outputTokens: 0 } },
          ]),
          "x",
          state(),
        )
      ).kind,
    ).toBe("rejected"));
  it("returns defensive prompt data", async () => {
    const p = provider({ type: "CLARIFY", question: "x" });
    await parseIntent(p, "x", state());
    (p.requests[0]!.prompt.allowedCommands as string[]).length = 0;
    const next = provider({ type: "CLARIFY", question: "x" });
    await parseIntent(next, "x", state());
    expect(next.requests[0]!.prompt.allowedCommands.length).toBeGreaterThan(0);
  });
});
