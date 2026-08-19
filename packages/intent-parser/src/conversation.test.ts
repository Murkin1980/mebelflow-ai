import { describe, expect, it } from "vitest";
import { createHistory } from "../../project-state/src/reducer.js";
import { createInitialProject } from "../../project-state/src/schema.js";
import { IntentSession, safeApplyIntent, TokenLedger } from "./conversation.js";
import { FakeIntentProvider, parseIntent } from "./index.js";

const usage = { inputTokens: 10, outputTokens: 5 };
const setup = () => {
  const s = createInitialProject("p", "t");
  s.room.wallWidth = 3000;
  return createHistory(s);
};
describe("safe conversation flow", () => {
  it("applies high-confidence command", async () => {
    const h = setup();
    const p = new FakeIntentProvider([
      {
        output: {
          command: {
            commandId: "a",
            type: "ADD_MODULE",
            payload: { id: "sink", moduleType: "sink_cabinet", width: 800, edge: "left" },
          },
          confidence: 0.97,
          explanation: "Добавить мойку 800 мм слева",
        },
        usage,
      },
    ]);
    const intent = await parseIntent(p, "мойка слева", h.present);
    const result = safeApplyIntent(h, intent);
    expect(result.status).toBe("applied");
    expect(result.history.present.lowerRow.modules[0]?.id).toBe("sink");
  });
  it("does not apply medium confidence without confirmation", async () => {
    const h = setup();
    const p = new FakeIntentProvider([
      {
        output: {
          command: { commandId: "a", type: "SET_ROOM_HEIGHT", payload: { height: 2700 } },
          confidence: 0.7,
          explanation: "Высота 2700 мм",
        },
        usage,
      },
    ]);
    const intent = await parseIntent(p, "два семьдесят", h.present);
    const result = safeApplyIntent(h, intent);
    expect(result.status).toBe("confirmation_required");
    expect(result.history).toBe(h);
  });
  it("applies medium confidence after confirmation", async () => {
    const h = setup();
    const p = new FakeIntentProvider([
      {
        output: {
          command: { commandId: "a", type: "SET_ROOM_HEIGHT", payload: { height: 2700 } },
          confidence: 0.7,
          explanation: "Высота 2700 мм",
        },
        usage,
      },
    ]);
    const intent = await parseIntent(p, "два семьдесят", h.present);
    expect(safeApplyIntent(h, intent, true).history.present.room.roomHeight).toBe(2700);
  });
  it("preserves state on layout conflict", async () => {
    const h = setup();
    h.present.room.wallWidth = 1200;
    const p = new FakeIntentProvider([
      {
        output: {
          command: {
            commandId: "a",
            type: "ADD_MODULE",
            payload: { id: "wide", moduleType: "base_cabinet_doors", width: 1000, edge: "right" },
          },
          confidence: 1,
          explanation: "Добавить шкаф",
        },
        usage,
      },
      {
        output: {
          command: {
            commandId: "b",
            type: "ADD_MODULE",
            payload: { id: "more", moduleType: "base_cabinet_doors", width: 300, edge: "right" },
          },
          confidence: 1,
          explanation: "Добавить шкаф",
        },
        usage,
      },
    ]);
    const first = safeApplyIntent(h, await parseIntent(p, "шкаф", h.present));
    const before = first.history;
    const second = safeApplyIntent(before, await parseIntent(p, "ещё шкаф", before.present));
    expect(second.status).toBe("apply_error");
    expect(second.history).toBe(before);
    expect(second.message).toContain("Схема не изменена");
  });
  it("passes clarification without mutation", async () => {
    const h = setup();
    const intent = await parseIntent(
      new FakeIntentProvider([
        { output: { type: "CLARIFY", question: "450 или 600?", options: ["450", "600"] }, usage },
      ]),
      "ПММ",
      h.present,
    );
    expect(safeApplyIntent(h, intent)).toMatchObject({ status: "clarification", history: h });
  });
  it("passes rejection without mutation", async () => {
    const h = setup();
    const intent = await parseIntent(new FakeIntentProvider([{ output: { bad: true }, usage }]), "x", h.present);
    expect(safeApplyIntent(h, intent)).toMatchObject({ status: "rejected", history: h });
  });
  it("keeps idempotent replay", async () => {
    const h = setup();
    const response = {
      output: {
        command: { commandId: "same", type: "SET_ROOM_HEIGHT", payload: { height: 2700 } },
        confidence: 1,
        explanation: "Высота",
      },
      usage,
    };
    const intent = await parseIntent(new FakeIntentProvider([response]), "высота", h.present);
    const first = safeApplyIntent(h, intent);
    expect(safeApplyIntent(first.history, intent).history).toBe(first.history);
  });
  it("accumulates token usage", () => {
    const ledger = new TokenLedger();
    ledger.record({ inputTokens: 10, outputTokens: 5 });
    ledger.record({ inputTokens: 3, outputTokens: 2 });
    expect(ledger.snapshot()).toEqual({ inputTokens: 13, outputTokens: 7, totalTokens: 20 });
  });
  it("rejects invalid ledger usage", () =>
    expect(() => new TokenLedger().record({ inputTokens: -1, outputTokens: 0 })).toThrow());
  it("session accounts usage automatically", async () => {
    const session = new IntentSession(
      new FakeIntentProvider([{ output: { type: "CLARIFY", question: "Уточните" }, usage }]),
    );
    await session.interpret("x", setup().present);
    expect(session.usage()).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });
  it("replays the main TECH_SPEC conversation safely", async () => {
    const responses = [
      {
        output: {
          commandId: "wall",
          type: "SET_WALL_WIDTH",
          payload: { width: 3000 },
          confidence: 0.99,
          explanation: "Стена 3000 мм",
        },
        usage,
      },
      {
        output: {
          commandId: "sink",
          type: "ADD_MODULE",
          payload: { id: "sink-1", moduleType: "sink_cabinet", width: 800, edge: "left" },
          confidence: 0.98,
          explanation: "Мойка слева",
        },
        usage,
      },
      {
        output: {
          commandId: "dw",
          type: "INSERT_AFTER",
          referenceId: "sink-1",
          payload: { id: "dw-1", moduleType: "dishwasher_600", width: 600 },
          confidence: 0.97,
          explanation: "ПММ после мойки",
        },
        usage,
      },
      {
        output: {
          commandId: "drawers",
          type: "INSERT_AFTER",
          referenceId: "dw-1",
          payload: { id: "drawers-1", moduleType: "base_cabinet_drawers", width: 600 },
          confidence: 0.96,
          explanation: "Ящики после ПММ",
        },
        usage,
      },
      {
        output: { commandId: "undo", type: "UNDO", confidence: 0.99, explanation: "Вернуть предыдущий вариант" },
        usage,
      },
    ];
    const session = new IntentSession(new FakeIntentProvider(responses));
    let history = setup();
    for (const utterance of [
      "кухня три метра",
      "мойка слева",
      "после мойки ПММ 600",
      "после неё тумба с ящиками",
      "верни предыдущий вариант",
    ]) {
      const intent = await session.interpret(utterance, history.present);
      const applied = session.apply(history, intent);
      expect(applied.status).toBe("applied");
      history = applied.history;
    }
    expect(history.present.lowerRow.modules.map((module) => module.id)).toEqual(["sink-1", "dw-1"]);
    expect(session.usage()).toEqual({ inputTokens: 50, outputTokens: 25, totalTokens: 75 });
  });
});
