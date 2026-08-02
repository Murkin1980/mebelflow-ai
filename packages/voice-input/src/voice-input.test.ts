import { describe, expect, it } from "vitest";
import { createInitialProject } from "../../project-state/src/schema.js";
import { createHistory } from "../../project-state/src/reducer.js";
import { FakeIntentProvider } from "../../intent-parser/src/index.js";
import { IntentSession } from "../../intent-parser/src/conversation.js";
import { createVoiceViewModel, FakeSttProvider, VoiceCostLedger, VoiceSession } from "./index.js";

const audio = { bytes: new Uint8Array([1, 2, 3]), mimeType: "audio/webm" };
const usage = { inputTokens: 8, outputTokens: 4 };
const history = () => createHistory(createInitialProject("voice-project", "tenant"));
const intent = (responses: ConstructorParameters<typeof FakeIntentProvider>[0]) => new IntentSession(new FakeIntentProvider(responses));
const response = { transcript: "стена три метра", confidence: .96, billedSeconds: 12 };
const command = { output: { commandId: "wall-voice", type: "SET_WALL_WIDTH", payload: { width: 3000 }, confidence: .98, explanation: "Стена 3000 мм" }, usage };

describe("VoiceSession", () => {
  it("requires explicit permission and recording actions", async () => {
    const session = new VoiceSession(new FakeSttProvider([response]), intent([command]), history());
    await session.requestPermission(async () => "granted");
    expect(session.state().status).toBe("idle");
    session.startRecording();
    expect(session.state()).toMatchObject({ status: "listening", permission: "granted" });
    expect(createVoiceViewModel(session.state()).recordingIndicatorVisible).toBe(true);
  });

  it("keeps the text alternative when permission is denied", async () => {
    const session = new VoiceSession(new FakeSttProvider([]), intent([]), history());
    await session.requestPermission(async () => "denied");
    expect(session.state()).toMatchObject({ status: "error", errorCode: "permission_denied", textAlternativeAvailable: true });
    expect(createVoiceViewModel(session.state()).secondaryAction).toBe("Ввести текст");
  });

  it("shows transcript before confirmation and applies only after confirm", async () => {
    const session = new VoiceSession(new FakeSttProvider([response]), intent([command]), history(), new VoiceCostLedger(30));
    await session.requestPermission(async () => "granted");
    session.startRecording();
    await session.stopRecording(audio);
    expect(session.state()).toMatchObject({ status: "transcript_ready", transcript: "стена три метра" });
    expect(session.history().present.room.wallWidth).toBeNull();
    const applied = await session.confirm();
    expect(applied?.status).toBe("applied");
    expect(session.history().present.room.wallWidth).toBe(3000);
    expect(session.costs.snapshot()).toEqual({ requests: 1, billedSeconds: 12, estimatedCostKzt: 6 });
  });

  it("allows transcript correction before interpretation", async () => {
    const provider = new FakeIntentProvider([command]);
    const session = new VoiceSession(new FakeSttProvider([{ ...response, transcript: "стена триста" }]), new IntentSession(provider), history());
    await session.requestPermission(async () => "granted"); session.startRecording(); await session.stopRecording(audio);
    session.editTranscript("стена три метра");
    await session.confirm();
    expect(provider.requests[0]?.utterance).toBe("стена три метра");
  });

  it("cancel never mutates project history", async () => {
    const start = history();
    const session = new VoiceSession(new FakeSttProvider([response]), intent([command]), start);
    await session.requestPermission(async () => "granted"); session.startRecording(); await session.stopRecording(audio); session.cancel();
    expect(session.history()).toBe(start);
    expect(session.state()).toMatchObject({ status: "idle", transcript: "" });
  });

  it("retains a failed recording and retries only after an explicit retry", async () => {
    const stt = new FakeSttProvider([new Error("network"), response]);
    const session = new VoiceSession(stt, intent([command]), history());
    await session.requestPermission(async () => "granted"); session.startRecording(); await session.stopRecording(audio);
    expect(session.state()).toMatchObject({ status: "error", errorCode: "stt_failed", canRetry: true });
    expect(stt.requests).toHaveLength(1);
    await session.retry();
    expect(stt.requests).toHaveLength(2);
    expect(session.state().status).toBe("transcript_ready");
  });

  it("preserves recording during poor network and offers text", async () => {
    const session = new VoiceSession(new FakeSttProvider([response]), intent([]), history());
    await session.requestPermission(async () => "granted"); session.startRecording(); session.setOnline(false); await session.stopRecording(audio);
    expect(session.state()).toMatchObject({ status: "error", errorCode: "offline", canRetry: true, textAlternativeAvailable: true });
    session.setOnline(true); await session.retry();
    expect(session.state().transcript).toBe(response.transcript);
  });

  it("rejects empty and malformed STT output without cost or state changes", async () => {
    const costs = new VoiceCostLedger(10);
    const session = new VoiceSession(new FakeSttProvider([{ transcript: "", confidence: 2, billedSeconds: -1 }]), intent([]), history(), costs);
    await session.requestPermission(async () => "granted"); session.startRecording(); await session.stopRecording(audio);
    expect(session.state().errorCode).toBe("invalid_stt_response");
    expect(costs.snapshot()).toEqual({ requests: 0, billedSeconds: 0, estimatedCostKzt: 0 });
  });

  it("keeps project unchanged when intent validation fails", async () => {
    const start = history();
    const session = new VoiceSession(new FakeSttProvider([response]), intent([{ output: { bad: true }, usage }]), start);
    await session.requestPermission(async () => "granted"); session.startRecording(); await session.stopRecording(audio);
    const result = await session.confirm();
    expect(result?.status).toBe("rejected");
    expect(session.history()).toBe(start);
    expect(session.state().errorCode).toBe("intent_failed");
  });
});

describe("Android voice view contract", () => {
  it("keeps one contextual CTA, 44px target, visible transcript and aria-live status", async () => {
    const session = new VoiceSession(new FakeSttProvider([response]), intent([command]), history());
    await session.requestPermission(async () => "granted"); session.startRecording(); await session.stopRecording(audio);
    expect(createVoiceViewModel(session.state())).toEqual({
      primaryAction: "Подтвердить",
      secondaryAction: "Ввести текст",
      transcriptVisible: true,
      statusAnnouncement: "Проверьте распознанный текст. Команда применится только после подтверждения.",
      minTouchTargetPx: 44,
      recordingIndicatorVisible: false,
    });
  });
});
