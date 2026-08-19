import { describe, expect, it } from "vitest";
import { createEmbedSnippet, createFunnelReport, decidePilot, PILOT_TENANT_CONFIG, PilotCostCollector, PilotEventCollector, PilotStudy } from "./index.js";

describe("pilot configuration", () => {
  it("creates an allowlisted landing embed and rejects foreign origins", () => {
    expect(createEmbedSnippet(PILOT_TENANT_CONFIG, "https://grand-mebel.kz")).toContain('data-tenant="grand-mebel-pilot"');
    expect(() => createEmbedSnippet(PILOT_TENANT_CONFIG, "https://evil.example")).toThrow("Origin");
  });
});

describe("pilot telemetry", () => {
  it("records idempotent analytics with sanitized error codes only", () => {
    const events = new PilotEventCollector(); const base = { id: "e1", tenantId: PILOT_TENANT_CONFIG.tenantId, sessionId: "s1", type: "session_started", at: "2026-08-02T10:00:00Z" } as const;
    events.record(base); events.record(base); expect(events.list(PILOT_TENANT_CONFIG.tenantId)).toHaveLength(1);
    expect(() => events.record({ ...base, id: "e2", type: "error", errorCode: "user@example.com" })).toThrow();
  });
  it("builds a cost dashboard and hard-stops at tenant budget", () => {
    const costs = new PilotCostCollector(); costs.record({ id: "c1", tenantId: PILOT_TENANT_CONFIG.tenantId, sessionId: "s1", category: "text_ai", amountKzt: 30_000, at: "2026-08-02T10:00:00Z" }); costs.record({ id: "c2", tenantId: PILOT_TENANT_CONFIG.tenantId, sessionId: "s1", category: "stt", amountKzt: 20_000, at: "2026-08-02T10:01:00Z" });
    expect(costs.dashboard(PILOT_TENANT_CONFIG.tenantId, 50_000)).toMatchObject({ totalKzt: 50_000, remainingKzt: 0, hardStop: true });
  });
});

describe("pilot gate", () => {
  it("refuses to invent a go/no-go decision before real sample targets", () => {
    const report = createFunnelReport(PILOT_TENANT_CONFIG, new PilotStudy(), new PilotEventCollector(), new PilotCostCollector());
    expect(decidePilot(PILOT_TENANT_CONFIG, report)).toMatchObject({ status: "WAITING_FOR_DATA" });
    expect(decidePilot(PILOT_TENANT_CONFIG, report).reasons).toHaveLength(3);
  });
  it("accepts interview notes only for real prospects", () => {
    const study = new PilotStudy(); study.addSession({ id: "s1", tenantId: PILOT_TENANT_CONFIG.tenantId, kind: "controlled", participantCode: "TEST-01", startedAt: "2026-08-02T10:00:00Z", completedAt: null });
    expect(() => study.addInterview({ sessionId: "s1", participantCode: "TEST-01", note: "Пользователю было понятно управление.", at: "2026-08-02T11:00:00Z" })).toThrow("prospect");
  });
  it("rejects PII in interview notes and ignores events outside registered sessions", () => {
    const study = new PilotStudy(); study.addSession({ id: "real-1", tenantId: PILOT_TENANT_CONFIG.tenantId, kind: "real_prospect", participantCode: "REAL-01", startedAt: "2026-08-02T10:00:00Z", completedAt: null });
    expect(() => study.addInterview({ sessionId: "real-1", participantCode: "REAL-01", note: "Позвонить +7 701 123 45 67 после обеда", at: "2026-08-02T11:00:00Z" })).toThrow("телефон");
    const events = new PilotEventCollector(); events.record({ id: "foreign", tenantId: PILOT_TENANT_CONFIG.tenantId, sessionId: "not-registered", type: "session_started", at: "2026-08-02T10:00:00Z" });
    expect(createFunnelReport(PILOT_TENANT_CONFIG, study, events, new PilotCostCollector()).completionRate).toBe(0);
  });
  it("produces GO only after thresholds and healthy funnel metrics", () => {
    const study = new PilotStudy(); const events = new PilotEventCollector(); const costs = new PilotCostCollector();
    for (let index = 1; index <= 25; index++) {
      const sessionId = `s${index}`; const prospect = index > 20; const participantCode = prospect ? `REAL-${index}` : `TEST-${index}`;
      study.addSession({ id: sessionId, tenantId: PILOT_TENANT_CONFIG.tenantId, kind: prospect ? "real_prospect" : "controlled", participantCode, startedAt: "2026-08-02T10:00:00Z", completedAt: "2026-08-02T10:10:00Z" });
      if (prospect) study.addInterview({ sessionId, participantCode, note: "Реальный участник понял сценарий и предварительную цену.", at: "2026-08-02T10:15:00Z" });
      events.record({ id: `start-${index}`, tenantId: PILOT_TENANT_CONFIG.tenantId, sessionId, type: "session_started", at: "2026-08-02T10:00:00Z" });
      if (index <= 20) events.record({ id: `done-${index}`, tenantId: PILOT_TENANT_CONFIG.tenantId, sessionId, type: "layout_completed", at: "2026-08-02T10:05:00Z" });
      if (index <= 8) events.record({ id: `contact-${index}`, tenantId: PILOT_TENANT_CONFIG.tenantId, sessionId, type: "contact_submitted", at: "2026-08-02T10:08:00Z" });
    }
    const report = createFunnelReport(PILOT_TENANT_CONFIG, study, events, costs);
    expect(report).toMatchObject({ controlledSessions: 20, realProspects: 5, interviewCount: 5, completionRate: .8, contactRate: .32 });
    expect(decidePilot(PILOT_TENANT_CONFIG, report).status).toBe("GO");
  });
});
