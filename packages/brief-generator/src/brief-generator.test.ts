import { describe, expect, it } from "vitest";
import { createInitialProject } from "../../project-state/src/schema.js";
import { createBriefDocument, evaluatePdfAccess, FakeOpaqueDownloadTokenProvider, FakePaymentProvider, PdfAuditLog, REQUIRED_DISCLAIMER, SecureDownloadService } from "./index.js";

const state = () => { const value = createInitialProject("project-1", "tenant-1"); value.room.wallWidth = 3000; value.room.roomHeight = 2700; value.lowerRow.modules = [{ id: "sink", type: "sink_cabinet", width: 800, height: 720, depth: 560, position: 0 }]; value.style.presetId = "japandi:sage:wood_veneer"; value.pricing = { currency: "KZT", estimateMin: 900000, estimateMax: 1100000, formulaVersion: 3, status: "preliminary" }; return value; };
const document = () => createBriefDocument({ documentId: "brief-1", state: state(), branding: { name: "Grand Mebel", phone: "+77011234567", accentColor: "#8A5A3B" }, contact: { name: "Мурат", phone: "+77017654321", consent: true }, schemeSvg: "<svg viewBox=\"0 0 3000 2700\"></svg>", generatedAt: "2026-08-02T10:00:00Z" });

describe("brief document", () => {
  it("contains branding, scheme, modules, style, preliminary price and disclaimer", () => {
    expect(document()).toMatchObject({ title: "Предварительное техническое задание на кухню", tenantId: "tenant-1", wallWidth: 3000, stylePresetId: "japandi:sage:wood_veneer", price: { min: 900000, max: 1100000, currency: "KZT", formulaVersion: 3 }, disclaimer: REQUIRED_DISCLAIMER });
    expect(document().modules).toEqual([{ id: "sink", type: "sink_cabinet", width: 800, position: 0 }]);
  });
  it("requires dimensions and a bounded SVG document", () => {
    const missing = state(); missing.room.wallWidth = null;
    expect(() => createBriefDocument({ documentId: "x", state: missing, branding: { name: "X", phone: "+77011234567", accentColor: "#000000" }, schemeSvg: "<svg></svg>", generatedAt: "2026-08-02T10:00:00Z" })).toThrow("ширины");
    expect(() => createBriefDocument({ documentId: "x", state: state(), branding: { name: "X", phone: "+77011234567", accentColor: "#000000" }, schemeSvg: "not-svg", generatedAt: "2026-08-02T10:00:00Z" })).toThrow("SVG");
    expect(() => createBriefDocument({ documentId: "x", state: state(), branding: { name: "X", phone: "+77011234567", accentColor: "#000000" }, schemeSvg: "<svg><script>alert(1)</script></svg>", generatedAt: "2026-08-02T10:00:00Z" })).toThrow("небезопасная");
  });
});

describe("PDF policy", () => {
  const unpaid = new FakePaymentProvider({ paid: false, amountKzt: 0, paymentId: null });
  it("supports free, after-contact and after-order modes", async () => {
    expect((await evaluatePdfAccess("free", { contactVerified: false, orderConfirmed: false }, unpaid)).allowed).toBe(true);
    expect((await evaluatePdfAccess("after_contact", { contactVerified: true, orderConfirmed: false }, unpaid)).allowed).toBe(true);
    expect((await evaluatePdfAccess("after_order", { contactVerified: false, orderConfirmed: false }, unpaid)).allowed).toBe(false);
  });
  it("uses payment boundary for paid and credits payment to an order when configured", async () => {
    const payment = new FakePaymentProvider({ paid: true, amountKzt: 5000, paymentId: "pay-1" });
    expect(await evaluatePdfAccess("paid", { contactVerified: true, orderConfirmed: false, paymentReference: "ref", requiredPaymentKzt: 5000 }, payment)).toMatchObject({ allowed: true, creditOnOrderKzt: 0, paymentId: "pay-1" });
    expect(await evaluatePdfAccess("credited_to_order", { contactVerified: true, orderConfirmed: false, paymentReference: "ref2", requiredPaymentKzt: 5000 }, payment)).toMatchObject({ allowed: true, creditOnOrderKzt: 5000 });
    expect(payment.calls).toEqual(["ref", "ref2"]);
  });
  it("never trusts a missing or unpaid payment", async () => {
    expect((await evaluatePdfAccess("paid", { contactVerified: true, orderConfirmed: false }, unpaid)).allowed).toBe(false);
    expect((await evaluatePdfAccess("paid", { contactVerified: true, orderConfirmed: false, paymentReference: "bad", requiredPaymentKzt: 5000 }, unpaid)).allowed).toBe(false);
    const underpaid = new FakePaymentProvider({ paid: true, amountKzt: 1000, paymentId: "small" });
    expect((await evaluatePdfAccess("paid", { contactVerified: true, orderConfirmed: false, paymentReference: "small", requiredPaymentKzt: 5000 }, underpaid)).allowed).toBe(false);
  });
});

describe("secure downloads", () => {
  it("issues tenant-bound expiring grants and writes audit events", () => {
    const audit = new PdfAuditLog(); const service = new SecureDownloadService(audit, new FakeOpaqueDownloadTokenProvider()); const doc = document();
    const grant = service.issue(doc, { allowed: true, reason: "ok", creditOnOrderKzt: 0, paymentId: null }, "2026-08-02T10:00:00Z", 15);
    expect(() => service.resolve(grant.token, "wrong-tenant", "2026-08-02T10:01:00Z")).toThrow();
    expect(service.resolve(grant.token, "tenant-1", "2026-08-02T10:01:00Z").documentId).toBe("brief-1");
    expect(() => service.resolve(grant.token, "tenant-1", "2026-08-02T10:16:00Z")).toThrow("истекла");
    expect(audit.list("brief-1").map(event => event.type)).toEqual(["grant_issued", "downloaded"]);
  });
  it("records denied access and supports revocation", () => {
    const audit = new PdfAuditLog(); const service = new SecureDownloadService(audit, new FakeOpaqueDownloadTokenProvider()); const doc = document();
    expect(() => service.issue(doc, { allowed: false, reason: "Оплата нужна", creditOnOrderKzt: 0, paymentId: null }, "2026-08-02T10:00:00Z")).toThrow("Оплата");
    const grant = service.issue(doc, { allowed: true, reason: "ok", creditOnOrderKzt: 0, paymentId: null }, "2026-08-02T10:00:00Z"); service.revoke(grant.token, "2026-08-02T10:02:00Z");
    expect(() => service.resolve(grant.token, "tenant-1", "2026-08-02T10:03:00Z")).toThrow();
    expect(audit.list("brief-1").map(event => event.type)).toEqual(["access_denied", "grant_issued", "grant_revoked"]);
  });
});
