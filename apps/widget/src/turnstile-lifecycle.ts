export function consumeTurnstile(onConsumed: () => void) {
  onConsumed();
}

export function requestFreshTurnstile(reset: (() => void) | undefined) {
  reset?.();
  return Boolean(reset);
}
