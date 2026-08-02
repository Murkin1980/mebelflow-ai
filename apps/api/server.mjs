import { createServer } from "node:http";
import { AiGateway, OpenAiIntentProvider } from "../../dist/packages/ai-gateway/src/index.js";
import { createApiHandler, createFetchSender, createTurnstileWorkerVerifier, loadApiEnvironment } from "../../dist/packages/api-gateway/src/index.js";
import { createFirestoreCoordinationStore } from "../../dist/packages/firestore-coordination/src/index.js";

const env = loadApiEnvironment(process.env);
const allowedTenant = process.env.PILOT_TENANT_ID ?? "grand-mebel-pilot";
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
      if (request.headers.origin !== allowedOrigin) {
        response.writeHead(403, { "content-type": "application/json; charset=utf-8" }); response.end(JSON.stringify({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Этот сайт не подключён к MebelFlow." } })); return;
      }
      const body = await readJson(request, 8 * 1024 * 1024);
      if (!body || typeof body.audioBase64 !== "string" || typeof body.mimeType !== "string" || typeof body.turnstileToken !== "string" || typeof body.idempotencyKey !== "string") throw new Error("INVALID_TRANSCRIPTION_REQUEST");
      if (!await humanVerifier.verify({ token: body.turnstileToken, idempotencyKey: body.idempotencyKey })) {
        response.writeHead(403, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": allowedOrigin }); response.end(JSON.stringify({ error: { code: "TURNSTILE_REJECTED", message: "Проверка безопасности не пройдена." } })); return;
      }
      const audio = Buffer.from(body.audioBase64, "base64");
      if (!audio.length || audio.length > 6 * 1024 * 1024) throw new Error("INVALID_AUDIO");
      const form = new FormData();
      form.append("file", new Blob([audio], { type: body.mimeType }), "voice.webm");
      form.append("model", "gpt-4o-mini-transcribe");
      form.append("language", "ru");
      form.append("prompt", "Кухня, мойка, посудомоечная машина, ПММ, варочная панель, духовой шкаф, фасад, столешница, миллиметры.");
      const transcription = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(30_000) });
      if (!transcription.ok) throw new Error("TRANSCRIPTION_FAILED");
      const result = await transcription.json();
      if (typeof result.text !== "string" || !result.text.trim()) throw new Error("EMPTY_TRANSCRIPTION");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": allowedOrigin }); response.end(JSON.stringify({ text: result.text.trim() })); return;
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
