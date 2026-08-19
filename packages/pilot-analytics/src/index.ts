import { z } from "zod";

export const PilotTenantConfigSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,50}$/),
  name: z.string().min(1),
  widgetScriptUrl: z.string().url(),
  allowedOrigins: z.array(z.string().url()).min(1),
  monthlyCostBudgetKzt: z.number().positive(),
  targetControlledSessions: z.literal(20),
  targetRealProspects: z.literal(5),
});
export type PilotTenantConfig = z.infer<typeof PilotTenantConfigSchema>;
export const PILOT_TENANT_CONFIG: PilotTenantConfig = PilotTenantConfigSchema.parse({
  tenantId: "grand-mebel-pilot",
  name: "Grand Mebel",
  widgetScriptUrl: "https://pilot.mebelflow.kz/widget.js",
  allowedOrigins: ["https://grand-mebel.kz"],
  monthlyCostBudgetKzt: 50_000,
  targetControlledSessions: 20,
  targetRealProspects: 5,
});

export function createEmbedSnippet(config: PilotTenantConfig, origin: string) {
  const parsed = PilotTenantConfigSchema.parse(config);
  if (!parsed.allowedOrigins.includes(origin)) throw new Error("Origin не разрешён tenant-настройками.");
  return `<div id="mebelflow-widget" data-tenant="${parsed.tenantId}"></div><script src="${parsed.widgetScriptUrl}" defer></script>`;
}

export const ANALYTICS_EVENT_TYPES = [
  "session_started",
  "dimensions_completed",
  "layout_completed",
  "style_selected",
  "price_viewed",
  "contact_submitted",
  "pdf_downloaded",
  "order_clicked",
  "session_abandoned",
  "error",
] as const;
export const PilotEventSchema = z
  .object({
    id: z.string().min(1),
    tenantId: z.string().min(1),
    sessionId: z.string().min(1),
    type: z.enum(ANALYTICS_EVENT_TYPES),
    at: z.string().datetime(),
    step: z.enum(["dimensions", "layout", "style", "price", "contact", "pdf", "order"]).optional(),
    errorCode: z
      .string()
      .regex(/^[A-Z0-9_]+$/)
      .max(60)
      .optional(),
  })
  .superRefine((event, context) => {
    if (event.type === "error" && !event.errorCode)
      context.addIssue({ code: "custom", path: ["errorCode"], message: "Error event requires a sanitized code." });
  });
export type PilotEvent = z.infer<typeof PilotEventSchema>;

export class PilotEventCollector {
  private readonly events: PilotEvent[] = [];
  private readonly ids = new Set<string>();
  record(input: unknown) {
    const event = PilotEventSchema.parse(input);
    if (this.ids.has(event.id)) return;
    this.ids.add(event.id);
    this.events.push(structuredClone(event));
  }
  list(tenantId: string) {
    return structuredClone(this.events.filter((event) => event.tenantId === tenantId));
  }
}

export type CostEntry = {
  id: string;
  tenantId: string;
  sessionId: string;
  category: "text_ai" | "stt" | "pdf";
  amountKzt: number;
  at: string;
};
const CostEntrySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  sessionId: z.string().min(1),
  category: z.enum(["text_ai", "stt", "pdf"]),
  amountKzt: z.number().nonnegative(),
  at: z.string().datetime(),
});
export class PilotCostCollector {
  private readonly entries: CostEntry[] = [];
  private readonly ids = new Set<string>();
  record(input: unknown) {
    const entry = CostEntrySchema.parse(input);
    if (this.ids.has(entry.id)) return;
    this.ids.add(entry.id);
    this.entries.push(structuredClone(entry));
  }
  dashboard(tenantId: string, budgetKzt: number) {
    const entries = this.entries.filter((entry) => entry.tenantId === tenantId);
    const totalKzt = entries.reduce((sum, entry) => sum + entry.amountKzt, 0);
    const byCategory = Object.fromEntries(
      ["text_ai", "stt", "pdf"].map((category) => [
        category,
        entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.amountKzt, 0),
      ]),
    );
    return {
      totalKzt,
      budgetKzt,
      remainingKzt: Math.max(0, budgetKzt - totalKzt),
      hardStop: totalKzt >= budgetKzt,
      byCategory,
    };
  }
}

export type PilotSession = {
  id: string;
  tenantId: string;
  kind: "controlled" | "real_prospect";
  participantCode: string;
  startedAt: string;
  completedAt: string | null;
};
const PilotSessionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  kind: z.enum(["controlled", "real_prospect"]),
  participantCode: z.string().regex(/^[A-Z0-9-]{3,30}$/),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type InterviewNote = { sessionId: string; participantCode: string; note: string; at: string };
const InterviewNoteSchema = z
  .object({
    sessionId: z.string().min(1),
    participantCode: z.string().regex(/^[A-Z0-9-]{3,30}$/),
    note: z.string().min(10).max(2_000),
    at: z.string().datetime(),
  })
  .superRefine((value, context) => {
    if (
      /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|(?:\+?7|8)[\s()-]*\d{3}[\s()-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/.test(value.note)
    )
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Interview note не должен содержать телефон или email.",
      });
  });

export class PilotStudy {
  private readonly sessions = new Map<string, PilotSession>();
  private readonly notes: InterviewNote[] = [];
  addSession(input: unknown) {
    const session = PilotSessionSchema.parse(input);
    if (this.sessions.has(session.id)) throw new Error("Pilot session ID уже существует.");
    this.sessions.set(session.id, structuredClone(session));
  }
  addInterview(input: unknown) {
    const note = InterviewNoteSchema.parse(input);
    const session = this.sessions.get(note.sessionId);
    if (!session || session.participantCode !== note.participantCode || session.kind !== "real_prospect")
      throw new Error("Interview note должен относиться к реальному prospect session.");
    this.notes.push(structuredClone(note));
  }
  data() {
    return { sessions: structuredClone([...this.sessions.values()]), interviews: structuredClone(this.notes) };
  }
}

export type FunnelReport = {
  controlledSessions: number;
  realProspects: number;
  completedSessions: number;
  contacts: number;
  orders: number;
  errors: number;
  completionRate: number;
  contactRate: number;
  orderRate: number;
  errorRate: number;
  interviewCount: number;
  totalCostKzt: number;
};
export function createFunnelReport(
  config: PilotTenantConfig,
  study: PilotStudy,
  events: PilotEventCollector,
  costs: PilotCostCollector,
): FunnelReport {
  const data = study.data();
  const tenantSessions = data.sessions.filter((session) => session.tenantId === config.tenantId);
  const sessionIds = new Set(tenantSessions.map((session) => session.id));
  const eventList = events.list(config.tenantId).filter((event) => sessionIds.has(event.sessionId));
  const unique = (type: PilotEvent["type"]) =>
    new Set(eventList.filter((event) => event.type === type).map((event) => event.sessionId)).size;
  const started = unique("session_started");
  const completed = unique("layout_completed");
  return {
    controlledSessions: tenantSessions.filter((session) => session.kind === "controlled").length,
    realProspects: tenantSessions.filter((session) => session.kind === "real_prospect").length,
    completedSessions: completed,
    contacts: unique("contact_submitted"),
    orders: unique("order_clicked"),
    errors: eventList.filter((event) => event.type === "error").length,
    completionRate: started ? completed / started : 0,
    contactRate: started ? unique("contact_submitted") / started : 0,
    orderRate: started ? unique("order_clicked") / started : 0,
    errorRate: started ? eventList.filter((event) => event.type === "error").length / started : 0,
    interviewCount: data.interviews.length,
    totalCostKzt: costs.dashboard(config.tenantId, config.monthlyCostBudgetKzt).totalKzt,
  };
}

export type PilotDecision = { status: "WAITING_FOR_DATA" | "GO" | "NO_GO"; reasons: string[] };
export function decidePilot(config: PilotTenantConfig, report: FunnelReport): PilotDecision {
  const missing: string[] = [];
  if (report.controlledSessions < config.targetControlledSessions)
    missing.push(`Нужно ещё ${config.targetControlledSessions - report.controlledSessions} контролируемых сессий.`);
  if (report.realProspects < config.targetRealProspects)
    missing.push(`Нужно ещё ${config.targetRealProspects - report.realProspects} реальных prospects.`);
  if (report.interviewCount < config.targetRealProspects)
    missing.push(`Нужно ещё ${config.targetRealProspects - report.interviewCount} интервью.`);
  if (missing.length) return { status: "WAITING_FOR_DATA", reasons: missing };
  const failures: string[] = [];
  if (report.completionRate < 0.5) failures.push("Completion rate ниже 50%.");
  if (report.contactRate < 0.2) failures.push("Contact rate ниже 20%.");
  if (report.errorRate > 0.1) failures.push("Error rate выше 10%.");
  if (report.totalCostKzt > config.monthlyCostBudgetKzt) failures.push("Pilot cost превысил tenant budget.");
  return failures.length
    ? { status: "NO_GO", reasons: failures }
    : { status: "GO", reasons: ["Пороговые метрики пилота выполнены."] };
}
