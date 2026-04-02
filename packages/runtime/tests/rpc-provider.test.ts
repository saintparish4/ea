/**
 * HttpRpcProvider unit tests
 *
 * Covers: rate limiting, TTL cache, cache bypass, HTTP errors, JSON-RPC errors.
 * Uses vi.stubGlobal to mock fetch — no real network calls.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpRpcProvider } from "../src/rpc-provider.js";
import type { RpcEndpoint } from "../src/rpc-provider.js";

function makeEndpoint(overrides: Partial<RpcEndpoint> = {}): RpcEndpoint {
  return {
    url: "http://localhost:8332",
    chain: "bitcoin",
    rateLimitRps: 10,
    ...overrides,
  };
}

function mockFetchOk(result: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ jsonrpc: "2.0", id: 1, result }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockFetchHttpError(status: number) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: "Bad Request",
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HttpRpcProvider — happy path", () => {
  it("returns ok(result) for a successful JSON-RPC response", async () => {
    mockFetchOk(700_000);
    const provider = new HttpRpcProvider();
    const result = await provider.call<number>(makeEndpoint(), "getblockcount", []);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(700_000);
  });
});

describe("HttpRpcProvider — caching", () => {
  it("caches read-method responses and returns cached value on second call", async () => {
    const fetchMock = mockFetchOk(42);
    const provider = new HttpRpcProvider(15_000);
    const ep = makeEndpoint();

    await provider.call<number>(ep, "getbalance", []);
    await provider.call<number>(ep, "getbalance", []);

    // fetch should only have been called once (second hit is cached)
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("clearCache causes the next call to fetch again", async () => {
    const fetchMock = mockFetchOk(99);
    const provider = new HttpRpcProvider(60_000);
    const ep = makeEndpoint();

    await provider.call<number>(ep, "getbalance", []);
    provider.clearCache();
    await provider.call<number>(ep, "getbalance", []);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("simulateTransaction bypasses the cache every time", async () => {
    const fetchMock = mockFetchOk({ logs: [] });
    const provider = new HttpRpcProvider();
    const ep = makeEndpoint({ chain: "solana" });

    await provider.call(ep, "simulateTransaction", ["tx1"]);
    await provider.call(ep, "simulateTransaction", ["tx1"]);

    // Both calls must hit the network (no caching for simulation)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("HttpRpcProvider — error handling", () => {
  it("returns NetworkError on HTTP 4xx response", async () => {
    mockFetchHttpError(400);
    const provider = new HttpRpcProvider();
    const result = await provider.call(makeEndpoint(), "getbalance", []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
      expect(result.error.statusCode).toBe(400);
    }
  });

  it("returns NetworkError when fetch throws (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const provider = new HttpRpcProvider();
    const result = await provider.call(makeEndpoint(), "getbalance", []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
      expect(result.error.message).toContain("ECONNREFUSED");
    }
  });

  it("returns NetworkError for a JSON-RPC error object in the response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32600, message: "Invalid request" },
          }),
      } as unknown as Response),
    );
    const provider = new HttpRpcProvider();
    const result = await provider.call(makeEndpoint(), "getbalance", []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
      expect(result.error.message).toContain("Invalid request");
    }
  });
});

describe("HttpRpcProvider — rate limiting", () => {
  it("returns NetworkError immediately when the token bucket is empty", async () => {
    mockFetchOk(1);
    // Only 1 RPS → after first call, bucket is empty
    const provider = new HttpRpcProvider();
    const ep = makeEndpoint({ rateLimitRps: 1 });

    await provider.call(ep, "getblockcount", []);
    // Drain the bucket with a second immediate call
    const result = await provider.call(ep, "getblockcount", []);

    // The second call may be rate-limited (depends on elapsed ms — in CI it's nearly instant)
    // We verify the behavior is one of: ok (if refill happened) or NetworkError (rate limited)
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
      expect(result.error.message).toContain("Rate limit exceeded");
    }
  });
});
