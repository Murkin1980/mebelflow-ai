import { CommandSchema,type Command } from "../../command-schema/src/index.js";
import { FurnitureProjectStateSchema,type FurnitureModule,type FurnitureProjectState } from "./schema.js";
import { createModule,isAllowedModuleWidth } from "./catalog.js";
export class DomainError extends Error{}
export type ProjectHistory={present:FurnitureProjectState;past:FurnitureProjectState[];future:FurnitureProjectState[];processedCommandIds:string[]};
export const createHistory=(state:FurnitureProjectState):ProjectHistory=>({present:FurnitureProjectStateSchema.parse(state),past:[],future:[],processedCommandIds:[]});
function positions(modules:FurnitureModule[]){let position=0;return modules.map(module=>{const next={...module,position};position+=module.width;return next})}
function validateLayout(state:FurnitureProjectState){const occupied=state.lowerRow.modules.reduce((sum,module)=>sum+module.width,0);if(state.room.wallWidth!==null&&occupied>state.room.wallWidth)throw new DomainError(`Модули занимают ${occupied} мм, стена — ${state.room.wallWidth} мм.`)}
function reduceState(state:FurnitureProjectState,command:Exclude<Command,{type:"UNDO"|"REDO"}>):FurnitureProjectState{
 const next=structuredClone(state);const modules=next.lowerRow.modules;
 switch(command.type){
  case"SET_WALL_WIDTH":next.room.wallWidth=command.payload.width;break;case"SET_ROOM_HEIGHT":next.room.roomHeight=command.payload.height;break;
  case"ADD_MODULE":{if(modules.some(m=>m.id===command.payload.id))throw new DomainError("ID модуля уже существует.");if(!isAllowedModuleWidth(command.payload.moduleType,command.payload.width))throw new DomainError("Ширина не разрешена для этого типа модуля.");const module=createModule(command.payload.id,command.payload.moduleType,command.payload.width);command.payload.edge==="left"?modules.unshift(module):modules.push(module);break}
  case"REMOVE_MODULE":{const i=modules.findIndex(m=>m.id===command.payload.id);if(i<0)throw new DomainError("Модуль не найден.");modules.splice(i,1);break}
  case"INSERT_AFTER":{const i=modules.findIndex(m=>m.id===command.referenceId);if(i<0)throw new DomainError("Опорный модуль не найден.");if(modules.some(m=>m.id===command.payload.id))throw new DomainError("ID модуля уже существует.");if(!isAllowedModuleWidth(command.payload.moduleType,command.payload.width))throw new DomainError("Ширина не разрешена для этого типа модуля.");modules.splice(i+1,0,createModule(command.payload.id,command.payload.moduleType,command.payload.width));break}
  case"MOVE_TO_EDGE":{const i=modules.findIndex(m=>m.id===command.payload.id);if(i<0)throw new DomainError("Модуль не найден.");const[module]=modules.splice(i,1);if(!module)throw new DomainError("Модуль не найден.");command.payload.edge==="left"?modules.unshift(module):modules.push(module);break}
  case"CHANGE_WIDTH":{const module=modules.find(m=>m.id===command.payload.id);if(!module)throw new DomainError("Модуль не найден.");if(!isAllowedModuleWidth(module.type,command.payload.width))throw new DomainError("Ширина не разрешена для этого типа модуля.");module.width=command.payload.width;break}
  default:throw new DomainError("Команда должна применяться через Layout Engine.");
 }
 next.lowerRow.modules=positions(modules);next.historyMeta.revision+=1;next.historyMeta.appliedCommandIds.push(command.commandId);validateLayout(next);return FurnitureProjectStateSchema.parse(next)
}
export function applyCommand(history:ProjectHistory,input:unknown):ProjectHistory{const command=CommandSchema.parse(input);if(history.processedCommandIds.includes(command.commandId))return history;const processedCommandIds=[...history.processedCommandIds,command.commandId];if(command.type==="UNDO"){const previous=history.past.at(-1);if(!previous)return{...history,processedCommandIds};return{present:previous,past:history.past.slice(0,-1),future:[history.present,...history.future],processedCommandIds}}if(command.type==="REDO"){const next=history.future[0];if(!next)return{...history,processedCommandIds};return{present:next,past:[...history.past,history.present],future:history.future.slice(1),processedCommandIds}}const present=reduceState(history.present,command);return{present,past:[...history.past,history.present],future:[],processedCommandIds}}
