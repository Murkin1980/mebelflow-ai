import { describe, expect, it } from "vitest";
import { FakeIntentProvider, type ProviderRequest, type ProviderResponse } from "../../intent-parser/src/index.js";
import { AiGateway, calculateGpt5MiniCost, MemoryGatewayStore, OpenAiIntentProvider, type NetworkSender } from "./index.js";

const request: ProviderRequest = { utterance: "Кухня три метра", locale: "ru-KZ", projectSummary: { wallWidth: null, roomHeight: null, moduleIds: [], remainingWidth: null, stage: "dimensions" }, prompt: { version: 1, system: "Return a safe command.", allowedCommands: ["SET_WALL_WIDTH"] } };
const output = { command: { commandId: "c1", type: "SET_WALL_WIDTH", payload: { width: 3000 } }, confidence: 0.99 };
const response = (inputTokens = 1_000, outputTokens = 100): ProviderResponse => ({ output, usage: { inputTokens, outputTokens } });
const limits = { maxCallsPerSession: 25, maxInputTokensPerSession: 30_000, maxOutputTokensPerSession: 5_000, maxConcurrentRequests: 100, tenantBudgetKzt: 50_000, usdKzt: 470 };

describe("OpenAiIntentProvider", () => {
  it("uses GPT-5 mini Responses API with compact state", async () => {
    let sent: Parameters<NetworkSender>[0] | undefined;
    const provider = new OpenAiIntentProvider({ apiKey: "server-secret", sender: async value => { sent = value; return { status: 200, body: { output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }], usage: { input_tokens: 120, output_tokens: 20, input_tokens_details: { cached_tokens: 50 } } } }; } });
    await expect(provider.complete(request)).resolves.toEqual({ output, usage: { inputTokens: 120, cachedInputTokens: 50, outputTokens: 20 } });
    expect(sent?.url).toBe("https://api.openai.com/v1/responses"); expect(sent?.headers.authorization).toBe("Bearer server-secret"); expect(JSON.stringify(sent?.body)).not.toContain("phone");
    expect(JSON.stringify(sent?.body)).toContain("Never return a bare command"); expect(JSON.stringify(sent?.body)).toContain("SET_WALL_WIDTH");
  });
  it("rejects malformed provider output", async () => {
    const provider = new OpenAiIntentProvider({ apiKey: "x", sender: async () => ({ status: 200, body: { output: [], usage: { input_tokens: 1, output_tokens: 1 } } }) });
    await expect(provider.complete(request)).rejects.toThrow("output_text");
  });
});

describe("AiGateway", () => {
  it("warms dependencies without calling AI", async () => {
    const provider = new FakeIntentProvider([]); let initialized = 0; const gateway = new AiGateway(provider, limits, async () => { initialized += 1; });
    await expect(gateway.warmup()).resolves.toEqual({ status: "ready", billableAiCalls: 0 }); expect(initialized).toBe(1); expect(provider.requests).toHaveLength(0);
  });
  it("blocks simultaneous requests for the same session", async () => {
    let release: (() => void) | undefined; const provider = { complete: async () => { await new Promise<void>(resolve => { release = resolve; }); return response(); } }; const gateway = new AiGateway(provider, limits);
    const first = gateway.complete("session-1", request); await Promise.resolve(); await expect(gateway.complete("session-1", request)).rejects.toThrow("SESSION_REQUEST_IN_PROGRESS"); release?.(); await first;
  });
  it("shares the session lock between gateway instances through the store", async () => {
    let release: (() => void) | undefined; const store = new MemoryGatewayStore();
    const slow = { complete: async () => { await new Promise<void>(resolve => { release = resolve; }); return response(); } };
    const firstGateway = new AiGateway(slow, limits, async () => {}, store); const secondGateway = new AiGateway({ complete: async () => response() }, limits, async () => {}, store);
    const first = firstGateway.completeForTenant("tenant-a", "shared-session", request); await Promise.resolve();
    await expect(secondGateway.completeForTenant("tenant-a", "shared-session", request)).rejects.toThrow("SESSION_REQUEST_IN_PROGRESS"); release?.(); await first;
  });
  it("handles 100 different sessions concurrently", async () => {
    const gateway = new AiGateway({ complete: async () => response(100, 10) }, limits); const results = await Promise.all(Array.from({ length: 100 }, (_, index) => gateway.complete(`session-${index}`, request)));
    expect(results).toHaveLength(100); expect((await gateway.tenantUsage()).spentKzt).toBeGreaterThan(0);
  });
  it("checks session gates before provider calls", async () => {
    const provider = new FakeIntentProvider([response(30_000, 100)]); const gateway = new AiGateway(provider, { ...limits, maxCallsPerSession: 1 }); await gateway.complete("limited", request);
    await expect(gateway.complete("limited", request)).rejects.toThrow("SESSION_CALL_LIMIT"); expect(provider.requests).toHaveLength(1);
  });
  it("releases the distributed lock when a limit rejects the request", async () => {
    const store = new MemoryGatewayStore(); const provider = new FakeIntentProvider([response()]); const gateway = new AiGateway(provider, { ...limits, maxCallsPerSession: 1 }, async () => {}, store);
    await gateway.completeForTenant("tenant-a", "limited", request); await expect(gateway.completeForTenant("tenant-a", "limited", request)).rejects.toThrow("SESSION_CALL_LIMIT");
    expect(await store.acquireSession("tenant-a", "limited", 65)).not.toBeNull();
  });
  it("atomically blocks parallel calls that would over-reserve tenant budget", async () => {
    let release: (() => void) | undefined;
    const provider = { complete: async () => { await new Promise<void>(resolve => { release = resolve; }); return response(100, 10); } };
    const store = new MemoryGatewayStore(); const tight = { ...limits, tenantBudgetKzt: 10 };
    const first = new AiGateway(provider, tight, async () => {}, store).completeForTenant("tenant-a", "session-a", request);
    while (!release) await Promise.resolve();
    await expect(new AiGateway(provider, tight, async () => {}, store).completeForTenant("tenant-a", "session-b", request)).rejects.toThrow("TENANT_BUDGET_EXCEEDED");
    release?.(); await first;
  });
  it("returns a budget reservation when the provider fails", async () => {
    const store = new MemoryGatewayStore(); const tight = { ...limits, tenantBudgetKzt: 10 };
    const failed = new AiGateway({ complete: async () => { throw new Error("provider down"); } }, tight, async () => {}, store);
    await expect(failed.completeForTenant("tenant-a", "session-a", request)).rejects.toThrow("provider down");
    await expect(new AiGateway({ complete: async () => response(100, 10) }, tight, async () => {}, store).completeForTenant("tenant-a", "session-b", request)).resolves.toBeDefined();
  });
});

it("calculates versioned GPT-5 mini cost", () => {
  expect(calculateGpt5MiniCost({ inputTokens: 14_000, cachedInputTokens: 4_000, outputTokens: 2_000 }, 470)).toEqual({ model: "gpt-5-mini", priceVersion: "2026-08-02", usdKzt: 470, costUsd: 0.0066, costKzt: 3.1 });
});
