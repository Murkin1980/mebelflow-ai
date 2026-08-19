import { z } from "zod";
import type { ProjectHistory } from "../../project-state/src/reducer.js";
import type { IntentResult } from "../../intent-parser/src/index.js";
import { IntentSession, type ApplyResult } from "../../intent-parser/src/conversation.js";

export type VoiceStatus =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "processing"
  | "transcript_ready"
  | "applying"
  | "error";

export type MicrophonePermission = "unknown" | "granted" | "denied";
export type AudioCapture = { bytes: Uint8Array; mimeType: string };
export type SttRequest = { audio: AudioCapture; locale: "ru-KZ" | "kk-KZ" };
export type SttResponse = {
  transcript: string;
  confidence: number;
  billedSeconds: number;
};

export interface SttProvider {
  transcribe(request: SttRequest): Promise<SttResponse>;
}

export class FakeSttProvider implements SttProvider {
  readonly requests: SttRequest[] = [];
  constructor(private readonly responses: Array<SttResponse | Error>) {}
  async transcribe(request: SttRequest): Promise<SttResponse> {
    this.requests.push(structuredClone(request));
    const response = this.responses.shift();
    if (!response) throw new Error("Fake STT provider has no response.");
    if (response instanceof Error) throw response;
    return structuredClone(response);
  }
}

const SttResponseSchema = z.object({
  transcript: z.string().trim().min(1).max(2_000),
  confidence: z.number().min(0).max(1),
  billedSeconds: z.number().int().min(0).max(300),
});

export class VoiceCostLedger {
  private requests = 0;
  private billedSeconds = 0;
  constructor(private readonly costPerMinuteKzt: number) {
    if (!Number.isFinite(costPerMinuteKzt) || costPerMinuteKzt < 0) {
      throw new Error("STT cost per minute must be a non-negative number.");
    }
  }
  record(seconds: number) {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 300) {
      throw new Error("STT billed seconds must be an integer from 0 to 300.");
    }
    this.requests += 1;
    this.billedSeconds += seconds;
  }
  snapshot() {
    return {
      requests: this.requests,
      billedSeconds: this.billedSeconds,
      estimatedCostKzt: Math.round((this.billedSeconds / 60) * this.costPerMinuteKzt * 100) / 100,
    };
  }
}

export type VoiceErrorCode =
  | "permission_denied"
  | "offline"
  | "empty_recording"
  | "stt_failed"
  | "invalid_stt_response"
  | "intent_failed";

export type VoiceState = {
  status: VoiceStatus;
  permission: MicrophonePermission;
  transcript: string;
  transcriptConfidence: number | null;
  interpretation: string | null;
  message: string;
  errorCode: VoiceErrorCode | null;
  canRetry: boolean;
  textAlternativeAvailable: true;
};

const initialVoiceState = (): VoiceState => ({
  status: "idle",
  permission: "unknown",
  transcript: "",
  transcriptConfidence: null,
  interpretation: null,
  message: "Нажмите микрофон, чтобы сказать пожелание, или введите его текстом.",
  errorCode: null,
  canRetry: false,
  textAlternativeAvailable: true,
});

export class VoiceSession {
  private stateValue = initialVoiceState();
  private historyValue: ProjectHistory;
  private retainedAudio: AudioCapture | null = null;
  private online = true;

  constructor(
    private readonly stt: SttProvider,
    private readonly intent: IntentSession,
    history: ProjectHistory,
    readonly costs = new VoiceCostLedger(0),
    private readonly locale: "ru-KZ" | "kk-KZ" = "ru-KZ",
  ) {
    this.historyValue = history;
  }

  state() { return structuredClone(this.stateValue); }
  history() { return this.historyValue; }
  setOnline(online: boolean) { this.online = online; }

  async requestPermission(resolve: () => Promise<"granted" | "denied">) {
    this.stateValue = { ...this.stateValue, status: "requesting_permission", message: "Разрешите доступ к микрофону.", errorCode: null };
    const permission = await resolve();
    if (permission === "denied") {
      this.fail("permission_denied", "Доступ к микрофону запрещён. Разрешите его в браузере или введите команду текстом.", false);
      this.stateValue.permission = "denied";
      return;
    }
    this.stateValue = { ...initialVoiceState(), permission: "granted", message: "Микрофон готов. Нажмите ещё раз, чтобы начать запись." };
  }

  startRecording() {
    if (!this.online) return this.fail("offline", "Нет сети. Голос пока недоступен — введите команду текстом.", false);
    if (this.stateValue.permission !== "granted") throw new Error("Microphone permission is required.");
    this.retainedAudio = null;
    this.stateValue = { ...this.stateValue, status: "listening", transcript: "", transcriptConfidence: null, interpretation: null, message: "Идёт запись. Нажмите «Стоп», когда закончите.", errorCode: null, canRetry: false };
  }

  async stopRecording(audio: AudioCapture) {
    if (this.stateValue.status !== "listening") throw new Error("Recording is not active.");
    if (audio.bytes.byteLength === 0) return this.fail("empty_recording", "Запись пустая. Попробуйте ещё раз или введите команду текстом.", false);
    this.retainedAudio = structuredClone(audio);
    await this.transcribe(audio);
  }

  editTranscript(transcript: string) {
    if (this.stateValue.status !== "transcript_ready") throw new Error("Transcript is not ready.");
    const clean = transcript.trim();
    if (!clean) throw new Error("Transcript cannot be empty.");
    this.stateValue = { ...this.stateValue, transcript: clean, transcriptConfidence: 1, message: "Проверьте исправленный текст и подтвердите применение." };
  }

  async confirm(): Promise<ApplyResult | null> {
    if (this.stateValue.status !== "transcript_ready") throw new Error("Transcript confirmation is unavailable.");
    this.stateValue = { ...this.stateValue, status: "applying", message: "AI интерпретирует команду. Схема ещё не изменена." };
    const parsed: IntentResult = await this.intent.interpret(this.stateValue.transcript, this.historyValue.present);
    const applied = this.intent.apply(this.historyValue, parsed, true);
    this.stateValue.interpretation = applied.message;
    if (applied.status !== "applied") {
      this.fail("intent_failed", `${applied.message} Исправьте текст или попробуйте снова.`, false);
      return applied;
    }
    this.historyValue = applied.history;
    this.retainedAudio = null;
    this.stateValue = { ...this.stateValue, status: "idle", message: `${applied.message}. Изменение применено; его можно отменить.`, errorCode: null, canRetry: false };
    return applied;
  }

  cancel() {
    const permission = this.stateValue.permission;
    this.retainedAudio = null;
    this.stateValue = { ...initialVoiceState(), permission, message: "Голосовая команда отменена. Схема не изменена." };
  }

  async retry() {
    if (!this.stateValue.canRetry || !this.retainedAudio) throw new Error("There is no recording to retry.");
    if (!this.online) return this.fail("offline", "Сеть всё ещё недоступна. Запись сохранена в этой сессии; повторите позже или используйте текст.", true);
    await this.transcribe(this.retainedAudio);
  }

  private async transcribe(audio: AudioCapture) {
    if (!this.online) return this.fail("offline", "Нет сети. Запись не потеряна: повторите отправку или используйте текст.", true);
    this.stateValue = { ...this.stateValue, status: "processing", message: "Распознаю речь. Схема ещё не изменена.", errorCode: null, canRetry: false };
    let raw: SttResponse;
    try { raw = await this.stt.transcribe({ audio, locale: this.locale }); }
    catch { return this.fail("stt_failed", "Не удалось распознать речь. Запись не применена — повторите отправку или используйте текст.", true); }
    const parsed = SttResponseSchema.safeParse(raw);
    if (!parsed.success) return this.fail("invalid_stt_response", "Сервис речи вернул некорректный ответ. Схема не изменена; попробуйте снова.", true);
    this.costs.record(parsed.data.billedSeconds);
    this.stateValue = { ...this.stateValue, status: "transcript_ready", transcript: parsed.data.transcript, transcriptConfidence: parsed.data.confidence, message: "Проверьте распознанный текст. Команда применится только после подтверждения.", errorCode: null, canRetry: false };
  }

  private fail(code: VoiceErrorCode, message: string, canRetry: boolean) {
    this.stateValue = { ...this.stateValue, status: "error", message, errorCode: code, canRetry };
  }
}

export type VoiceViewModel = {
  primaryAction: "Разрешить микрофон" | "Записать" | "Стоп" | "Подтвердить" | "Повторить";
  secondaryAction: "Ввести текст";
  transcriptVisible: boolean;
  statusAnnouncement: string;
  minTouchTargetPx: 44;
  recordingIndicatorVisible: boolean;
};

export function createVoiceViewModel(state: VoiceState): VoiceViewModel {
  const primaryAction = state.status === "listening" ? "Стоп"
    : state.status === "transcript_ready" ? "Подтвердить"
    : state.status === "error" && state.canRetry ? "Повторить"
    : state.permission === "granted" ? "Записать" : "Разрешить микрофон";
  return {
    primaryAction,
    secondaryAction: "Ввести текст",
    transcriptVisible: state.transcript.length > 0,
    statusAnnouncement: state.message,
    minTouchTargetPx: 44,
    recordingIndicatorVisible: state.status === "listening",
  };
}
