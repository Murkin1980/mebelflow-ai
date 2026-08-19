import type { FurnitureModule } from "./schema.js";

export const DEFAULT_STANDARD_WIDTHS = [150,200,300,400,450,500,600,700,800,900,1000] as const;
type ModuleType = FurnitureModule["type"];
type ModuleSpec = { allowedWidths: readonly number[] | "tenant_standard" | "flexible_filler"; defaultHeight: number; defaultDepth: number };

export const MODULE_CATALOG: Record<ModuleType,ModuleSpec> = {
  base_cabinet_doors:{allowedWidths:"tenant_standard",defaultHeight:720,defaultDepth:560},base_cabinet_drawers:{allowedWidths:"tenant_standard",defaultHeight:720,defaultDepth:560},sink_cabinet:{allowedWidths:"tenant_standard",defaultHeight:720,defaultDepth:500},
  dishwasher_450:{allowedWidths:[450],defaultHeight:820,defaultDepth:560},dishwasher_600:{allowedWidths:[600],defaultHeight:820,defaultDepth:560},oven_base:{allowedWidths:[600],defaultHeight:720,defaultDepth:560},cooktop_base:{allowedWidths:[600,800,900],defaultHeight:720,defaultDepth:560},washing_machine:{allowedWidths:[600],defaultHeight:820,defaultDepth:560},
  filler:{allowedWidths:"flexible_filler",defaultHeight:720,defaultDepth:560},open_base:{allowedWidths:"tenant_standard",defaultHeight:720,defaultDepth:560},fridge:{allowedWidths:[600],defaultHeight:2000,defaultDepth:650},fridge_tall_unit:{allowedWidths:[600],defaultHeight:2200,defaultDepth:650},oven_tall_unit:{allowedWidths:[600],defaultHeight:2200,defaultDepth:560},pantry_tall_unit:{allowedWidths:"tenant_standard",defaultHeight:2200,defaultDepth:560},utility_tall_unit:{allowedWidths:"tenant_standard",defaultHeight:2200,defaultDepth:560}
};

export function isAllowedModuleWidth(type:ModuleType,width:number,tenantWidths:readonly number[]=DEFAULT_STANDARD_WIDTHS):boolean{
  const rule=MODULE_CATALOG[type].allowedWidths;
  if(rule==="flexible_filler")return width>=1&&width<=149;
  return (rule==="tenant_standard"?tenantWidths:rule).includes(width);
}

export function createModule(id:string,type:ModuleType,width:number):FurnitureModule{
  const spec=MODULE_CATALOG[type];
  return {id,type,width,height:spec.defaultHeight,depth:spec.defaultDepth,position:0};
}
