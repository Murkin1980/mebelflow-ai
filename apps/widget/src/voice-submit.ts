export type VoiceSubmitScheduler = Pick<typeof globalThis, "setTimeout" | "clearTimeout">;

export function createVoiceSubmitCoordinator(input: {
  timeoutMs: number;
  scheduler?: VoiceSubmitScheduler;
  onReady: () => void;
  onTimeout: () => void;
}) {
  const scheduler = input.scheduler ?? globalThis;
  let pendingText = "";
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    if (timeout !== undefined) scheduler.clearTimeout(timeout);
    timeout = undefined;
    pendingText = "";
  };

  return {
    arm(text: string) {
      clear();
      pendingText = text.trim();
      if (!pendingText) return false;
      timeout = scheduler.setTimeout(() => {
        clear();
        input.onTimeout();
      }, input.timeoutMs);
      return true;
    },
    resolve(currentText: string, token: string) {
      if (!pendingText || !token.trim()) return false;
      if (currentText.trim() !== pendingText) { clear(); return false; }
      clear();
      input.onReady();
      return true;
    },
    cancel: clear,
    isPending: () => Boolean(pendingText),
  };
}
