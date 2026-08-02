import { z } from "zod";
import type { IntentProvider, ProviderRequest, ProviderResponse, ProviderUsage } from "../../intent-parser/src/index.js";

export type HttpResponse = { status: number; body: unknown; headers?: Record<string, string | undefined> };
export type NetworkSender = (request: { url: string; method: "POST"; headers: Record<string, string>; body: unknown }) => Promise<HttpResponse>;
export type OpenAiIntentProviderConfig = { apiKey: string; model?: string; endpoint?: string; sender: NetworkSender };

const ResponseSchema = z.object({
  output: z.array(z.object({ type: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).optional() }).passthrough()),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative(), input_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative().optional() }).optional() }),
});

function extractOutputText(response: z.infer<typeof ResponseSchema>) {
  for (const item of response.output) for (const content of item.content ?? []) if (content.type === "output_text" && content.text) return content.text;
  throw new Error("OpenAI response does not contain output_text.");
}

export class OpenAiIntentProvider implements IntentProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly sender: NetworkSender;
  constructor(config: OpenAiIntentProviderConfig) {
    if (!config.apiKey.trim()) throw new Error("OpenAI API key is required.");
    this.apiKey = config.apiKey; this.model = config.model ?? "gpt-5-mini"; this.endpoint = config.endpoint ?? "https://api.openai.com/v1/responses"; this.sender = config.sender;
  }
  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const outputContract = [
      "For a command return exactly {command:{commandId:string,type:allowed command,payload?:object,referenceId?:string},confidence:number,explanation?:string}. Never return a bare command.",
      "SET_WALL_WIDTH payload is {width: integer millimeters}.",
      "SET_ROOM_HEIGHT payload is {height: integer millimeters}.",
      "ADD_MODULE payload is {id: short unique ASCII slug, moduleType: exact catalog value, width: integer millimeters, edge:'left'|'right'}.",
      "Use moduleType sink_cabinet for a sink cabinet, dishwasher_450 or dishwasher_600 for a dishwasher, base_cabinet_drawers for drawers, base_cabinet_doors for a normal base cabinet, oven_base for an oven, cooktop_base for a cooktop, washing_machine for a washer, fridge for a refrigerator.",
      "INSERT_BEFORE and INSERT_AFTER require referenceId plus the same module payload without edge.",
      "For clarification return exactly {type:'CLARIFY',question:string,options?:string[],confidence:number}.",
      "Interpret Russian furniture phrases semantically. Example: 'добавь справа мойку 600 мм' means ADD_MODULE with moduleType sink_cabinet, width 600, edge right.",
    ].join(" ");
    const response = await this.sender({
      url: this.endpoint, method: "POST", headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: {
        model: this.model, reasoning: { effort: "minimal" }, max_output_tokens: 1_000,
        input: [
          { role: "system", content: `${request.prompt.system} Allowed commands: ${request.prompt.allowedCommands.join(", ")}. ${outputContract}` },
          { role: "user", content: JSON.stringify({ utterance: request.utterance, locale: request.locale, projectSummary: request.projectSummary }) },
        ],
        text: { format: { type: "json_schema", name: "mebelflow_intent_v1", strict: false, schema: {
          type: "object",
          properties: {
            command: { type: "object", properties: { commandId: { type: "string" }, type: { type: "string", enum: request.prompt.allowedCommands }, payload: { type: "object" }, referenceId: { type: "string" } }, required: ["commandId", "type"] },
            confidence: { type: "number", minimum: 0, maximum: 1 }, explanation: { type: "string" },
            type: { type: "string", enum: ["CLARIFY"] }, question: { type: "string" }, options: { type: "array", items: { type: "string" }, maxItems: 3 },
          },
          required: ["confidence"],
        } } },
      },
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`OpenAI request failed with status ${response.status}.`);
    const parsed = ResponseSchema.parse(response.body);
    return { output: JSON.parse(extractOutputText(parsed)), usage: { inputTokens: parsed.usage.input_tokens, cachedInputTokens: parsed.usage.input_tokens_details?.cached_tokens ?? 0, outputTokens: parsed.usage.output_tokens } };
  }
}

export const GPT5_MINI_PRICE_VERSION = "2026-08-02" as const;
export const GPT5_MINI_PRICE = { version: GPT5_MINI_PRICE_VERSION, model: "gpt-5-mini" as const, inputUsdPerMillion: 0.25, cachedInputUsdPerMillion: 0.025, outputUsdPerMillion: 2 };
const money = (value: number) => Math.round(value * 100) / 100;
export function calculateGpt5MiniCost(usage: ProviderUsage, usdKzt: number) {
  if (!Number.isFinite(usdKzt) || usdKzt <= 0) throw new Error("USD/KZT rate must be positive.");
  const cached = usage.cachedInputTokens ?? 0;
  if (cached > usage.inputTokens) throw new Error("Cached input tokens cannot exceed input tokens.");
  const costUsd = ((usage.inputTokens - cached) * GPT5_MINI_PRICE.inputUsdPerMillion + cached * GPT5_MINI_PRICE.cachedInputUsdPerMillion + usage.outputTokens * GPT5_MINI_PRICE.outputUsdPerMillion) / 1_000_000;
  return { model: GPT5_MINI_PRICE.model, priceVersion: GPT5_MINI_PRICE.version, usdKzt, costUsd: Math.round(costUsd * 100_000_000) / 100_000_000, costKzt: Math.round(costUsd * usdKzt * 100) / 100 };
}

export type GatewayLimits = { maxCallsPerSession: number; maxInputTokensPerSession: number; maxOutputTokensPerSession: number; maxConcurrentRequests: number; tenantBudgetKzt: number; usdKzt: number };
export type SessionUsage = { calls: number; inputTokens: number; outputTokens: number; costKzt: number };
export type UsageCommit = { tenantId: string; sessionId: string; usage: ProviderUsage; costKzt: number; reservationId: string; reservedKzt: number };
export interface GatewayStore {
  // Production implementations must make acquire and commit atomic across instances.
  acquireSession(tenantId: string, sessionId: string, ttlSeconds: number): Promise<string | null>;
  releaseSession(tenantId: string, sessionId: string, leaseToken: string): Promise<void>;
  getSessionUsage(tenantId: string, sessionId: string): Promise<SessionUsage>;
  getTenantSpentKzt(tenantId: string): Promise<number>;
  reserveTenantBudget(tenantId: string, reservationId: string, amountKzt: number, budgetKzt: number): Promise<boolean>;
  cancelTenantBudget(tenantId: string, reservationId: string, amountKzt: number): Promise<void>;
  commitUsage(input: UsageCommit): Promise<SessionUsage>;
}

export class MemoryGatewayStore implements GatewayStore {
  private readonly locks = new Map<string, string>(); private readonly sessions = new Map<string, SessionUsage>(); private readonly tenants = new Map<string, number>(); private readonly reserved = new Map<string, number>(); private readonly reservations = new Set<string>();
  private key(tenantId: string, sessionId: string) { return `${tenantId}:${sessionId}`; }
  async acquireSession(tenantId: string, sessionId: string, _ttlSeconds: number) { const key = this.key(tenantId, sessionId); if (this.locks.has(key)) return null; const token = crypto.randomUUID(); this.locks.set(key, token); return token; }
  async releaseSession(tenantId: string, sessionId: string, leaseToken: string) { const key = this.key(tenantId, sessionId); if (this.locks.get(key) === leaseToken) this.locks.delete(key); }
  async getSessionUsage(tenantId: string, sessionId: string) { return structuredClone(this.sessions.get(this.key(tenantId, sessionId)) ?? { calls: 0, inputTokens: 0, outputTokens: 0, costKzt: 0 }); }
  async getTenantSpentKzt(tenantId: string) { return this.tenants.get(tenantId) ?? 0; }
  async reserveTenantBudget(tenantId: string, reservationId: string, amountKzt: number, budgetKzt: number) { const key = `${tenantId}:${reservationId}`; if (this.reservations.has(key)) return true; if ((this.tenants.get(tenantId) ?? 0) + (this.reserved.get(tenantId) ?? 0) + amountKzt > budgetKzt) return false; this.reservations.add(key); this.reserved.set(tenantId, money((this.reserved.get(tenantId) ?? 0) + amountKzt)); return true; }
  async cancelTenantBudget(tenantId: string, reservationId: string, amountKzt: number) { const key = `${tenantId}:${reservationId}`; if (!this.reservations.delete(key)) return; this.reserved.set(tenantId, Math.max(0, money((this.reserved.get(tenantId) ?? 0) - amountKzt))); }
  async commitUsage(input: UsageCommit) {
    const reservationKey = `${input.tenantId}:${input.reservationId}`; if (!this.reservations.delete(reservationKey)) throw new Error("BUDGET_RESERVATION_MISSING");
    this.reserved.set(input.tenantId, Math.max(0, money((this.reserved.get(input.tenantId) ?? 0) - input.reservedKzt)));
    const key = this.key(input.tenantId, input.sessionId); const current = await this.getSessionUsage(input.tenantId, input.sessionId);
    const next = { calls: current.calls + 1, inputTokens: current.inputTokens + input.usage.inputTokens, outputTokens: current.outputTokens + input.usage.outputTokens, costKzt: Math.round((current.costKzt + input.costKzt) * 100) / 100 };
    this.sessions.set(key, next); this.tenants.set(input.tenantId, Math.round(((this.tenants.get(input.tenantId) ?? 0) + input.costKzt) * 100) / 100); return structuredClone(next);
  }
}

export class AiGateway {
  private activeRequests = 0; private warmed = false;
  constructor(private readonly provider: IntentProvider, private readonly limits: GatewayLimits, private readonly initialize: () => Promise<void> = async () => {}, private readonly store: GatewayStore = new MemoryGatewayStore()) {
    for (const [name, value] of Object.entries(limits)) if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive.`);
  }
  async warmup() { await this.initialize(); this.warmed = true; return { status: "ready" as const, billableAiCalls: 0 }; }
  isWarm() { return this.warmed; }
  async complete(sessionId: string, request: ProviderRequest) { return this.completeForTenant("default", sessionId, request); }
  async completeForTenant(tenantId: string, sessionId: string, request: ProviderRequest) {
    if (!tenantId.trim()) throw new Error("Tenant ID is required.");
    if (!sessionId.trim()) throw new Error("Opaque session ID is required.");
    if (this.activeRequests >= this.limits.maxConcurrentRequests) throw new Error("GATEWAY_BUSY");
    const leaseToken = await this.store.acquireSession(tenantId, sessionId, 65);
    if (!leaseToken) throw new Error("SESSION_REQUEST_IN_PROGRESS");
    this.activeRequests += 1;
    const reservationId = crypto.randomUUID();
    const reservedKzt = money((((this.limits.maxInputTokensPerSession * GPT5_MINI_PRICE.inputUsdPerMillion) + (this.limits.maxOutputTokensPerSession * GPT5_MINI_PRICE.outputUsdPerMillion)) / 1_000_000) * this.limits.usdKzt);
    let budgetReserved = false;
    try {
      const current = await this.store.getSessionUsage(tenantId, sessionId);
      if (current.calls >= this.limits.maxCallsPerSession) throw new Error("SESSION_CALL_LIMIT");
      if (current.inputTokens >= this.limits.maxInputTokensPerSession || current.outputTokens >= this.limits.maxOutputTokensPerSession) throw new Error("SESSION_TOKEN_LIMIT");
      if (!await this.store.reserveTenantBudget(tenantId, reservationId, reservedKzt, this.limits.tenantBudgetKzt)) throw new Error("TENANT_BUDGET_EXCEEDED");
      budgetReserved = true;
      const response = await this.provider.complete(request); const priced = calculateGpt5MiniCost(response.usage, this.limits.usdKzt);
      const next = { calls: current.calls + 1, inputTokens: current.inputTokens + response.usage.inputTokens, outputTokens: current.outputTokens + response.usage.outputTokens, costKzt: Math.round((current.costKzt + priced.costKzt) * 100) / 100 };
      if (next.inputTokens > this.limits.maxInputTokensPerSession || next.outputTokens > this.limits.maxOutputTokensPerSession) throw new Error("SESSION_TOKEN_LIMIT");
      const committed = await this.store.commitUsage({ tenantId, sessionId, usage: response.usage, costKzt: priced.costKzt, reservationId, reservedKzt });
      budgetReserved = false;
      return { response, cost: priced, sessionUsage: committed };
    } finally { if (budgetReserved) await this.store.cancelTenantBudget(tenantId, reservationId, reservedKzt); this.activeRequests -= 1; await this.store.releaseSession(tenantId, sessionId, leaseToken); }
  }
  usage(sessionId: string) { return this.store.getSessionUsage("default", sessionId); }
  async tenantUsage(tenantId = "default") { const spentKzt = await this.store.getTenantSpentKzt(tenantId); return { spentKzt, budgetKzt: this.limits.tenantBudgetKzt, remainingKzt: Math.max(0, this.limits.tenantBudgetKzt - spentKzt) }; }
}
