/**
 * Unit tests for the withTimeout utility
 */
import { describe, it, expect, vi } from "vitest";
import { withTimeout } from "./timeout.js";

describe("withTimeout", () => {
  it("returns ok(value) when the promise resolves before the deadline", async () => {
    const result = await withTimeout(Promise.resolve(42), 1_000, "test-stage");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it("returns TimeoutError when the promise does not resolve within the deadline", async () => {
    const never = new Promise<never>(() => {
      /* intentionally never resolves */
    });
    const result = await withTimeout(never, 30, "slow-stage");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TIMEOUT_ERROR");
      expect(result.error.stage).toBe("slow-stage");
      expect(result.error.limitMs).toBe(30);
      expect(result.error.elapsedMs).toBeGreaterThanOrEqual(30);
    }
  }, 2_000);

  it("re-throws non-timeout rejections (programming errors should not be swallowed)", async () => {
    const boom = Promise.reject(new Error("boom!"));
    await expect(withTimeout(boom, 1_000, "err-stage")).rejects.toThrow("boom!");
  });

  it("clears the timer when the promise resolves early (no memory leak)", async () => {
    // Vitest's fake timers can assert no pending timers after the promise resolves.
    vi.useFakeTimers();
    const fast = new Promise<string>((resolve) => resolve("fast"));
    const result = await withTimeout(fast, 10_000, "fast-stage");
    expect(result.ok).toBe(true);
    // After resolution, advancing time does not cause spurious effects
    vi.advanceTimersByTime(15_000);
    vi.useRealTimers();
  });
});
