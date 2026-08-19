import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CommandSchema } from "../../command-schema/src/index.js";
import { applyCommand, createHistory } from "./reducer.js";
import { createInitialProject, type FurnitureProjectState, FurnitureProjectStateSchema } from "./schema.js";

/**
 * Docs-contract gate.
 *
 * Примеры в docs/templates/ — часть публичного контракта: они обязаны
 * проходить Zod-схемы, а реплей команд из примера обязан воспроизводить
 * модули из примера состояния. Тест выполняется в `npm run check` и в CI,
 * поэтому любой дрейф «документация ↔ код» ломает сборку.
 */

const stateExample = JSON.parse(
  readFileSync(new URL("../../../docs/templates/FURNITURE_PROJECT_STATE.example.json", import.meta.url), "utf8"),
) as unknown;

const commandsExample = JSON.parse(
  readFileSync(new URL("../../../docs/templates/COMMANDS.example.json", import.meta.url), "utf8"),
) as { commands: unknown[] };

describe("docs templates contract", () => {
  it("state example passes FurnitureProjectStateSchema", () => {
    const result = FurnitureProjectStateSchema.safeParse(stateExample);
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues, null, 2)).toBe(true);
  });

  it("every example command passes CommandSchema", () => {
    commandsExample.commands.forEach((raw, index) => {
      const result = CommandSchema.safeParse(raw);
      expect(
        result.success,
        `command #${index} failed: ${result.success ? "" : JSON.stringify(result.error.issues, null, 2)}`,
      ).toBe(true);
    });
  });

  it("replaying example commands reproduces example modules and historyMeta", () => {
    const parsedState = stateExample as FurnitureProjectState;
    let history = createHistory(createInitialProject(parsedState.projectId, parsedState.tenantId));
    for (const raw of commandsExample.commands) {
      history = applyCommand(history, CommandSchema.parse(raw));
    }

    const pick = (m: { id: string; type: string; width: number; position: number }) => ({
      id: m.id,
      type: m.type,
      width: m.width,
      position: m.position,
    });
    expect(history.present.lowerRow.modules.map(pick)).toEqual(parsedState.lowerRow.modules.map(pick));
    expect(history.present.historyMeta.appliedCommandIds).toEqual(parsedState.historyMeta.appliedCommandIds);
    expect(history.present.historyMeta.revision).toBe(parsedState.historyMeta.revision);
    expect(FurnitureProjectStateSchema.safeParse(history.present).success).toBe(true);
  });
});
