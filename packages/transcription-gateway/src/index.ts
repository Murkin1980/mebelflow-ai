import { z } from "zod";
import type { GatewayStore } from "../../ai-gateway/src/index.js";
import type { HumanVerifier, RequestGate } from "../../api-gateway/src/index.js";

export const GPT4O_MINI_TRANSCRIBE_PRICE = {
  version: "gpt-4o-mini-transcribe-2026-08-08",
  inputUsdPerMillion: 1.25,
  outputUsdPerMillion: 5,
} as const;

const RequestSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9-]{3,50}$/),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  turnstileToken: z.string().trim().min(1).max(4_096),
  audioBase64: z.string().min(1).max(1_500_000),
  mimeType: z.enum(["audio/webm", "audio/webm;codecs=opus"]),
}).strict();

const ResponseSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }).passthrough(),
}).passthrough();

export type TranscriptionUsage = { inputTokens: number; outputTokens: number };
export type TranscriptionProvider = (input: { audio: Uint8Array; mimeType: string }) => Promise<{ text: string; usage: TranscriptionUsage }>;
export type TranscriptionApiResponse = { status: number; body: unknown };

const VoiceCommandRequestSchema = RequestSchema.extend({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,120}$/),
  locale: z.enum(["ru-KZ", "kk-KZ"]),
  projectSummary: z.object({
    wallWidth: z.number().int().min(1_200).max(7_000).nullable(),
    roomHeight: z.number().int().min(2_200).max(4_000).nullable(),
    moduleIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)).max(40),
    modules: z.array(z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), type: z.string().min(1).max(50), width: z.number().int().positive().max(7_000), position: z.number().int().nonnegative().max(7_000) })).max(40).optional().default([]),
    remainingWidth: z.number().int().min(-7_000).max(7_000).nullable(),
    stage: z.string().min(1).max(40),
  }),
}).strict();

const money = (value: number) => Math.round(value * 100) / 100;
const error = (status: number, code: string, message: string): TranscriptionApiResponse => ({ status, body: { error: { code, message } } });

export function calculateTranscriptionCost(usage: TranscriptionUsage, usdKzt: number) {
  const costUsd = ((usage.inputTokens * GPT4O_MINI_TRANSCRIBE_PRICE.inputUsdPerMillion)
    + (usage.outputTokens * GPT4O_MINI_TRANSCRIBE_PRICE.outputUsdPerMillion)) / 1_000_000;
  return { costUsd, costKzt: money(costUsd * usdKzt), priceVersion: GPT4O_MINI_TRANSCRIBE_PRICE.version };
}

export function createOpenAiTranscriptionProvider(config: { apiKey: string; fetchImpl?: typeof fetch; timeoutMs?: number }): TranscriptionProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  return async input => {
    const bytes = new Uint8Array(input.audio.byteLength);
    bytes.set(input.audio);
    const form = new FormData();
    form.append("file", new Blob([bytes.buffer], { type: input.mimeType }), "voice.webm");
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "ru");
    form.append("response_format", "json");
    form.append("prompt", "Кухня, мойка, посудомоечная машина, ПММ, варочная панель, духовой шкаф, фасад, столешница, миллиметры.");
    const response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
    });
    if (!response.ok) throw new Error("TRANSCRIPTION_FAILED");
    const parsed = ResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("INVALID_TRANSCRIPTION_RESPONSE");
    return { text: parsed.data.text, usage: { inputTokens: parsed.data.usage.input_tokens, outputTokens: parsed.data.usage.output_tokens } };
  };
}

export function createTranscriptionHandler(config: {
  allowedOriginsByTenant: Record<string, readonly string[]>;
  humanVerifier: HumanVerifier;
  requestGate: RequestGate;
  store: GatewayStore;
  provider: TranscriptionProvider;
  tenantBudgetKzt: number;
  usdKzt: number;
  now?: () => number;
  reservationInputTokens?: number;
  reservationOutputTokens?: number;
}) {
  const now = config.now ?? Date.now;
  const reserved = calculateTranscriptionCost({ inputTokens: config.reservationInputTokens ?? 100_000, outputTokens: config.reservationOutputTokens ?? 20_000 }, config.usdKzt).costKzt;
  return async (request: { origin?: string; body: unknown }): Promise<TranscriptionApiResponse> => {
    const parsed = RequestSchema.safeParse(request.body);
    if (!parsed.success) return error(400, "INVALID_TRANSCRIPTION_REQUEST", "Проверьте данные голосовой команды.");
    const input = parsed.data;
    if (!request.origin || !(config.allowedOriginsByTenant[input.tenantId] ?? []).includes(request.origin)) return error(403, "ORIGIN_NOT_ALLOWED", "Этот сайт не подключён к MebelFlow.");
    let verified: boolean;
    try { verified = await config.humanVerifier.verify({ token: input.turnstileToken, idempotencyKey: input.idempotencyKey }); }
    catch { return error(503, "TURNSTILE_VERIFY_UNAVAILABLE", "Проверка безопасности временно недоступна."); }
    if (!verified) return error(403, "TURNSTILE_REJECTED", "Проверка безопасности не пройдена.");
    const gate = await config.requestGate.consume({ tenantId: input.tenantId, sessionId: `stt_${input.sessionId}`, idempotencyKey: input.idempotencyKey, atMs: now() });
    if (gate === "duplicate") return error(409, "DUPLICATE_REQUEST", "Голосовая команда уже была отправлена.");
    if (gate === "rate_limited") return error(429, "RATE_LIMITED", "Слишком много запросов. Подождите несколько секунд.");
    const audio = Uint8Array.from(Buffer.from(input.audioBase64, "base64"));
    if (!audio.byteLength || audio.byteLength > 1_000_000) return error(400, "INVALID_AUDIO", "Запись пуста или превышает допустимый размер.");
    const reservationId = crypto.randomUUID();
    if (!await config.store.reserveTenantBudget(input.tenantId, reservationId, reserved, config.tenantBudgetKzt)) return error(429, "TENANT_BUDGET_EXCEEDED", "Лимит голосовых запросов исчерпан.");
    let budgetReserved = true;
    try {
      const result = await config.provider({ audio, mimeType: input.mimeType });
      const cost = calculateTranscriptionCost(result.usage, config.usdKzt);
      await config.store.commitUsage({ tenantId: input.tenantId, sessionId: `stt_${input.sessionId}`, usage: result.usage, costKzt: cost.costKzt, reservationId, reservedKzt: reserved });
      budgetReserved = false;
      return { status: 200, body: { text: result.text, usage: result.usage, cost } };
    } catch {
      return error(502, "TRANSCRIPTION_FAILED", "Не удалось расшифровать запись. Повторите отправку или используйте текст.");
    } finally {
      if (budgetReserved) await config.store.cancelTenantBudget(input.tenantId, reservationId, reserved);
    }
  };
}

export function createVoiceCommandHandler(config: {
  allowedOriginsByTenant: Record<string, readonly string[]>;
  humanVerifier: HumanVerifier;
  transcriptionHandler: ReturnType<typeof createTranscriptionHandler>;
  intentHandler: (request: { method: string; path: string; origin?: string; body?: unknown }) => Promise<{ status: number; body: unknown }>;
}) {
  return async (request: { origin?: string; body: unknown }): Promise<TranscriptionApiResponse> => {
    const parsed = VoiceCommandRequestSchema.safeParse(request.body);
    if (!parsed.success) return error(400, "INVALID_VOICE_COMMAND_REQUEST", "Проверьте данные голосовой команды.");
    const input = parsed.data;
    if (!request.origin || !(config.allowedOriginsByTenant[input.tenantId] ?? []).includes(request.origin)) return error(403, "ORIGIN_NOT_ALLOWED", "Этот сайт не подключён к MebelFlow.");
    let verified: boolean;
    try { verified = await config.humanVerifier.verify({ token: input.turnstileToken, idempotencyKey: input.idempotencyKey }); }
    catch { return error(503, "TURNSTILE_VERIFY_UNAVAILABLE", "Проверка безопасности временно недоступна."); }
    if (!verified) return error(403, "TURNSTILE_REJECTED", "Проверка безопасности не пройдена.");

    const transcription = await config.transcriptionHandler({ origin: request.origin, body: {
      tenantId: input.tenantId, sessionId: input.sessionId, idempotencyKey: `${input.idempotencyKey}_stt`, turnstileToken: "server-verified",
      audioBase64: input.audioBase64, mimeType: input.mimeType,
    } });
    if (transcription.status !== 200) return transcription;
    const transcript = (transcription.body as { text: string }).text;
    const intent = await config.intentHandler({ method: "POST", path: "/v1/intent", origin: request.origin, body: {
      tenantId: input.tenantId, sessionId: input.sessionId, idempotencyKey: `${input.idempotencyKey}_intent`, turnstileToken: "server-verified",
      locale: input.locale, utterance: transcript, projectSummary: input.projectSummary,
    } });
    if (intent.status !== 200) return { status: intent.status, body: { ...(intent.body as object), transcript } };
    return { status: 200, body: { transcript, ...(intent.body as object) } };
  };
}
