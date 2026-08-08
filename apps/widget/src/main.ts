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
const voiceTranscript = byId<HTMLElement>("voice-transcript");
const voiceStateLabel = byId<HTMLElement>("voice-state-label");
const transcriptPreview = byId<HTMLParagraphElement>("transcript-preview");
const conversationLog = byId<HTMLElement>("conversation-log");
let history: ProjectHistory = createHistory(createInitialProject(crypto.randomUUID(), TENANT_ID));
let sessionId = `session_${crypto.randomUUID().replaceAll("-", "")}`;
let turnstileToken = "";
let pendingCommand: unknown;
let totalCost = 0;
let activeRecognition: SpeechRecognitionLike | null = null;
let speechWasRecognized = false;
let speechInitialText = "";
let currentView: "front" | "top" | "perspective" | "3d" = "front";
let viewer3d: import("./kitchen-3d-viewer.js").Kitchen3DViewer | undefined;
let viewer3dLoading = false;
let selectedModuleId: string | undefined;
let autoSubmitAfterTranscription = false;

function addChatMessage(role: "ai" | "user", text: string, thinking = false) {
  const message = document.createElement("article");
  message.className = `chat-message ${role}${thinking ? " thinking" : ""}`;
  const avatar = document.createElement("span");
  avatar.textContent = role === "ai" ? "AI" : "Вы";
  const body = document.createElement("p");
  body.textContent = text;
  message.append(avatar, body);
  conversationLog.append(message);
  conversationLog.scrollTop = conversationLog.scrollHeight;
  return message;
}

const moduleLabel = (type: string) => type === "sink_cabinet" ? "Мойка" : type.startsWith("dishwasher") ? "ПММ" : "Модуль";

function renderTopView(state: ProjectHistory["present"]) {
  const wall = state.room.wallWidth ?? 3000;
  const modules = state.lowerRow.modules.map(module => `<g><rect x="${module.position}" y="110" width="${module.width}" height="560" rx="8" fill="#f6e9fe" stroke="#5b347f" stroke-width="8"/><text x="${module.position + module.width / 2}" y="410" text-anchor="middle" font-family="Manrope" font-size="54" fill="#1f1927">${moduleLabel(module.type)}</text><text x="${module.position + module.width / 2}" y="720" text-anchor="middle" font-family="Manrope" font-size="42" fill="#4b444f">${module.width}</text></g>`).join("");
  return `<svg viewBox="-100 0 ${wall + 200} 850" role="img" aria-label="План кухни сверху"><path d="M0 70H${wall}" stroke="#431b67" stroke-width="18"/>${modules}<text x="${wall / 2}" y="820" text-anchor="middle" font-family="Manrope" font-size="48" fill="#431b67">Стена ${wall} мм</text></svg>`;
}

function perspectiveFeature(type: string, x: number, width: number, depth: number) {
  const center = x + width / 2;
  if (type === "sink_cabinet") return `<g aria-label="Чаша мойки и смеситель"><ellipse cx="${center + depth / 2}" cy="${120 - depth / 2}" rx="${Math.min(width * .26, 150)}" ry="${Math.max(depth * .2, 24)}" fill="#fff7ff" stroke="#431b67" stroke-width="8"/><path d="M${center} ${105 - depth / 2}v-${Math.max(depth * .38, 54)}q0-42 48-42h38" fill="none" stroke="#431b67" stroke-width="12" stroke-linecap="round"/></g>`;
  if (type.startsWith("dishwasher")) return `<g aria-label="Фасад посудомоечной машины"><rect x="${x + width * .12}" y="190" width="${width * .76}" height="390" rx="18" fill="#fff7ff" stroke="#431b67" stroke-width="8"/><path d="M${x + width * .2} 250h${width * .6}" stroke="#c79a3b" stroke-width="12"/><circle cx="${center}" cy="430" r="${Math.min(width * .16, 80)}" fill="none" stroke="#5b347f" stroke-width="8"/></g>`;
  if (type === "oven_base") return `<g aria-label="Духовой шкаф"><rect x="${x + width * .12}" y="205" width="${width * .76}" height="350" rx="16" fill="#1f1927" stroke="#431b67" stroke-width="8"/><rect x="${x + width * .22}" y="315" width="${width * .56}" height="170" rx="8" fill="#f6e9fe"/><circle cx="${x + width * .3}" cy="260" r="18" fill="#c79a3b"/><circle cx="${x + width * .7}" cy="260" r="18" fill="#c79a3b"/></g>`;
  if (type === "cooktop_base") return `<g aria-label="Варочная панель"><ellipse cx="${center - width * .18 + depth / 2}" cy="${120 - depth / 2}" rx="44" ry="18" fill="none" stroke="#431b67" stroke-width="8"/><ellipse cx="${center + width * .18 + depth / 2}" cy="${120 - depth / 2}" rx="44" ry="18" fill="none" stroke="#431b67" stroke-width="8"/></g>`;
  return "";
}

function renderPerspective(state: ProjectHistory["present"]) {
  const wall = state.room.wallWidth ?? 3000;
  const depth = Math.max(90, wall * .055);
  const occupied = state.lowerRow.modules.reduce((sum, module) => sum + module.width, 0);
  const previewModules: Array<{ position: number; width: number; type: string; preview?: boolean }> = [...state.lowerRow.modules];
  let previewPosition = occupied;
  while (wall - previewPosition >= 300) {
    const width = wall - previewPosition >= 600 ? 600 : wall - previewPosition;
    previewModules.push({ position: previewPosition, width, type: "preview", preview: true });
    previewPosition += width;
  }
  const modules = previewModules.map(module => { const x = module.position; const w = module.width; const preview = module.preview; return `<g opacity="${preview ? ".58" : "1"}"><rect x="${x}" y="120" width="${w}" height="530" fill="${preview ? "#fff7ff" : "#f6e9fe"}" stroke="#5b347f" stroke-width="7" ${preview ? 'stroke-dasharray="22 14"' : ""}/><polygon points="${x},120 ${x + depth},${120 - depth} ${x + w + depth},${120 - depth} ${x + w},120" fill="#fff1c9" stroke="#5b347f" stroke-width="7"/><polygon points="${x + w},120 ${x + w + depth},${120 - depth} ${x + w + depth},${650 - depth} ${x + w},650" fill="#e5d1ef" stroke="#5b347f" stroke-width="7"/>${preview ? "" : perspectiveFeature(module.type, x, w, depth)}<text x="${x + w / 2}" y="${preview ? 390 : 610}" text-anchor="middle" font-family="Manrope" font-size="${preview ? 48 : 34}" fill="#1f1927">${preview ? "Секция" : moduleLabel(module.type)}</text><text x="${x + w / 2}" y="${preview ? 465 : 690}" text-anchor="middle" font-family="Manrope" font-size="34" fill="#4b444f">${w} мм</text></g>`; }).join("");
  return `<svg viewBox="-180 -120 ${wall + depth + 360} 980" role="img" aria-label="Автоматический предварительный контур кухни в перспективе"><defs><linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff7ff"/><stop offset="1" stop-color="#f3e7d1"/></linearGradient></defs><rect x="-${depth}" y="-${depth}" width="${wall + depth * 2}" height="${780 + depth}" fill="#fff7ff" stroke="#cdc3d1" stroke-width="6"/><polygon points="-${depth},650 ${wall + depth},650 ${wall + depth * 2},850 -${depth * 2},850" fill="url(#floor)" stroke="#c79a3b" stroke-width="6"/><path d="M0 90H${wall}" stroke="#c79a3b" stroke-width="12"/>${modules}<path d="M0 650H${wall}" stroke="#431b67" stroke-width="12"/><text x="${wall / 2}" y="790" text-anchor="middle" font-family="Manrope" font-size="46" fill="#431b67">Предварительный контур · ${wall} мм</text></svg>`;
}

async function render3D(state: ProjectHistory["present"]) {
  if (viewer3d) { viewer3d.update(state); viewer3d.setSelectedModule(selectedModuleId); return; }
  if (viewer3dLoading) return;
  viewer3dLoading = true;
  const scheme = byId("scheme");
  scheme.innerHTML = '<div class="viewer-loading" role="status">Готовлю объёмный вид…</div>';
  try {
    const { createKitchen3DViewer } = await import("./kitchen-3d-viewer.js");
    if (currentView !== "3d") return;
    viewer3d = await createKitchen3DViewer({
      container: scheme, state, selectedModuleId,
      onModuleSelect(id) { selectedModuleId = id; viewer3d?.setSelectedModule(id); setStatus(`Выбран модуль ${moduleLabel(history.present.lowerRow.modules.find(module => module.id === id)?.type ?? "")}.`, "success"); },
      onError(error) { console.warn("MebelFlow 3D asset fallback", error); },
    });
    viewer3d.update(history.present);
  } catch (error) {
    console.warn("MebelFlow 3D unavailable", error);
    scheme.innerHTML = '<div class="viewer-error" role="status"><strong>3D-вид недоступен</strong><span>Схема и все команды продолжают работать.</span></div>';
    setStatus("Не удалось включить 3D-вид. Используйте фасад, вид сверху или перспективу.", "error");
  } finally { viewer3dLoading = false; }
}

function render() {
  const state = history.present;
  const scheme = byId("scheme");
  scheme.classList.toggle("is-3d", currentView === "3d");
  if (currentView === "3d" && state.room.wallWidth) void render3D(state);
  else {
    viewer3d?.dispose(); viewer3d = undefined;
    scheme.innerHTML = state.room.wallWidth
      ? currentView === "front" ? renderKitchenSvg(state, { title: "Предварительная схема кухни", description: "Схема обновляется после подтверждённых команд.", selectedId: selectedModuleId }) : currentView === "top" ? renderTopView(state) : renderPerspective(state)
      : '<div class="scheme-empty"><strong>Укажите длину кухни</strong><span>Например: «кухня 3 метра»</span></div>';
  }
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
  if (autoSubmitAfterTranscription && commandInput.value.trim()) {
    autoSubmitAfterTranscription = false;
    form.requestSubmit();
  }
});
window.addEventListener("turnstile-expired", () => { resetTurnstile(); setStatus("Проверка истекла — пройдите её ещё раз.", "error"); });
commandInput.addEventListener("input", () => { send.disabled = !turnstileToken || !commandInput.value.trim(); });
document.querySelectorAll<HTMLButtonElement>("[data-example]").forEach(button => button.addEventListener("click", () => { commandInput.value = button.dataset.example ?? ""; commandInput.focus(); send.disabled = !turnstileToken || !commandInput.value.trim(); }));

async function callAi(utterance: string) {
  const idempotencyKey = `request_${crypto.randomUUID().replaceAll("-", "")}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1/intent`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantId: TENANT_ID, sessionId, idempotencyKey, turnstileToken, locale: "ru-KZ", utterance, projectSummary: compactProjectState(history.present) }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("AI-сервис не ответил за 20 секунд. Попробуйте ещё раз.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
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
  if (!utterance) return;
  if (!turnstileToken) {
    setStatus("Для сложного AI-запроса дождитесь проверки безопасности и нажмите «Отправить» ещё раз.", "error");
    return;
  }
  addChatMessage("user", utterance);
  const thinkingMessage = addChatMessage("ai", "Обрабатываю запрос…", true);
  send.disabled = true; commandInput.disabled = true; confirm.classList.add("hidden");
  setStatus("AI проверяет пожелание и готовит безопасную команду…");
  assistant.textContent = `Вы сказали: «${utterance}»`;
  try {
    const result = await callAi(utterance);
    totalCost += result.cost?.kzt ?? 0;
    byId("cost-metric").textContent = `${totalCost.toFixed(2)} ₸`;
    if (result.intent.type === "CLARIFY") {
      assistant.textContent = result.intent.question ?? "Нужно уточнение.";
      thinkingMessage.querySelector("p")!.textContent = assistant.textContent;
      thinkingMessage.classList.remove("thinking");
      setStatus("AI не менял схему: требуется уточнение.");
    } else if (result.intent.command) {
      apply(result.intent.command, result.intent.explanation);
      thinkingMessage.querySelector("p")!.textContent = result.intent.explanation ?? "Изменение применено. Что добавим дальше?";
      thinkingMessage.classList.remove("thinking");
    }
    commandInput.value = "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Команда не обработана. Схема сохранена.";
    thinkingMessage.querySelector("p")!.textContent = message;
    thinkingMessage.classList.remove("thinking");
    setStatus(message, "error");
  } finally {
    commandInput.disabled = false; resetTurnstile(); commandInput.focus();
  }
});

confirm.addEventListener("click", () => { if (pendingCommand) apply(pendingCommand); pendingCommand = undefined; confirm.classList.add("hidden"); });
undo.addEventListener("click", () => { history = applyLayoutCommandToHistory(history, { commandId: crypto.randomUUID(), type: "UNDO" }); render(); setStatus("Последнее изменение отменено.", "success"); });
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => button.addEventListener("click", () => {
  currentView = button.dataset.view as typeof currentView;
  document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item === button));
  render();
}));

let mediaRecorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let audioChunks: Blob[] = [];

async function transcribeAudio(audio: Blob) {
  const bytes = new Uint8Array(await audio.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  const idempotencyKey = `transcribe_${crypto.randomUUID().replaceAll("-", "")}`;
  const response = await fetch(`${API_URL}/v1/transcribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantId: TENANT_ID, sessionId, audioBase64: btoa(binary), mimeType: audio.type || "audio/webm", turnstileToken, idempotencyKey }),
  });
  const result = await response.json() as { text?: string; error?: { message?: string } };
  if (!response.ok || !result.text) throw new Error(result.error?.message ?? "AI не смог расшифровать запись.");
  return result.text;
}

mic.addEventListener("click", async () => {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  if (!turnstileToken) {
    setStatus("Дождитесь проверки безопасности и нажмите микрофон ещё раз.", "error");
    return;
  }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(recordingStream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
    mediaRecorder.ondataavailable = event => { if (event.data.size) audioChunks.push(event.data); };
    mediaRecorder.onstop = async () => {
      mic.classList.remove("listening");
      voiceTranscript.classList.remove("is-listening");
      recordingStream?.getTracks().forEach(track => track.stop());
      voiceStateLabel.textContent = "AI расшифровывает запись";
      transcriptPreview.textContent = "Обрабатываю голос…";
      setStatus("AI расшифровывает голосовую команду…");
      try {
        const text = await transcribeAudio(new Blob(audioChunks, { type: mediaRecorder?.mimeType || "audio/webm" }));
        commandInput.value = text;
        transcriptPreview.textContent = text;
        voiceStateLabel.textContent = "Расшифровка готова";
        autoSubmitAfterTranscription = true;
        setStatus("Расшифровка готова. Передаю команду AI…", "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI не смог расшифровать запись.";
        transcriptPreview.textContent = message;
        setStatus(message, "error");
      } finally {
        resetTurnstile();
      }
    };
    mediaRecorder.start();
    mic.classList.add("listening");
    voiceTranscript.classList.remove("hidden");
    voiceTranscript.classList.add("is-listening");
    voiceStateLabel.textContent = "Идёт запись";
    transcriptPreview.textContent = "Говорите. Нажмите «Стоп», когда закончите.";
    setStatus("Записываю голос для AI-расшифровки…");
  } catch {
    setStatus("Не удалось включить микрофон. Разрешите доступ в настройках браузера.", "error");
  }
});

mic.addEventListener("legacy-speech-disabled", () => {
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
  voiceTranscript.classList.remove("hidden");
  voiceTranscript.classList.add("is-listening");
  voiceStateLabel.textContent = "Идёт запись";
  transcriptPreview.textContent = speechInitialText || "Говорите — распознанный текст появится здесь.";
  setStatus("Слушаю… Скажите размер стены или пожелание к кухне.");

  activeRecognition.onresult = event => {
    const parts = Array.from(event.results, result => result[0]?.transcript?.trim() ?? "").filter(Boolean);
    const transcript = parts.join(" ").trim();
    const visibleText = [speechInitialText, transcript].filter(Boolean).join(" ");
    speechWasRecognized = Boolean(transcript);
    commandInput.value = visibleText;
    commandInput.scrollTop = commandInput.scrollHeight;
    transcriptPreview.textContent = visibleText || "Слушаю…";
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
    voiceTranscript.classList.remove("is-listening");
    voiceStateLabel.textContent = "Запись не завершена";
    transcriptPreview.textContent = messages[event.error ?? ""] ?? "Не удалось распознать голос.";
    setStatus(messages[event.error ?? ""] ?? "Не удалось распознать голос. Попробуйте ещё раз или напишите текстом.", "error");
  };
  activeRecognition.onend = () => {
    activeRecognition = null;
    mic.classList.remove("listening");
    voiceTranscript.classList.remove("is-listening");
    mic.setAttribute("aria-label", "Начать голосовой ввод");
    mic.title = "Голосовой ввод";
    const micLabel = mic.querySelector<HTMLElement>(".mic-label");
    if (micLabel) micLabel.textContent = "Говорить";
    if (!speechWasRecognized && status.textContent?.startsWith("Слушаю")) {
      voiceStateLabel.textContent = "Речь не распознана";
      transcriptPreview.textContent = "Нажмите микрофон и попробуйте ещё раз.";
      setStatus("Речь не услышана. Нажмите микрофон и попробуйте ещё раз.", "error");
    } else if (speechWasRecognized) {
      voiceStateLabel.textContent = "Расшифровка готова";
      transcriptPreview.textContent = commandInput.value;
      setStatus("Расшифровка готова. Проверьте текст и нажмите «Отправить».", "success");
    }
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
