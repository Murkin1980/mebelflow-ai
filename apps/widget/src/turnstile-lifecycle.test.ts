import { describe, expect, it, vi } from "vitest";
import { consumeTurnstile, requestFreshTurnstile } from "./turnstile-lifecycle.js";

describe("Turnstile lifecycle", () => {
  it("consumes a used token without resetting the widget", () => {
    const clear = vi.fn(); const reset = vi.fn();
    consumeTurnstile(clear);
    expect(clear).toHaveBeenCalledOnce(); expect(reset).not.toHaveBeenCalled();
  });

  it("requests a fresh challenge only on the next explicit action", () => {
    const reset = vi.fn();
    expect(requestFreshTurnstile(reset)).toBe(true);
    expect(reset).toHaveBeenCalledOnce();
  });

  it("fails safely when the Turnstile API is not ready", () => {
    expect(requestFreshTurnstile(undefined)).toBe(false);
  });
});
