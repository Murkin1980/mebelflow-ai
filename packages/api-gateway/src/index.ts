import { z } from "zod";
import type { AiGateway, NetworkSender } from "../../ai-gateway/src/index.js";
import { CommandSchema } from "../../command-schema/src/index.js";
import { ClarifySchema, type ProviderRequest } from "../../intent-parser/src/index.js";
import { getPrompt } from "../../intent-parser/src/prompt.js";

export type ApiRequest = { method: string; path: string; origin?: string; body?: unknown };
export type ApiResponse = { status: number; headers: Record<string, string>; body: unknown };

const IntentRequestSchema = z
  .object({
    tenantId: z.string().regex(/^[a-z0-9-]{3,50}$/),
    sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
    turnstileToken: z.string().trim().min(1).max(4_096),
    locale: z.enum(["ru-KZ", "kk-KZ"]),
    utterance: z.string().trim().min(1).max(2_000),
    projectSummary: z.object({
      wallWidth: z.number().int().min(1_200).max(7_000).nullable(),
      roomHeight: z.number().int().min(2_200).max(4_000).nullable(),
      moduleIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)).max(40),
      modules: z
        .array(
          z.object({
            id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
            type: z.string().min(1).max(50),
            width: z.number().int().positive().max(7_000),
            position: z.number().int().nonnegative().max(7_000),
          }),
        )
        .max(40)
        .optional()
        .default([]),
      remainingWidth: z.number().int().min(-7_000).max(7_000).nullable(),
      stage: z.string().min(1).max(40),
    }),
  })
  .strict();

const SafeProviderOutputSchema = z.union([
  ClarifySchema,
  z
    .object({
      command: CommandSchema,
      confidence: z.number().min(0).max(1),
      explanation: z.string().min(1).max(240).optional(),
    })
    .strict(),
]);

export interface RequestGate {
  consume(input: {
    tenantId: string;
    sessionId: string;
    idempotencyKey: string;
    atMs: number;
  }): Promise<"allowed" | "duplicate" | "rate_limited">;
}

export interface HumanVerifier {
  verify(input: { token: string; idempotencyKey: string }): Promise<boolean>;
}

export class MemoryRequestGate implements RequestGate {
  private readonly ids = new Set<string>();
  private readonly windows = new Map<string, { start: number; count: number }>();
  constructor(private readonly requestsPerMinute: number) {
    if (!Number.isInteger(requestsPerMinute) || requestsPerMinute < 1)
      throw new Error("RPM must be a positive integer.");
  }
  async consume(input: { tenantId: string; sessionId: string; idempotencyKey: string; atMs: number }) {
    const id = `${input.tenantId}:${input.sessionId}:${input.idempotencyKey}`;
    if (this.ids.has(id)) return "duplicate" as const;
    const window = this.windows.get(input.tenantId);
    const current = !window || input.atMs - window.start >= 60_000 ? { start: input.atMs, count: 0 } : window;
    if (current.count >= this.requestsPerMinute) return "rate_limited" as const;
    current.count += 1;
    this.windows.set(input.tenantId, current);
    this.ids.add(id);
    return "allowed" as const;
  }
}

export type ApiHandlerConfig = {
  gateway: AiGateway;
  requestGate: RequestGate;
  humanVerifier: HumanVerifier;
  allowedOriginsByTenant: Record<string, readonly string[]>;
  now?: () => number;
};
const baseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const error = (status: number, code: string, message: string): ApiResponse => ({
  status,
  headers: baseHeaders,
  body: { error: { code, message } },
});

export function createApiHandler(config: ApiHandlerConfig) {
  const now = config.now ?? Date.now;
  return async (request: ApiRequest): Promise<ApiResponse> => {
    if (request.method === "GET" && request.path === "/warmup")
      return { status: 200, headers: baseHeaders, body: await config.gateway.warmup() };
    if (request.method !== "POST" || request.path !== "/v1/intent")
      return error(404, "NOT_FOUND", "Маршрут не найден.");
    const parsed = IntentRequestSchema.safeParse(request.body);
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Проверьте данные команды.");
    const allowed = config.allowedOriginsByTenant[parsed.data.tenantId] ?? [];
    if (!request.origin || !allowed.includes(request.origin))
      return error(403, "ORIGIN_NOT_ALLOWED", "Этот сайт не подключён к MebelFlow.");
    try {
      const human = await config.humanVerifier.verify({
        token: parsed.data.turnstileToken,
        idempotencyKey: parsed.data.idempotencyKey,
      });
      if (!human) return error(403, "TURNSTILE_REJECTED", "Turnstile verification was rejected.");
    } catch {
      return error(503, "TURNSTILE_VERIFY_UNAVAILABLE", "Turnstile verification is temporarily unavailable.");
    }
    const gate = await config.requestGate.consume({
      tenantId: parsed.data.tenantId,
      sessionId: parsed.data.sessionId,
      idempotencyKey: parsed.data.idempotencyKey,
      atMs: now(),
    });
    if (gate === "duplicate") return error(409, "DUPLICATE_REQUEST", "Команда уже была отправлена.");
    if (gate === "rate_limited") return error(429, "RATE_LIMITED", "Слишком много команд. Подождите несколько секунд.");
    const providerRequest: ProviderRequest = {
      utterance: parsed.data.utterance,
      locale: parsed.data.locale,
      projectSummary: parsed.data.projectSummary,
      prompt: getPrompt(),
    };
    try {
      const result = await config.gateway.completeForTenant(
        parsed.data.tenantId,
        parsed.data.sessionId,
        providerRequest,
      );
      const safeOutput = SafeProviderOutputSchema.safeParse(result.response.output);
      if (!safeOutput.success)
        return error(502, "UNSAFE_PROVIDER_RESPONSE", "AI вернул неподдерживаемую команду. Схема не изменена.");
      return {
        status: 200,
        headers: { ...baseHeaders, "access-control-allow-origin": request.origin },
        body: { intent: safeOutput.data, usage: result.response.usage, cost: result.cost },
      };
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "PROVIDER_FAILED";
      if (code === "SESSION_REQUEST_IN_PROGRESS") return error(409, code, "Предыдущая команда ещё обрабатывается.");
      if (code === "GATEWAY_BUSY") return error(503, code, "Сервис занят. Повторите через несколько секунд.");
      if (code.includes("LIMIT") || code === "TENANT_BUDGET_EXCEEDED")
        return error(429, code, "Лимит AI-сессии исчерпан.");
      return error(502, "PROVIDER_FAILED", "Не удалось обработать команду. Схема не изменена.");
    }
  };
}

const TurnstileWorkerResponseSchema = z
  .object({
    success: z.boolean(),
    hostname: z.string().optional(),
    action: z.string().optional(),
  })
  .passthrough();

export function createTurnstileWorkerVerifier(config: {
  url: string;
  expectedHostname: string;
  expectedAction?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): HumanVerifier {
  const url = new URL(config.url);
  if (url.protocol !== "https:") throw new Error("TURNSTILE_VERIFY_URL must use HTTPS.");
  const fetchImpl = config.fetchImpl ?? fetch;
  const expectedAction = config.expectedAction ?? "turnstile-spin-v1";
  const timeoutMs = config.timeoutMs ?? 8_000;
  return {
    async verify(input) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: input.token, idempotency_key: input.idempotencyKey }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("TURNSTILE_VERIFY_UNAVAILABLE");
        const result = TurnstileWorkerResponseSchema.parse(await response.json());
        return (
          result.success === true && result.hostname === config.expectedHostname && result.action === expectedAction
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function loadApiEnvironment(env: Record<string, string | undefined>) {
  const schema = z.object({
    OPENAI_API_KEY: z.string().min(20),
    OPENAI_MODEL: z.string().default("gpt-5-mini"),
    USD_KZT_RATE: z.coerce.number().positive().default(470),
  });
  return schema.parse({
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_MODEL: env.OPENAI_MODEL,
    USD_KZT_RATE: env.USD_KZT_RATE,
  });
}

export function createFetchSender(fetchImpl: typeof fetch = fetch, timeoutMs = 55_000): NetworkSender {
  return async (request) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
      const body = await response.json();
      return {
        status: response.status,
        body,
        headers: { "retry-after": response.headers.get("retry-after") ?? undefined },
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}
