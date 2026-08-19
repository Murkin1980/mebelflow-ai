import { z } from "zod";
import { FurnitureProjectStateSchema, type FurnitureProjectState } from "../../project-state/src/schema.js";
import type { Contact } from "../../lead-admin/src/index.js";

export const REQUIRED_DISCLAIMER = "Предварительная схема и стоимость служат для первичного согласования. Точные размеры, материалы, конструкция и окончательная цена подтверждаются мебельщиком после проверки и замера.";
export const PdfPolicySchema = z.enum(["free", "after_contact", "after_order", "paid", "credited_to_order"]);
export type PdfPolicy = z.infer<typeof PdfPolicySchema>;
export type TenantBranding = { name: string; phone: string; accentColor: string; logoUrl?: string };
export type BriefDocument = {
  documentId: string; tenantId: string; projectId: string; generatedAt: string; title: string;
  branding: TenantBranding; contact: Pick<Contact, "name" | "phone"> | null;
  schemeSvg: string; wallWidth: number; roomHeight: number | null;
  modules: Array<{ id: string; type: string; width: number; position: number }>;
  stylePresetId: string | null; price: { min: number; max: number; currency: "KZT"; formulaVersion: number } | null;
  warnings: string[]; disclaimer: typeof REQUIRED_DISCLAIMER; pageFooter: string;
};

const BrandingSchema = z.object({ name: z.string().min(1).max(100), phone: z.string().regex(/^\+7\d{10}$/), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), logoUrl: z.string().url().optional() });
export function createBriefDocument(input: { documentId: string; state: FurnitureProjectState; branding: TenantBranding; contact?: Contact; schemeSvg: string; generatedAt: string }): BriefDocument {
  const state = FurnitureProjectStateSchema.parse(input.state);
  const branding = BrandingSchema.parse(input.branding);
  if (state.room.wallWidth === null) throw new Error("Нельзя создать ТЗ без ширины стены.");
  const scheme = input.schemeSvg.trim();
  if (!scheme.startsWith("<svg") || scheme.length > 1_000_000 || /<script|\son\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:)/i.test(scheme)) throw new Error("Некорректная или небезопасная SVG-схема.");
  if (!input.documentId.trim() || Number.isNaN(Date.parse(input.generatedAt))) throw new Error("Некорректные метаданные PDF.");
  const price = state.pricing.estimateMin !== null && state.pricing.estimateMax !== null ? { min: state.pricing.estimateMin, max: state.pricing.estimateMax, currency: "KZT" as const, formulaVersion: state.pricing.formulaVersion } : null;
  return {
    documentId: input.documentId, tenantId: state.tenantId, projectId: state.projectId, generatedAt: input.generatedAt,
    title: "Предварительное техническое задание на кухню", branding,
    contact: input.contact ? { name: input.contact.name, phone: input.contact.phone } : null,
    schemeSvg: input.schemeSvg, wallWidth: state.room.wallWidth, roomHeight: state.room.roomHeight,
    modules: state.lowerRow.modules.map(({ id, type, width, position }) => ({ id, type, width, position })),
    stylePresetId: state.style.presetId, price, warnings: state.warnings.map(item => item.message), disclaimer: REQUIRED_DISCLAIMER,
    pageFooter: `${branding.name} · ${branding.phone} · Предварительное ТЗ`,
  };
}

export type PaymentStatus = { paid: boolean; amountKzt: number; paymentId: string | null };
export interface PaymentProvider { status(referenceId: string): Promise<PaymentStatus> }
export class FakePaymentProvider implements PaymentProvider { readonly calls: string[] = []; constructor(private readonly result: PaymentStatus) {} async status(referenceId: string) { this.calls.push(referenceId); return structuredClone(this.result); } }
export type PdfAccessContext = { contactVerified: boolean; orderConfirmed: boolean; paymentReference?: string; requiredPaymentKzt?: number };
export type PdfAccessDecision = { allowed: boolean; reason: string; creditOnOrderKzt: number; paymentId: string | null };
export async function evaluatePdfAccess(policy: PdfPolicy, context: PdfAccessContext, payment: PaymentProvider): Promise<PdfAccessDecision> {
  PdfPolicySchema.parse(policy);
  if (policy === "free") return { allowed: true, reason: "PDF доступен бесплатно.", creditOnOrderKzt: 0, paymentId: null };
  if (policy === "after_contact") return { allowed: context.contactVerified, reason: context.contactVerified ? "Контакт подтверждён." : "Сначала подтвердите телефон.", creditOnOrderKzt: 0, paymentId: null };
  if (policy === "after_order") return { allowed: context.orderConfirmed, reason: context.orderConfirmed ? "Заказ подтверждён." : "PDF доступен после подтверждения заказа.", creditOnOrderKzt: 0, paymentId: null };
  if (!context.paymentReference || !Number.isFinite(context.requiredPaymentKzt) || (context.requiredPaymentKzt ?? 0) <= 0) return { allowed: false, reason: "Требуется подтверждённая оплата PDF.", creditOnOrderKzt: 0, paymentId: null };
  const status = await payment.status(context.paymentReference);
  if (!status.paid || status.amountKzt < context.requiredPaymentKzt! || !status.paymentId) return { allowed: false, reason: "Оплата PDF не подтверждена полностью.", creditOnOrderKzt: 0, paymentId: null };
  return { allowed: true, reason: policy === "credited_to_order" ? "Оплата PDF будет зачтена в заказ." : "Оплата PDF подтверждена.", creditOnOrderKzt: policy === "credited_to_order" ? status.amountKzt : 0, paymentId: status.paymentId };
}

export type PdfAuditEvent = { id: string; documentId: string; type: "access_denied" | "grant_issued" | "downloaded" | "grant_revoked"; at: string; details: Record<string, string> };
export class PdfAuditLog { private readonly events: PdfAuditEvent[] = []; append(event: PdfAuditEvent) { this.events.push(structuredClone(event)); } list(documentId: string) { return structuredClone(this.events.filter(event => event.documentId === documentId)); } }
export type DownloadGrant = { token: string; documentId: string; tenantId: string; expiresAt: string; revoked: boolean };
export interface OpaqueDownloadTokenProvider { issue(): string }
export class FakeOpaqueDownloadTokenProvider implements OpaqueDownloadTokenProvider { private sequence = 0; issue() { return `test-opaque-token-${++this.sequence}`; } }
export class SecureDownloadService {
  private readonly grants = new Map<string, DownloadGrant>();
  constructor(private readonly audit: PdfAuditLog, private readonly tokens: OpaqueDownloadTokenProvider) {}
  issue(document: BriefDocument, decision: PdfAccessDecision, now: string, ttlMinutes = 15) {
    if (!decision.allowed) { this.log(document.documentId, "access_denied", now, { reason: decision.reason }); throw new Error(decision.reason); }
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) throw new Error("Срок ссылки должен быть от 1 до 60 минут.");
    const token = this.tokens.issue(); if (!token || this.grants.has(token)) throw new Error("Не удалось выдать уникальную ссылку PDF.");
    const grant = { token, documentId: document.documentId, tenantId: document.tenantId, expiresAt: new Date(Date.parse(now) + ttlMinutes * 60_000).toISOString(), revoked: false };
    this.grants.set(token, grant); this.log(document.documentId, "grant_issued", now, { expiresAt: grant.expiresAt }); return structuredClone(grant);
  }
  resolve(token: string, tenantId: string, now: string) {
    const grant = this.grants.get(token);
    if (!grant || grant.tenantId !== tenantId || grant.revoked || Date.parse(now) >= Date.parse(grant.expiresAt)) throw new Error("Ссылка на PDF недействительна или истекла.");
    this.log(grant.documentId, "downloaded", now, {}); return structuredClone(grant);
  }
  revoke(token: string, now: string) { const grant = this.grants.get(token); if (!grant) return; grant.revoked = true; this.log(grant.documentId, "grant_revoked", now, {}); }
  private log(documentId: string, type: PdfAuditEvent["type"], at: string, details: Record<string, string>) { const count = this.audit.list(documentId).length + 1; this.audit.append({ id: `${documentId}:pdf-event:${count}`, documentId, type, at, details }); }
}
