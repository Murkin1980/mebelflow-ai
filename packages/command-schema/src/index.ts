import { z } from "zod";
import { LOWER_MODULE_TYPES } from "../../project-state/src/schema.js";
const Base=z.object({commandId:z.string().min(1)});const Width=z.number().int().positive();const Id=z.object({id:z.string().min(1)});const ModulePayload=z.object({id:z.string().min(1),moduleType:z.enum(LOWER_MODULE_TYPES),width:Width});
export const CommandSchema=z.discriminatedUnion("type",[
 Base.extend({type:z.literal("SET_WALL_WIDTH"),payload:z.object({width:Width})}),Base.extend({type:z.literal("SET_ROOM_HEIGHT"),payload:z.object({height:Width})}),
 Base.extend({type:z.literal("ADD_MODULE"),payload:ModulePayload.extend({edge:z.enum(["left","right"]).default("right")})}),Base.extend({type:z.literal("REMOVE_MODULE"),payload:Id}),
 Base.extend({type:z.literal("INSERT_AFTER"),referenceId:z.string().min(1),payload:ModulePayload}),Base.extend({type:z.literal("INSERT_BEFORE"),referenceId:z.string().min(1),payload:ModulePayload}),
 Base.extend({type:z.literal("MOVE_TO_EDGE"),payload:Id.extend({edge:z.enum(["left","right"])})}),Base.extend({type:z.literal("MOVE_LEFT"),payload:Id}),Base.extend({type:z.literal("MOVE_RIGHT"),payload:Id}),
 Base.extend({type:z.literal("CHANGE_WIDTH"),payload:Id.extend({width:Width})}),Base.extend({type:z.literal("SET_APRON_HEIGHT"),payload:z.object({height:z.number().int().min(550).max(650)})}),
 Base.extend({type:z.literal("GENERATE_UPPER_ROW"),payload:z.object({preferredMainHeight:z.union([z.literal(720),z.literal(800),z.literal(900)]).optional()}).default({})}),Base.extend({type:z.literal("SET_MEZZANINE_HEIGHT"),payload:z.object({height:z.number().int().min(400).nullable()})}),
 Base.extend({type:z.literal("UNDO")}),Base.extend({type:z.literal("REDO")})]);
export type Command=z.infer<typeof CommandSchema>;
