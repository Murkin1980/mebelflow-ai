export type LengthUnit="mm"|"cm"|"m";
export function toMillimetres(value:number,unit:LengthUnit):number{
  if(!Number.isFinite(value)||value<=0)throw new Error("Размер должен быть положительным конечным числом.");
  const factor=unit==="mm"?1:unit==="cm"?10:1000;
  const result=value*factor;
  if(!Number.isInteger(result))throw new Error("Размер должен выражаться целым числом миллиметров.");
  return result;
}
