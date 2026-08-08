import { createServer } from "node:http";
import { AiGateway, OpenAiIntentProvider } from "../../dist/packages/ai-gateway/src/index.js";
import { createApiHandler, createFetchSender, createTurnstileWorkerVerifier, loadApiEnvironment } from "../../dist/packages/api-gateway/src/index.js";
import { createFirestoreCoordinationStore } from "../../dist/packages/firestore-coordination/src/index.js";
import { createOpenAiTranscriptionProvider, createTranscriptionHandler } from "../../dist/packages/transcription-gateway/src/index.js";

const env = loadApiEnvironment(process.env);
const allowedTenant = process.env.PILOT_TENANT_ID ?? "salamat-mebel-pilot";
const allowedOrigin = process.env.PILOT_ALLOWED_ORIGIN;
if (!allowedOrigin) throw new Error("PILOT_ALLOWED_ORIGIN is required.");
const turnstileVerifyUrl = process.env.TURNSTILE_VERIFY_URL;
const turnstileExpectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME;
if (!turnstileVerifyUrl || !turnstileExpectedHostname) throw new Error("TURNSTILE_VERIFY_URL and TURNSTILE_EXPECTED_HOSTNAME are required.");

const provider = new OpenAiIntentProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, sender: createFetchSender() });
const coordination = createFirestoreCoordinationStore(Number(process.env.TENANT_RPM ?? 400));
const gateway = new AiGateway(provider, {
  maxCallsPerSession: 25,
  maxInputTokensPerSession: 30_000,
  maxOutputTokensPerSession: 5_000,
  maxConcurrentRequests: 100,
  tenantBudgetKzt: Number(process.env.TENANT_BUDGET_KZT ?? 50_000),
  usdKzt: env.USD_KZT_RATE,
}, async () => {}, coordination);
const humanVerifier = createTurnstileWorkerVerifier({ url: turnstileVerifyUrl, expectedHostname: turnstileExpectedHostname });
const handler = createApiHandler({ gateway, requestGate: coordination, humanVerifier, allowedOriginsByTenant: { [allowedTenant]: [allowedOrigin] } });
const transcriptionHandler = createTranscriptionHandler({
  allowedOriginsByTenant: { [allowedTenant]: [allowedOrigin] }, humanVerifier, requestGate: coordination, store: coordination,
  provider: createOpenAiTranscriptionProvider({ apiKey: env.OPENAI_API_KEY }), tenantBudgetKzt: Number(process.env.TENANT_BUDGET_KZT ?? 50_000), usdKzt: env.USD_KZT_RATE,
});

const readJson = async (request, maxBytes = 64 * 1024) => {
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > maxBytes) throw new Error("PAYLOAD_TOO_LARGE"); chunks.push(chunk); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "access-control-allow-origin": request.headers.origin ?? "", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,x-idempotency-key", "access-control-max-age": "600" }); response.end(); return;
    }
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (request.method === "POST" && path === "/v1/transcribe") {
      const body = await readJson(request, 8 * 1024 * 1024);
      const result = await transcriptionHandler({ origin: request.headers.origin, body });
      const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...(request.headers.origin === allowedOrigin ? { "access-control-allow-origin": allowedOrigin, vary: "origin" } : {}) };
      response.writeHead(result.status, headers); response.end(JSON.stringify(result.body)); return;
    }
    const result = await handler({ method: request.method ?? "GET", path, origin: request.headers.origin, body: request.method === "POST" ? await readJson(request) : undefined });
    const responseHeaders = request.headers.origin === allowedOrigin
      ? { ...result.headers, "access-control-allow-origin": allowedOrigin, vary: "origin" }
      : result.headers;
    response.writeHead(result.status, responseHeaders); response.end(JSON.stringify(result.body));
  } catch (caught) {
    const tooLarge = caught instanceof Error && caught.message === "PAYLOAD_TOO_LARGE";
    response.writeHead(tooLarge ? 413 : 400, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify({ error: { code: tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON", message: "Запрос не обработан." } }));
  }
});

server.listen(Number(process.env.PORT ?? 8080));
