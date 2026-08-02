import { compactProjectState } from "../../../packages/intent-parser/src/index.js";
import { applyLayoutCommandToHistory, calculateRemainingWidth } from "../../../packages/layout-engine/src/index.js";
import { createHistory, createInitialProject, type ProjectHistory } from "../../../packages/project-state/src/index.js";
import { renderKitchenSvg } from "../../../packages/svg-renderer/src/index.js";

const API_URL = "https://mebelflow-api-staging-1013284205128.europe-central2.run.app";
const TENANT_ID = "salamat-mebel-pilot";
type IntentEnvelope = { intent: { type?: "CLARIFY"; question?: string; options?: string[]; command?: unknown; confidence?: number; explanation?: string }; cost?: { kzt?: number } };
type SpeechRecognitionEventLike = { results: ArrayLike<{ 0?: { transcript?: string }; isFinal?: boolean }> };
type SpeechRecognitionErrorLike = { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult?: (event: SpeechRecognitionEventLike) => void;
  onend?: () => void;
  onerror?: (event: SpeechRecognitionErrorLike) => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = byId<HTMLFormElement>("command-form");
const commandInput = byId<HTMLTextAreaElement>("command");
const send = byId<HTMLButtonElement>("send");
const confirm = byId<HTMLButtonElement>("confirm");
const undo = byId<HTMLButtonElement>("undo");
const mic = byId<HTMLButtonElement>("mic");
const status = byId<HTMLParagraphElement>("status");
const assistant = byId<HTMLParagraphElement>("assistant-message");
let history: ProjectHistory = createHistory(createInitialProject(crypto.randomUUID(), TENANT_ID));
let sessionId = `session_${crypto.randomUUID().replaceAll("-", "")}`;
let turnstileToken = "";
let pendingCommand: unknown;
let totalCost = 0;
let activeRecognition: SpeechRecognitionLike | null = null;
let speechWasRecognized = false;
let speechInitialText = "";

function render() {
  const state = history.present;
  byId("scheme").innerHTML = renderKitchenSvg(state, { title: "Предварительная схема кухни", description: "Схема обновляется после подтверждённых команд." });
  const remaining = calculateRemainingWidth(state);
  byId("wall-metric").textContent = state.room.wallWidth ? `${state.room.wallWidth} мм` : "не задана";
  byId("remaining-metric").textContent = remaining === null ? "—" : `${remaining} мм`;
  byId("cost-metric").textContent = `${totalCost.toFixed(2)} ₸`;
  undo.disabled = history.past.length === 0;
}

function setStatus(message: string, kind: "normal" | "error" | "success" = "normal") {
  status.textContent = message;
  status.className = `status${kind === "normal" ? "" : ` ${kind}`}`;
}

function resetTurnstile() {
  turnstileToken = "";
  send.disabled = true;
  const api = (window as typeof window & { turnstile?: { reset(): void } }).turnstile;
  api?.reset();
}

window.addEventListener("turnstile-success", event => {
  turnstileToken = (event as CustomEvent<string>).detail;
  send.disabled = !commandInput.value.trim();
  setStatus("Проверка пройдена. Команду можно отправить.", "success");
});
window.addEventListener("turnstile-expired", () => { resetTurnstile(); setStatus("Проверка истекла — пройдите её ещё раз.", "error"); });
commandInput.addEventListener("input", () => { send.disabled = !turnstileToken || !commandInput.value.trim(); });
document.querySelectorAll<HTMLButtonElement>("[data-example]").forEach(button => button.addEventListener("click", () => { commandInput.value = button.dataset.example ?? ""; commandInput.focus(); send.disabled = !turnstileToken; }));

async function callAi(utterance: string) {
  const idempotencyKey = `request_${crypto.randomUUID().replaceAll("-", "")}`;
  const response = await fetch(`${API_URL}/v1/intent`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantId: TENANT_ID, sessionId, idempotencyKey, turnstileToken, locale: "ru-KZ", utterance, projectSummary: compactProjectState(history.present) }),
  });
  const body = await response.json() as IntentEnvelope & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "Сервис временно недоступен.");
  return body;
}

function apply(command: unknown, explanation?: string) {
  history = applyLayoutCommandToHistory(history, command);
  render();
  assistant.textContent = explanation ?? "Изменение применено. Что добавим дальше?";
  setStatus("Схема обновлена. Изменение можно отменить.", "success");
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const utterance = commandInput.value.trim();
  if (!utterance || !turnstileToken) return;
  send.disabled = true; commandInput.disabled = true; confirm.classList.add("hidden");
  setStatus("AI проверяет пожелание и готовит безопасную команду…");
  assistant.textContent = `Вы сказали: «${utterance}»`;
  try {
    const result = await callAi(utterance);
    totalCost += result.cost?.kzt ?? 0;
    byId("cost-metric").textContent = `${totalCost.toFixed(2)} ₸`;
    if (result.intent.type === "CLARIFY") {
      assistant.textContent = result.intent.question ?? "Нужно уточнение.";
      setStatus("AI не менял схему: требуется уточнение.");
    } else if (result.intent.command) {
      if ((result.intent.confidence ?? 0) < .9) {
        pendingCommand = result.intent.command;
        confirm.classList.remove("hidden");
        assistant.textContent = result.intent.explanation ?? "Проверьте предложенное изменение.";
        setStatus("Изменение ещё не применено — подтвердите его.");
      } else apply(result.intent.command, result.intent.explanation);
    }
    commandInput.value = "";
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Команда не обработана. Схема сохранена.", "error");
  } finally {
    commandInput.disabled = false; resetTurnstile(); commandInput.focus();
  }
});

confirm.addEventListener("click", () => { if (pendingCommand) apply(pendingCommand); pendingCommand = undefined; confirm.classList.add("hidden"); });
undo.addEventListener("click", () => { history = applyLayoutCommandToHistory(history, { commandId: crypto.randomUUID(), type: "UNDO" }); render(); setStatus("Последнее изменение отменено.", "success"); });

mic.addEventListener("click", () => {
  if (activeRecognition) {
    activeRecognition.stop();
    setStatus("Запись остановлена. Распознанный текст можно проверить.");
    return;
  }

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Recognition) {
    setStatus("В этом браузере голосовой ввод недоступен. Откройте страницу в Chrome или напишите пожелание текстом.", "error");
    return;
  }

  speechWasRecognized = false;
  speechInitialText = commandInput.value.trim();
  activeRecognition = new Recognition();
  activeRecognition.lang = "ru-RU";
  activeRecognition.interimResults = true;
  activeRecognition.continuous = true;
  activeRecognition.maxAlternatives = 1;
  mic.classList.add("listening");
  mic.setAttribute("aria-label", "Остановить голосовой ввод");
  mic.title = "Остановить запись";
  const micLabel = mic.querySelector<HTMLElement>(".mic-label");
  if (micLabel) micLabel.textContent = "Стоп";
  setStatus("Слушаю… Скажите размер стены или пожелание к кухне.");

  activeRecognition.onresult = event => {
    const parts = Array.from(event.results, result => result[0]?.transcript?.trim() ?? "").filter(Boolean);
    const transcript = parts.join(" ").trim();
    const visibleText = [speechInitialText, transcript].filter(Boolean).join(" ");
    speechWasRecognized = Boolean(transcript);
    commandInput.value = visibleText;
    commandInput.scrollTop = commandInput.scrollHeight;
    send.disabled = !turnstileToken || !visibleText;
    const hasInterimResult = Array.from(event.results).some(result => !result.isFinal);
    setStatus(hasInterimResult ? "Записываю и расшифровываю… Текст уже можно видеть в поле." : "Текст распознан. Проверьте его или продолжайте говорить.", hasInterimResult ? "normal" : "success");
  };
  activeRecognition.onerror = event => {
    const messages: Record<string, string> = {
      "not-allowed": "Разрешите доступ к микрофону для ai.salamat-mebel.kz в настройках браузера и нажмите микрофон ещё раз.",
      "service-not-allowed": "Браузер запретил сервис распознавания речи. Разрешите микрофон или используйте Chrome.",
      "audio-capture": "Микрофон не найден или занят другой программой. Проверьте микрофон и повторите.",
      network: "Сервис распознавания речи временно недоступен. Проверьте интернет или введите пожелание текстом.",
      "no-speech": "Речь не услышана. Нажмите микрофон и говорите после появления надписи «Слушаю…».",
      aborted: "Голосовой ввод остановлен.",
    };
    setStatus(messages[event.error ?? ""] ?? "Не удалось распознать голос. Попробуйте ещё раз или напишите текстом.", "error");
  };
  activeRecognition.onend = () => {
    activeRecognition = null;
    mic.classList.remove("listening");
    mic.setAttribute("aria-label", "Начать голосовой ввод");
    mic.title = "Голосовой ввод";
    const micLabel = mic.querySelector<HTMLElement>(".mic-label");
    if (micLabel) micLabel.textContent = "Говорить";
    if (!speechWasRecognized && status.textContent?.startsWith("Слушаю")) setStatus("Речь не услышана. Нажмите микрофон и попробуйте ещё раз.", "error");
    else if (speechWasRecognized) setStatus("Расшифровка готова. Проверьте текст и нажмите «Отправить».", "success");
  };

  try {
    activeRecognition.start();
  } catch {
    activeRecognition = null;
    mic.classList.remove("listening");
    setStatus("Не удалось включить микрофон. Обновите страницу и разрешите доступ к нему.", "error");
  }
});

fetch(`${API_URL}/warmup`, { mode: "cors" }).catch(() => {});
render();
