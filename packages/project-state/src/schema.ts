import { z } from "zod";
import { LOWER_MODULE_TYPES } from "../../domain-types/src/index.js";
import { MAX_METADATA_BYTES } from "./limits.js";

// Реэкспорт для обратной совместимости публичного API пакета.
export { LOWER_MODULE_TYPES };

export const ProjectStageSchema = z.enum([
  "anonymous",
  "started",
  "dimensions_collected",
  "lower_row_ready",
  "upper_row_ready",
  "style_selected",
  "price_shown",
  "contact_verified",
  "ordered",
  "brief_downloaded",
  "abandoned",
]);

export const FurnitureModuleSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(LOWER_MODULE_TYPES),
    width: z.number().int().positive(),
    height: z.number().int().positive().default(720),
    depth: z.number().int().positive().default(560),
    position: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((module, context) => {
    if (module.metadata !== undefined && JSON.stringify(module.metadata).length > MAX_METADATA_BYTES) {
      context.addIssue({
        code: "custom",
        path: ["metadata"],
        message: `metadata превышает лимит ${MAX_METADATA_BYTES} байт.`,
      });
    }
  });

export const FurnitureProjectStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    projectId: z.string().min(1),
    tenantId: z.string().min(1),
    stage: ProjectStageSchema,
    room: z.object({
      wallWidth: z.number().int().min(1200).max(7000).nullable(),
      roomHeight: z.number().int().min(2200).max(4000).nullable(),
      ceilingGap: z.number().int().min(20).max(50).default(30),
    }),
    // totalHeight default 900 мм — принятый tenant-tunable default (TECH_SPEC §5);
    // расчётная сумма компонентов — 858 мм, см. packages/domain-types.
    lowerRow: z.object({
      totalHeight: z.number().int().min(800).max(1000).default(900),
      modules: z.array(FurnitureModuleSchema),
    }),
    upperRow: z.object({
      enabled: z.boolean(),
      apronHeight: z.number().int().min(550).max(650),
      mainCabinetHeight: z.union([z.literal(720), z.literal(800), z.literal(900)]),
      mezzanineHeight: z.number().int().min(400).nullable(),
      repeatLowerWidths: z.boolean(),
    }),
    style: z.object({ presetId: z.string().nullable() }),
    pricing: z.object({
      currency: z.literal("KZT"),
      estimateMin: z.number().nonnegative().nullable(),
      estimateMax: z.number().nonnegative().nullable(),
      formulaVersion: z.number().int().positive(),
      status: z.literal("preliminary"),
    }),
    warnings: z.array(z.object({ code: z.string(), message: z.string() })),
    historyMeta: z.object({ revision: z.number().int().nonnegative(), appliedCommandIds: z.array(z.string()) }),
  })
  .superRefine((state, context) => {
    const ids = new Set<string>();
    let expectedPosition = 0;
    for (const module of state.lowerRow.modules) {
      if (ids.has(module.id)) {
        context.addIssue({
          code: "custom",
          path: ["lowerRow", "modules"],
          message: `Повторяющийся ID модуля: ${module.id}`,
        });
      }
      ids.add(module.id);
      if (module.position !== expectedPosition) {
        context.addIssue({
          code: "custom",
          path: ["lowerRow", "modules"],
          message: `Неверная позиция модуля ${module.id}`,
        });
      }
      expectedPosition += module.width;
    }
    if (state.room.wallWidth !== null && expectedPosition > state.room.wallWidth) {
      context.addIssue({ code: "custom", path: ["lowerRow", "modules"], message: "Модули превышают ширину стены." });
    }
  });

export type FurnitureModule = z.infer<typeof FurnitureModuleSchema>;
export type FurnitureProjectState = z.infer<typeof FurnitureProjectStateSchema>;

export function createInitialProject(projectId: string, tenantId: string): FurnitureProjectState {
  return FurnitureProjectStateSchema.parse({
    schemaVersion: 1,
    projectId,
    tenantId,
    stage: "started",
    room: { wallWidth: null, roomHeight: null, ceilingGap: 30 },
    lowerRow: { totalHeight: 900, modules: [] },
    upperRow: {
      enabled: false,
      apronHeight: 600,
      mainCabinetHeight: 800,
      mezzanineHeight: null,
      repeatLowerWidths: true,
    },
    style: { presetId: null },
    pricing: { currency: "KZT", estimateMin: null, estimateMax: null, formulaVersion: 1, status: "preliminary" },
    warnings: [],
    historyMeta: { revision: 0, appliedCommandIds: [] },
  });
}
