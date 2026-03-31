import { describe, it, expect } from "vitest";
import { formatBalance } from "@/app/lib/format";

describe("formatBalance", () => {
  it("formats satoshis to BTC (8 decimals)", () => {
    expect(formatBalance(100_000_000n, 8)).toBe("1");
    expect(formatBalance(100_000n, 8)).toBe("0.001");
    expect(formatBalance(1n, 8)).toBe("0.00000001");
  });

  it("formats lamports to SOL (9 decimals)", () => {
    expect(formatBalance(1_000_000_000n, 9)).toBe("1");
    expect(formatBalance(500_000_000n, 9)).toBe("0.5");
  });

  it("formats whole amounts without trailing zeros", () => {
    expect(formatBalance(2_000_000_000n, 9)).toBe("2");
  });

  it("handles 0 decimals", () => {
    expect(formatBalance(42n, 0)).toBe("42");
  });
});
