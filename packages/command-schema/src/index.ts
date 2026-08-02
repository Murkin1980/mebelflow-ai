import { z } from "zod";
import { LOWER_MODULE_TYPES } from "../../project-state/src/schema.js";
const Base=z.object({commandId:z.string().min(1)});const Width=z.number().int().positive();const ModulePayload=z.object({id:z.string().min(1),moduleType:z.enum(LOWER_MODULE_TYPES),width:Width});
export const CommandSchema=z.discriminatedUnion("type",[
 Base.extend({type:z.literal("SET_WALL_WIDTH"),payload:z.object({width:Width})}),Base.extend({type:z.literal("SET_ROOM_HEIGHT"),payload:z.object({height:Width})}),
 Base.extend({type:z.literal("ADD_MODULE"),payload:ModulePayload.extend({edge:z.enum(["left","right"]).default("right")})}),Base.extend({type:z.literal("REMOVE_MODULE"),payload:z.object({id:z.string().min(1)})}),
 Base.extend({type:z.literal("INSERT_AFTER"),referenceId:z.string().min(1),payload:ModulePayload}),Base.extend({type:z.literal("MOVE_TO_EDGE"),payload:z.object({id:z.string().min(1),edge:z.enum(["left","right"])})}),
 Base.extend({type:z.literal("CHANGE_WIDTH"),payload:z.object({id:z.string().min(1),width:Width})}),Base.extend({type:z.literal("UNDO")}),Base.extend({type:z.literal("REDO")})]);
export type Command=z.infer<typeof CommandSchema>;
