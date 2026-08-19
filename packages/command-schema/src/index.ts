import { z } from "zod";
import { LOWER_MODULE_TYPES } from "../../domain-types/src/index.js";

export const COMMAND_TYPES = [
  "SET_WALL_WIDTH",
  "SET_ROOM_HEIGHT",
  "ADD_MODULE",
  "REMOVE_MODULE",
  "INSERT_AFTER",
  "INSERT_BEFORE",
  "MOVE_TO_EDGE",
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "CHANGE_WIDTH",
  "SET_APRON_HEIGHT",
  "GENERATE_UPPER_ROW",
  "SET_MEZZANINE_HEIGHT",
  "UNDO",
  "REDO",
] as const;

const Base = z.object({ commandId: z.string().min(1) });
const Width = z.number().int().positive();
const Id = z.object({ id: z.string().min(1) });
const ModulePayload = z
  .object({ id: z.string().min(1), moduleType: z.enum(LOWER_MODULE_TYPES), width: Width })
  .strict();

/**
 * Белый список команд.
 *
 * Схемы строгие (`.strict()`): лишние поля на любом уровне (например,
 * галлюцинация LLM или неожиданный ключ от внешнего клиента) отклоняются
 * ошибкой валидации, а не молча отбрасываются. Intent parser (Stage 4)
 * отделяет свои служебные поля (confidence/explanation/needsConfirmation)
 * до валидации команды, поэтому строгость не ломает LLM-конвейер, а
 * усиливает границу безопасности ADR-003.
 */
export const CommandSchema = z.discriminatedUnion("type", [
  Base.extend({ type: z.literal("SET_WALL_WIDTH"), payload: z.object({ width: Width }).strict() }).strict(),
  Base.extend({ type: z.literal("SET_ROOM_HEIGHT"), payload: z.object({ height: Width }).strict() }).strict(),
  Base.extend({
    type: z.literal("ADD_MODULE"),
    payload: ModulePayload.extend({ edge: z.enum(["left", "right"]).default("right") }).strict(),
  }).strict(),
  Base.extend({ type: z.literal("REMOVE_MODULE"), payload: Id.strict() }).strict(),
  Base.extend({ type: z.literal("INSERT_AFTER"), referenceId: z.string().min(1), payload: ModulePayload }).strict(),
  Base.extend({ type: z.literal("INSERT_BEFORE"), referenceId: z.string().min(1), payload: ModulePayload }).strict(),
  Base.extend({
    type: z.literal("MOVE_TO_EDGE"),
    payload: Id.extend({ edge: z.enum(["left", "right"]) }).strict(),
  }).strict(),
  Base.extend({ type: z.literal("MOVE_LEFT"), payload: Id.strict() }).strict(),
  Base.extend({ type: z.literal("MOVE_RIGHT"), payload: Id.strict() }).strict(),
  Base.extend({ type: z.literal("CHANGE_WIDTH"), payload: Id.extend({ width: Width }).strict() }).strict(),
  Base.extend({
    type: z.literal("SET_APRON_HEIGHT"),
    payload: z.object({ height: z.number().int().min(550).max(650) }).strict(),
  }).strict(),
  Base.extend({
    type: z.literal("GENERATE_UPPER_ROW"),
    payload: z
      .object({ preferredMainHeight: z.union([z.literal(720), z.literal(800), z.literal(900)]).optional() })
      .strict()
      .default({}),
  }).strict(),
  Base.extend({
    type: z.literal("SET_MEZZANINE_HEIGHT"),
    payload: z.object({ height: z.number().int().min(400).nullable() }).strict(),
  }).strict(),
  Base.extend({ type: z.literal("UNDO") }).strict(),
  Base.extend({ type: z.literal("REDO") }).strict(),
]);

export type Command = z.infer<typeof CommandSchema>;
