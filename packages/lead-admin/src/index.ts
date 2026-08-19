import { z } from "zod";
import { type FurnitureProjectState, FurnitureProjectStateSchema } from "../../project-state/src/schema.js";

export const ContactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^\+7\d{10}$/, "Телефон должен быть в формате +7XXXXXXXXXX."),
  comment: z.string().trim().max(500).optional(),
  consent: z.literal(true),
});
export type Contact = z.infer<typeof ContactSchema>;

export const LeadStatusSchema = z.enum(["new", "contacted", "qualified", "measurement_scheduled", "won", "lost"]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export type LeadEventType =
  | "created"
  | "status_changed"
  | "notification_sent"
  | "notification_failed"
  | "comment_added";
export type LeadEvent = {
  id: string;
  leadId: string;
  type: LeadEventType;
  at: string;
  actorId: string | null;
  details: Record<string, string>;
};
export type Lead = {
  id: string;
  tenantId: string;
  projectId: string;
  contact: Contact;
  status: LeadStatus;
  project: FurnitureProjectState;
  createdAt: string;
  updatedAt: string;
};

export interface ContactVerificationProvider {
  verifyOtp(phone: string, code: string): Promise<boolean>;
  verifyCaptcha(token: string): Promise<boolean>;
}
export class FakeContactVerificationProvider implements ContactVerificationProvider {
  readonly otpCalls: Array<{ phone: string; code: string }> = [];
  readonly captchaCalls: string[] = [];
  constructor(
    private readonly otpValid = true,
    private readonly captchaValid = true,
  ) {}
  async verifyOtp(phone: string, code: string) {
    this.otpCalls.push({ phone, code });
    return this.otpValid;
  }
  async verifyCaptcha(token: string) {
    this.captchaCalls.push(token);
    return this.captchaValid;
  }
}

export interface LeadNotifier {
  notifyCreated(lead: Lead): Promise<void>;
}
export class FakeLeadNotifier implements LeadNotifier {
  readonly notifications: Array<{ leadId: string; tenantId: string; projectId: string }> = [];
  constructor(private readonly failure: Error | null = null) {}
  async notifyCreated(lead: Lead) {
    if (this.failure) throw this.failure;
    this.notifications.push({ leadId: lead.id, tenantId: lead.tenantId, projectId: lead.projectId });
  }
}

export class InMemoryLeadRepository {
  private readonly leads = new Map<string, Lead>();
  private readonly events = new Map<string, LeadEvent[]>();
  private readonly requestIds = new Map<string, string>();
  findByRequestId(requestId: string) {
    const id = this.requestIds.get(requestId);
    return id ? this.get(id) : null;
  }
  save(lead: Lead, requestId?: string) {
    this.leads.set(lead.id, structuredClone(lead));
    if (requestId) this.requestIds.set(requestId, lead.id);
  }
  get(id: string) {
    const lead = this.leads.get(id);
    return lead ? structuredClone(lead) : null;
  }
  append(event: LeadEvent) {
    const current = this.events.get(event.leadId) ?? [];
    this.events.set(event.leadId, [...current, structuredClone(event)]);
  }
  history(leadId: string) {
    return structuredClone(this.events.get(leadId) ?? []);
  }
}

const transitions: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["measurement_scheduled", "lost"],
  measurement_scheduled: ["won", "lost"],
  won: [],
  lost: [],
};

export type CreateLeadInput = {
  requestId: string;
  leadId: string;
  contact: unknown;
  project: unknown;
  otpCode: string;
  attemptNumber: number;
  captchaToken?: string;
  now: string;
};

export class LeadService {
  constructor(
    private readonly repository: InMemoryLeadRepository,
    private readonly verification: ContactVerificationProvider,
    private readonly notifier: LeadNotifier,
    private readonly captchaAfterAttempt = 2,
  ) {}

  async create(input: CreateLeadInput): Promise<Lead> {
    if (!input.requestId.trim() || !input.leadId.trim()) throw new Error("requestId и leadId обязательны.");
    const replay = this.repository.findByRequestId(input.requestId);
    if (replay) return replay;
    if (this.repository.get(input.leadId)) throw new Error("Лид с таким ID уже существует.");
    if (!/^\d{4,8}$/.test(input.otpCode)) throw new Error("OTP должен содержать от 4 до 8 цифр.");
    if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1)
      throw new Error("Номер попытки должен быть положительным целым числом.");
    if (Number.isNaN(Date.parse(input.now))) throw new Error("Некорректная дата создания лида.");
    const contact = ContactSchema.parse(input.contact);
    const project = FurnitureProjectStateSchema.parse(input.project);
    if (input.attemptNumber > this.captchaAfterAttempt) {
      if (!input.captchaToken || !(await this.verification.verifyCaptcha(input.captchaToken)))
        throw new Error("CAPTCHA не пройдена.");
    }
    if (!(await this.verification.verifyOtp(contact.phone, input.otpCode)))
      throw new Error("Неверный код подтверждения телефона.");
    const lead: Lead = {
      id: input.leadId,
      tenantId: project.tenantId,
      projectId: project.projectId,
      contact,
      status: "new",
      project,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.repository.save(lead, input.requestId);
    this.event(lead.id, "created", input.now, null, { projectId: lead.projectId });
    try {
      await this.notifier.notifyCreated(lead);
      this.event(lead.id, "notification_sent", input.now, null, { channel: "telegram" });
    } catch {
      this.event(lead.id, "notification_failed", input.now, null, { channel: "telegram" });
    }
    return structuredClone(lead);
  }

  details(leadId: string) {
    const lead = this.repository.get(leadId);
    if (!lead) throw new Error("Лид не найден.");
    return { lead, events: this.repository.history(leadId) };
  }

  changeStatus(leadId: string, nextStatus: LeadStatus, actorId: string, now: string) {
    const lead = this.repository.get(leadId);
    if (!lead) throw new Error("Лид не найден.");
    if (!transitions[lead.status].includes(nextStatus))
      throw new Error(`Переход ${lead.status} → ${nextStatus} запрещён.`);
    const previous = lead.status;
    lead.status = nextStatus;
    lead.updatedAt = now;
    this.repository.save(lead);
    this.event(lead.id, "status_changed", now, actorId, { from: previous, to: nextStatus });
    return lead;
  }

  addComment(leadId: string, comment: string, actorId: string, now: string) {
    if (!comment.trim() || comment.length > 500) throw new Error("Комментарий должен содержать от 1 до 500 символов.");
    if (!this.repository.get(leadId)) throw new Error("Лид не найден.");
    this.event(leadId, "comment_added", now, actorId, { comment: comment.trim() });
  }

  private event(
    leadId: string,
    type: LeadEventType,
    at: string,
    actorId: string | null,
    details: Record<string, string>,
  ) {
    const index = this.repository.history(leadId).length + 1;
    this.repository.append({ id: `${leadId}:event:${index}`, leadId, type, at, actorId, details });
  }
}

export const TenantSettingsSchema = z.object({
  tenantId: z.string().min(1),
  brandName: z.string().min(1).max(100),
  locale: z.enum(["ru-KZ", "kk-KZ"]),
  phone: z.string().regex(/^\+7\d{10}$/),
  whatsapp: z
    .string()
    .regex(/^\+7\d{10}$/)
    .nullable(),
  telegramChatId: z.string().min(1).nullable(),
  enabledStyleIds: z.array(z.string().min(1)).max(5),
  standardWidths: z.array(z.number().int().positive()).min(1),
  limits: z.object({
    commandsPerSession: z.number().int().positive(),
    sttSecondsPerSession: z.number().int().positive(),
    projectsPerMonth: z.number().int().positive(),
    aiBudgetKztPerMonth: z.number().nonnegative(),
  }),
  disclaimer: z.string().min(20),
  retentionDays: z.number().int().min(1).max(365),
});
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;
type LimitMetric = "commandsPerSession" | "sttSecondsPerSession" | "projectsPerMonth" | "aiBudgetKztPerMonth";
export class UsageGuard {
  private usage: Record<LimitMetric, number> = {
    commandsPerSession: 0,
    sttSecondsPerSession: 0,
    projectsPerMonth: 0,
    aiBudgetKztPerMonth: 0,
  };
  constructor(private readonly settings: TenantSettings) {
    TenantSettingsSchema.parse(settings);
  }
  consume(metric: LimitMetric, amount: number) {
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Расход должен быть неотрицательным.");
    const limit = this.settings.limits[metric];
    if (this.usage[metric] + amount > limit) throw new Error(`Лимит ${metric} исчерпан.`);
    this.usage[metric] += amount;
    return this.snapshot();
  }
  snapshot() {
    return structuredClone(this.usage);
  }
}

export interface ResumeTokenProvider {
  issue(tenantId: string, projectId: string): Promise<string>;
  resolve(token: string): Promise<{ tenantId: string; projectId: string } | null>;
}
export class FakeResumeTokenProvider implements ResumeTokenProvider {
  private readonly tokens = new Map<string, { tenantId: string; projectId: string }>();
  private sequence = 0;
  async issue(tenantId: string, projectId: string) {
    const token = `opaque-resume-${++this.sequence}`;
    this.tokens.set(token, { tenantId, projectId });
    return token;
  }
  async resolve(token: string) {
    return structuredClone(this.tokens.get(token) ?? null);
  }
}
export async function resumeProject(
  provider: ResumeTokenProvider,
  token: string,
  expectedTenantId: string,
  load: (projectId: string) => Promise<FurnitureProjectState | null>,
) {
  const reference = await provider.resolve(token);
  if (!reference || reference.tenantId !== expectedTenantId) throw new Error("Ссылка восстановления недействительна.");
  const project = await load(reference.projectId);
  if (!project || project.tenantId !== expectedTenantId || project.projectId !== reference.projectId)
    throw new Error("Проект для восстановления не найден.");
  return FurnitureProjectStateSchema.parse(project);
}

export const ROLES = ["owner", "admin", "manager", "viewer", "public"] as const;
export type Role = (typeof ROLES)[number];
export type AdminAction = "read_lead" | "update_lead" | "read_settings" | "update_settings" | "read_costs";
const permissions: Record<Role, readonly AdminAction[]> = {
  owner: ["read_lead", "update_lead", "read_settings", "update_settings", "read_costs"],
  admin: ["read_lead", "update_lead", "read_settings", "update_settings", "read_costs"],
  manager: ["read_lead", "update_lead", "read_settings"],
  viewer: ["read_lead"],
  public: [],
};
export function requirePermission(role: Role, action: AdminAction) {
  if (!permissions[role].includes(action)) throw new Error(`Роль ${role} не имеет права ${action}.`);
}
