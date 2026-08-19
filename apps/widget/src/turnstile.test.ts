import { describe, expect, it, vi } from "vitest";
import { submitAfterTurnstile, TURNSTILE_ACTION, TURNSTILE_SITEKEY, turnstileMarkup } from "./turnstile.js";

describe("Turnstile AI command gate", () => {
  it("renders the managed Spin marker and public sitekey", () => {
    const html = turnstileMarkup();
    expect(html).toContain(TURNSTILE_SITEKEY);
    expect(html).toContain(`data-action="${TURNSTILE_ACTION}"`);
    expect(html).toContain("challenges.cloudflare.com/turnstile");
  });

  it("passes the unconsumed single-use token to the API submit", async () => {
    const submit = vi.fn(async () => "sent");
    await expect(submitAfterTurnstile({ token: "browser-token", idempotencyKey: "request-1", submit })).resolves.toBe(
      "sent",
    );
    expect(submit).toHaveBeenCalledWith("browser-token");
  });

  it("never submits when the browser token is missing", async () => {
    const submit = vi.fn(async () => "sent");
    await expect(submitAfterTurnstile({ token: "", idempotencyKey: "request-3", submit })).rejects.toThrow(
      "TURNSTILE_TOKEN_REQUIRED",
    );
    expect(submit).not.toHaveBeenCalled();
  });
});
