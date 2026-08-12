import { describe, expect, it, vi } from "vitest";
import { createVoiceSubmitCoordinator } from "./voice-submit.js";

describe("voice submit coordinator", () => {
  it("submits once when a fresh Turnstile token arrives", () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const coordinator = createVoiceSubmitCoordinator({ timeoutMs: 10_000, onReady, onTimeout: vi.fn() });
    expect(coordinator.arm("перемести мойку вправо")).toBe(true);
    expect(coordinator.resolve("перемести мойку вправо", "fresh-token")).toBe(true);
    expect(coordinator.resolve("перемести мойку вправо", "another-token")).toBe(false);
    expect(onReady).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("times out without submitting and exposes manual recovery", () => {
    vi.useFakeTimers();
    const onReady = vi.fn(); const onTimeout = vi.fn();
    const coordinator = createVoiceSubmitCoordinator({ timeoutMs: 10_000, onReady, onTimeout });
    coordinator.arm("мойка влево");
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(coordinator.isPending()).toBe(false);
    vi.useRealTimers();
  });

  it("cancels automatic submission when the transcript was edited", () => {
    const onReady = vi.fn();
    const coordinator = createVoiceSubmitCoordinator({ timeoutMs: 10_000, onReady, onTimeout: vi.fn() });
    coordinator.arm("мойка влево");
    expect(coordinator.resolve("мойка вправо", "fresh-token")).toBe(false);
    expect(coordinator.isPending()).toBe(false);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("cancel prevents a late Turnstile event from submitting", () => {
    const onReady = vi.fn();
    const coordinator = createVoiceSubmitCoordinator({ timeoutMs: 10_000, onReady, onTimeout: vi.fn() });
    coordinator.arm("мойка вправо"); coordinator.cancel();
    expect(coordinator.resolve("мойка вправо", "fresh-token")).toBe(false);
    expect(onReady).not.toHaveBeenCalled();
  });
});
