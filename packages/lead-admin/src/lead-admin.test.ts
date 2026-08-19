import { describe, expect, it } from "vitest";
import { createInitialProject } from "../../project-state/src/schema.js";
import { FakeContactVerificationProvider, FakeLeadNotifier, FakeResumeTokenProvider, InMemoryLeadRepository, LeadService, requirePermission, resumeProject, TenantSettingsSchema, UsageGuard } from "./index.js";

const contact = { name: "Мурат", phone: "+77011234567", comment: "Позвонить вечером", consent: true } as const;
const project = () => { const state = createInitialProject("project-1", "tenant-1"); state.room.wallWidth = 3000; return state; };
const input = { requestId: "request-1", leadId: "lead-1", contact, project: project(), otpCode: "1234", attemptNumber: 1, now: "2026-08-02T09:00:00Z" };
const settings = TenantSettingsSchema.parse({ tenantId: "tenant-1", brandName: "Grand Mebel", locale: "ru-KZ", phone: "+77011234567", whatsapp: null, telegramChatId: "chat", enabledStyleIds: ["japandi"], standardWidths: [300, 450, 600], limits: { commandsPerSession: 2, sttSecondsPerSession: 30, projectsPerMonth: 5, aiBudgetKztPerMonth: 100 }, disclaimer: "Предварительная цена требует проверки и замера.", retentionDays: 30 });

describe("LeadService", () => {
  it("creates a verified lead with project snapshot and event history", async () => {
    const repository = new InMemoryLeadRepository(); const notifier = new FakeLeadNotifier();
    const service = new LeadService(repository, new FakeContactVerificationProvider(), notifier);
    const lead = await service.create(input);
    expect(lead).toMatchObject({ id: "lead-1", tenantId: "tenant-1", projectId: "project-1", status: "new" });
    expect(service.details(lead.id).events.map(event => event.type)).toEqual(["created", "notification_sent"]);
    expect(notifier.notifications).toEqual([{ leadId: "lead-1", tenantId: "tenant-1", projectId: "project-1" }]);
  });
  it("is idempotent by request id and does not notify twice", async () => {
    const notifier = new FakeLeadNotifier(); const service = new LeadService(new InMemoryLeadRepository(), new FakeContactVerificationProvider(), notifier);
    expect(await service.create(input)).toEqual(await service.create({ ...input, leadId: "other" }));
    expect(notifier.notifications).toHaveLength(1);
  });
  it("enforces OTP and CAPTCHA after threshold", async () => {
    await expect(new LeadService(new InMemoryLeadRepository(), new FakeContactVerificationProvider(false), new FakeLeadNotifier()).create(input)).rejects.toThrow("код");
    const verification = new FakeContactVerificationProvider(true, false);
    await expect(new LeadService(new InMemoryLeadRepository(), verification, new FakeLeadNotifier()).create({ ...input, attemptNumber: 3, captchaToken: "bad" })).rejects.toThrow("CAPTCHA");
    expect(verification.captchaCalls).toEqual(["bad"]);
  });
  it("validates contact consent and Kazakhstan phone format", async () => {
    const service = new LeadService(new InMemoryLeadRepository(), new FakeContactVerificationProvider(), new FakeLeadNotifier());
    await expect(service.create({ ...input, contact: { ...contact, phone: "123", consent: false } })).rejects.toThrow();
    await expect(service.create({ ...input, requestId: "request-otp", otpCode: "12x" })).rejects.toThrow("OTP");
    await expect(service.create({ ...input, requestId: "request-attempt", attemptNumber: 0 })).rejects.toThrow("попытки");
  });
  it("does not overwrite an existing lead id from another request", async () => {
    const service = new LeadService(new InMemoryLeadRepository(), new FakeContactVerificationProvider(), new FakeLeadNotifier());
    await service.create(input);
    await expect(service.create({ ...input, requestId: "request-2" })).rejects.toThrow("уже существует");
  });
  it("keeps a lead when Telegram notification fails and records the failure", async () => {
    const service = new LeadService(new InMemoryLeadRepository(), new FakeContactVerificationProvider(), new FakeLeadNotifier(new Error("offline")));
    const lead = await service.create(input);
    expect(service.details(lead.id).events.at(-1)?.type).toBe("notification_failed");
  });
  it("enforces status transitions and keeps append-only audit events", async () => {
    const service = new LeadService(new InMemoryLeadRepository(), new FakeContactVerificationProvider(), new FakeLeadNotifier()); await service.create(input);
    service.changeStatus("lead-1", "contacted", "manager-1", "2026-08-02T10:00:00Z");
    service.changeStatus("lead-1", "qualified", "manager-1", "2026-08-02T11:00:00Z");
    service.addComment("lead-1", "Назначить замер", "manager-1", "2026-08-02T11:05:00Z");
    expect(service.details("lead-1").events.map(event => event.type)).toEqual(["created", "notification_sent", "status_changed", "status_changed", "comment_added"]);
    expect(() => service.changeStatus("lead-1", "won", "manager-1", "2026-08-02T12:00:00Z")).toThrow("запрещён");
  });
});

describe("tenant controls", () => {
  it("hard-stops usage at tenant limits", () => {
    const guard = new UsageGuard(settings); guard.consume("commandsPerSession", 2);
    expect(() => guard.consume("commandsPerSession", 1)).toThrow("исчерпан");
    expect(guard.snapshot().commandsPerSession).toBe(2);
  });
  it("restores only an opaque token from the expected tenant", async () => {
    const provider = new FakeResumeTokenProvider(); const token = await provider.issue("tenant-1", "project-1");
    await expect(resumeProject(provider, token, "other-tenant", async () => project())).rejects.toThrow("недействительна");
    await expect(resumeProject(provider, token, "tenant-1", async () => ({ ...project(), projectId: "wrong" }))).rejects.toThrow("не найден");
    expect((await resumeProject(provider, token, "tenant-1", async () => project())).projectId).toBe("project-1");
  });
  it("enforces RBAC for lead and tenant settings", () => {
    expect(() => requirePermission("manager", "update_lead")).not.toThrow();
    expect(() => requirePermission("manager", "update_settings")).toThrow();
    expect(() => requirePermission("viewer", "update_lead")).toThrow();
    expect(() => requirePermission("public", "read_lead")).toThrow();
  });
});
