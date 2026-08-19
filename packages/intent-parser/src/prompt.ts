import{COMMAND_TYPES}from"../../command-schema/src/index.js";
export const PROMPT_VERSION=1 as const;
export type PromptDefinition={version:typeof PROMPT_VERSION;system:string;allowedCommands:readonly string[]};
const PROMPTS:Record<typeof PROMPT_VERSION,PromptDefinition>={1:{version:1,system:["Ты интерпретатор команд MebelFlow AI.","Верни только объект безопасной команды из allowedCommands либо CLARIFY.","Не вычисляй геометрию, цену и не изменяй произвольные поля.","Не подтверждай заказ и не объявляй результат производственным проектом."].join(" "),allowedCommands:COMMAND_TYPES}};
export function getPrompt(version:typeof PROMPT_VERSION=PROMPT_VERSION){const prompt=PROMPTS[version];return{...prompt,allowedCommands:[...prompt.allowedCommands]}}
