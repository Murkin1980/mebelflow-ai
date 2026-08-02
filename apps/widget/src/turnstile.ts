export const TURNSTILE_SITEKEY = "0x4AAAAAAEEX-k_-HA_wm4nv";
export const TURNSTILE_ACTION = "turnstile-spin-v1";

export function turnstileMarkup() {
  return `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><div class="cf-turnstile" data-sitekey="${TURNSTILE_SITEKEY}" data-action="${TURNSTILE_ACTION}"></div>`;
}

/** Pass the single-use token to the API; only the server verifies and consumes it. */
export async function submitAfterTurnstile<T>(input: {
  token: string;
  idempotencyKey: string;
  submit: (turnstileToken: string) => Promise<T>;
}) {
  const token = input.token.trim();
  if (!token) throw new Error("TURNSTILE_TOKEN_REQUIRED");
  return input.submit(token);
}
