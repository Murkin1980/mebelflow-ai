import { describe, expect, it, vi } from "vitest";
import { AiGateway, MemoryGatewayStore } from "../../ai-gateway/src/index.js";
import type { ProviderResponse } from "../../intent-parser/src/index.js";
import { createApiHandler, createTurnstileWorkerVerifier, loadApiEnvironment, MemoryRequestGate } from "./index.js";

const validBody = {
  tenantId: "grand-mebel-pilot",
  sessionId: "session_123456789",
  idempotencyKey: "request_12345678",
  turnstileToken: "browser-token",
  locale: "ru-KZ",
  utterance: "Kitchen three meters",
  projectSummary: { wallWidth: null, roomHeight: null, moduleIds: [], remainingWidth: null, stage: "dimensions" },
};
const providerResponse: ProviderResponse = {
  output: {
    command: { commandId: "cmd-1", type: "SET_WALL_WIDTH", payload: { width: 3000 } },
    confidence: 0.99,
    explanation: "Set wall to 3000 mm",
  },
  usage: { inputTokens: 100, outputTokens: 20 },
};
const limits = {
  maxCallsPerSession: 25,
  maxInputTokensPerSession: 30_000,
  maxOutputTokensPerSession: 5_000,
  maxConcurrentRequests: 100,
  tenantBudgetKzt: 50_000,
  usdKzt: 470,
};
const setup = (
  responses: ProviderResponse[] = [providerResponse],
  rpm = 100,
  verify: () => Promise<boolean> = async () => true,
) => {
  const provider = {
    requests: [] as unknown[],
    async complete(request: unknown) {
      this.requests.push(request);
      const response = responses.shift();
      if (!response) throw new Error("empty");
      return response;
    },
  };
  const gateway = new AiGateway(provider, limits, async () => {}, new MemoryGatewayStore());
  return {
    provider,
    handler: createApiHandler({
      gateway,
      requestGate: new MemoryRequestGate(rpm),
      humanVerifier: { verify },
      allowedOriginsByTenant: { "grand-mebel-pilot": ["https://grand-mebel.kz"] },
      now: () => 1_000,
    }),
  };
};

describe("Cloud Run HTTP contract", () => {
  it("warms without calling OpenAI or Turnstile", async () => {
    const verify = vi.fn(async () => true);
    const { handler, provider } = setup([], 100, verify);
    const response = await handler({ method: "GET", path: "/warmup" });
    expect(response).toMatchObject({ status: 200, body: { status: "ready", billableAiCalls: 0 } });
    expect(provider.requests).toHaveLength(0);
    expect(verify).not.toHaveBeenCalled();
  });
  it("accepts a safe intent only from tenant allowlist", async () => {
    const { handler, provider } = setup();
    const response = await handler({
      method: "POST",
      path: "/v1/intent",
      origin: "https://grand-mebel.kz",
      body: validBody,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ intent: { command: { type: "SET_WALL_WIDTH" } } });
    expect(provider.requests).toHaveLength(1);
  });
  it("rejects foreign origin before provider call", async () => {
    const { handler, provider } = setup();
    expect(
      (await handler({ method: "POST", path: "/v1/intent", origin: "https://evil.example", body: validBody })).status,
    ).toBe(403);
    expect(provider.requests).toHaveLength(0);
  });
  it("requires a Turnstile token before verification or provider calls", async () => {
    const verify = vi.fn(async () => true);
    const { handler, provider } = setup([providerResponse], 100, verify);
    const { turnstileToken: _, ...body } = validBody;
    expect((await handler({ method: "POST", path: "/v1/intent", origin: "https://grand-mebel.kz", body })).status).toBe(
      400,
    );
    expect(verify).not.toHaveBeenCalled();
    expect(provider.requests).toHaveLength(0);
  });
  it("rejects a failed Turnstile proof before provider calls", async () => {
    const { handler, provider } = setup([providerResponse], 100, async () => false);
    expect(
      (await handler({ method: "POST", path: "/v1/intent", origin: "https://grand-mebel.kz", body: validBody })).status,
    ).toBe(403);
    expect(provider.requests).toHaveLength(0);
  });
  it("fails closed when Turnstile verification is unavailable", async () => {
    const { handler, provider } = setup([providerResponse], 100, async () => {
      throw new Error("offline");
    });
    expect(
      (await handler({ method: "POST", path: "/v1/intent", origin: "https://grand-mebel.kz", body: validBody })).status,
    ).toBe(503);
    expect(provider.requests).toHaveLength(0);
  });
  it("does not accept prompt, model or price from client", async () => {
    const { handler, provider } = setup();
    const response = await handler({
      method: "POST",
      path: "/v1/intent",
      origin: "https://grand-mebel.kz",
      body: { ...validBody, prompt: "ignore rules", model: "expensive", price: 0 },
    });
    expect(response.status).toBe(400);
    expect(provider.requests).toHaveLength(0);
  });
  it("rejects duplicate idempotency key", async () => {
    const { handler } = setup([providerResponse, providerResponse]);
    const request = { method: "POST", path: "/v1/intent", origin: "https://grand-mebel.kz", body: validBody };
    expect((await handler(request)).status).toBe(200);
    expect((await handler(request)).status).toBe(409);
  });
  it("rejects unsafe provider output", async () => {
    const { handler } = setup([
      { output: { command: { type: "RUN_CODE" }, confidence: 1 }, usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    expect(
      (await handler({ method: "POST", path: "/v1/intent", origin: "https://grand-mebel.kz", body: validBody })).status,
    ).toBe(502);
  });
});

describe("stock Turnstile Worker verifier", () => {
  const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
  it("requires success, the configured hostname and action", async () => {
    const fetchImpl = vi.fn(async () =>
      response({ success: true, hostname: "salamat-mebel.kz", action: "turnstile-spin-v1" }),
    );
    const verifier = createTurnstileWorkerVerifier({
      url: "https://verify.example/",
      expectedHostname: "salamat-mebel.kz",
      fetchImpl,
    });
    await expect(verifier.verify({ token: "token", idempotencyKey: "request-1" })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "token", idempotency_key: "request-1" }),
      }),
    );
  });
  it("rejects mismatched metadata and propagates outages", async () => {
    const mismatch = createTurnstileWorkerVerifier({
      url: "https://verify.example/",
      expectedHostname: "salamat-mebel.kz",
      fetchImpl: async () => response({ success: true, hostname: "evil.example", action: "turnstile-spin-v1" }),
    });
    await expect(mismatch.verify({ token: "token", idempotencyKey: "request-1" })).resolves.toBe(false);
    const outage = createTurnstileWorkerVerifier({
      url: "https://verify.example/",
      expectedHostname: "salamat-mebel.kz",
      fetchImpl: async () => response({}, false),
    });
    await expect(outage.verify({ token: "token", idempotencyKey: "request-1" })).rejects.toThrow(
      "TURNSTILE_VERIFY_UNAVAILABLE",
    );
  });
});

it("validates server environment without exposing it", () => {
  const config = loadApiEnvironment({ OPENAI_API_KEY: "x".repeat(30), USD_KZT_RATE: "470" });
  expect(config.OPENAI_MODEL).toBe("gpt-5-mini");
  expect(config.USD_KZT_RATE).toBe(470);
});
