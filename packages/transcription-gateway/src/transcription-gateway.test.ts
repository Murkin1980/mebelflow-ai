import { describe, expect, it, vi } from "vitest";
import { MemoryGatewayStore } from "../../ai-gateway/src/index.js";
import { MemoryRequestGate } from "../../api-gateway/src/index.js";
import { calculateTranscriptionCost, createTranscriptionHandler, createVoiceCommandHandler } from "./index.js";

const body = { tenantId: "salamat-mebel-pilot", sessionId: "session_123456789", idempotencyKey: "voice_12345678", turnstileToken: "token", audioBase64: Buffer.from("audio").toString("base64"), mimeType: "audio/webm" };
const providerResult = { text: "Стена три метра", usage: { inputTokens: 1_000, outputTokens: 100 } };
function setup(options: { rpm?: number; verify?: () => Promise<boolean>; provider?: () => Promise<typeof providerResult>; budget?: number } = {}) {
  const store = new MemoryGatewayStore();
  const provider = vi.fn(options.provider ?? (async () => providerResult));
  const handler = createTranscriptionHandler({
    allowedOriginsByTenant: { "salamat-mebel-pilot": ["https://ai.salamat-mebel.kz"] },
    humanVerifier: { verify: options.verify ?? (async () => true) }, requestGate: new MemoryRequestGate(options.rpm ?? 10), store, provider,
    tenantBudgetKzt: options.budget ?? 50_000, usdKzt: 470, reservationInputTokens: 10_000, reservationOutputTokens: 1_000,
  });
  return { handler, provider, store };
}

describe("transcription gateway", () => {
  it("calculates versioned token cost", () => expect(calculateTranscriptionCost({ inputTokens: 1_000, outputTokens: 100 }, 470)).toMatchObject({ costKzt: 0.82 }));
  it("rejects foreign origins before verification/provider", async () => { const { handler, provider } = setup(); expect((await handler({ origin: "https://evil.example", body })).status).toBe(403); expect(provider).not.toHaveBeenCalled(); });
  it("fails closed when Turnstile is unavailable", async () => { const { handler, provider } = setup({ verify: async () => { throw new Error("offline"); } }); expect((await handler({ origin: "https://ai.salamat-mebel.kz", body })).status).toBe(503); expect(provider).not.toHaveBeenCalled(); });
  it("rejects duplicate requests before a second provider call", async () => { const { handler, provider } = setup(); expect((await handler({ origin: "https://ai.salamat-mebel.kz", body })).status).toBe(200); expect((await handler({ origin: "https://ai.salamat-mebel.kz", body })).status).toBe(409); expect(provider).toHaveBeenCalledTimes(1); });
  it("enforces tenant RPM", async () => { const { handler, provider } = setup({ rpm: 1 }); expect((await handler({ origin: "https://ai.salamat-mebel.kz", body })).status).toBe(200); expect((await handler({ origin: "https://ai.salamat-mebel.kz", body: { ...body, idempotencyKey: "voice_87654321" } })).status).toBe(429); expect(provider).toHaveBeenCalledTimes(1); });
  it("stops before provider when budget cannot be reserved", async () => { const { handler, provider } = setup({ budget: 0.01 }); expect((await handler({ origin: "https://ai.salamat-mebel.kz", body })).status).toBe(429); expect(provider).not.toHaveBeenCalled(); });
  it("refunds reservation after provider failure", async () => { const { handler, store } = setup({ provider: async () => { throw new Error("provider"); } }); expect((await handler({ origin: "https://ai.salamat-mebel.kz", body })).status).toBe(502); expect((await store.getTenantSpentKzt("salamat-mebel-pilot"))).toBe(0); });
  it("commits successful usage once", async () => { const { handler, store } = setup(); const response = await handler({ origin: "https://ai.salamat-mebel.kz", body }); expect(response.status).toBe(200); expect(await store.getTenantSpentKzt("salamat-mebel-pilot")).toBe(0.82); });
  it("rejects unsupported MIME types", async () => { const { handler, provider } = setup(); expect((await handler({ origin: "https://ai.salamat-mebel.kz", body: { ...body, mimeType: "audio/mp4" } })).status).toBe(400); expect(provider).not.toHaveBeenCalled(); });
});

describe("combined voice command gateway", () => {
  const voiceBody = { ...body, locale: "ru-KZ", projectSummary: { wallWidth: 3000, roomHeight: 2700, moduleIds: ["sink"], modules: [{ id: "sink", type: "sink_cabinet", width: 600, position: 0 }], remainingWidth: 2400, stage: "started" } };

  it("verifies the browser token once and returns transcript plus intent", async () => {
    const verify = vi.fn(async ({ token }: { token: string }) => token === "token");
    const transcriptionHandler = vi.fn(async () => ({ status: 200, body: { text: "перемести мойку вправо" } }));
    const intentHandler = vi.fn(async () => ({ status: 200, body: { intent: { command: { commandId: "move", type: "MOVE_RIGHT", payload: { id: "sink" } }, confidence: .99 } } }));
    const handler = createVoiceCommandHandler({ allowedOriginsByTenant: { "salamat-mebel-pilot": ["https://ai.salamat-mebel.kz"] }, humanVerifier: { verify }, transcriptionHandler, intentHandler });
    const result = await handler({ origin: "https://ai.salamat-mebel.kz", body: voiceBody });
    expect(result).toMatchObject({ status: 200, body: { transcript: "перемести мойку вправо", intent: { command: { type: "MOVE_RIGHT" } } } });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(transcriptionHandler).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ turnstileToken: "server-verified" }) }));
    expect(intentHandler).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ turnstileToken: "server-verified", utterance: "перемести мойку вправо" }) }));
  });

  it("stops before STT and intent when Turnstile rejects", async () => {
    const transcriptionHandler = vi.fn(); const intentHandler = vi.fn();
    const handler = createVoiceCommandHandler({ allowedOriginsByTenant: { "salamat-mebel-pilot": ["https://ai.salamat-mebel.kz"] }, humanVerifier: { verify: async () => false }, transcriptionHandler, intentHandler });
    expect((await handler({ origin: "https://ai.salamat-mebel.kz", body: voiceBody })).status).toBe(403);
    expect(transcriptionHandler).not.toHaveBeenCalled(); expect(intentHandler).not.toHaveBeenCalled();
  });

  it("does not call intent when transcription fails", async () => {
    const intentHandler = vi.fn();
    const handler = createVoiceCommandHandler({ allowedOriginsByTenant: { "salamat-mebel-pilot": ["https://ai.salamat-mebel.kz"] }, humanVerifier: { verify: async () => true }, transcriptionHandler: async () => ({ status: 502, body: { error: { code: "TRANSCRIPTION_FAILED" } } }), intentHandler });
    expect((await handler({ origin: "https://ai.salamat-mebel.kz", body: voiceBody })).status).toBe(502);
    expect(intentHandler).not.toHaveBeenCalled();
  });

  it("preserves transcript when intent fails so the user can recover", async () => {
    const handler = createVoiceCommandHandler({ allowedOriginsByTenant: { "salamat-mebel-pilot": ["https://ai.salamat-mebel.kz"] }, humanVerifier: { verify: async () => true }, transcriptionHandler: async () => ({ status: 200, body: { text: "мойка вправо" } }), intentHandler: async () => ({ status: 502, body: { error: { code: "PROVIDER_FAILED" } } }) });
    expect(await handler({ origin: "https://ai.salamat-mebel.kz", body: voiceBody })).toMatchObject({ status: 502, body: { transcript: "мойка вправо" } });
  });
});
