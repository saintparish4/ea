import { ok, err } from "@ea/types";
import type { Result, NetworkError } from "@ea/types";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface RpcEndpoint {
  url: string;
  chain: string;
  /** Requests per second allowed to this endpoint. */
  rateLimitRps: number;
}

export interface RpcProvider {
  call<T>(
    endpoint: RpcEndpoint,
    method: string,
    params: unknown[],
  ): Promise<Result<T, NetworkError>>;
  clearCache(): void;
}

// ---------------------------------------------------------------------------
// Token-bucket rate limiter (per endpoint URL)
// ---------------------------------------------------------------------------

interface BucketState {
  tokens: number;
  lastRefill: number;
}

function consumeToken(buckets: Map<string, BucketState>, endpoint: RpcEndpoint): boolean {
  const now = Date.now();
  let state = buckets.get(endpoint.url);

  if (state === undefined) {
    state = { tokens: endpoint.rateLimitRps, lastRefill: now };
    buckets.set(endpoint.url, state);
  }

  const elapsedSeconds = (now - state.lastRefill) / 1_000;
  state.tokens = Math.min(
    endpoint.rateLimitRps,
    state.tokens + elapsedSeconds * endpoint.rateLimitRps,
  );
  state.lastRefill = now;

  if (state.tokens >= 1) {
    state.tokens -= 1;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// HTTP JSON-RPC implementation
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * HttpRpcProvider sends JSON-RPC 2.0 requests over HTTP/HTTPS.
 *
 * Features:
 *   - One logical "connection" per unique endpoint URL (fetch pool is managed
 *     by the runtime — no explicit pooling needed in pure fetch).
 *   - TTL cache for balance/state reads (default 15 s).  Simulation calls and
 *     any method in BYPASS_CACHE_METHODS skip the cache.
 *   - Per-endpoint token-bucket rate limiter.
 */
export class HttpRpcProvider implements RpcProvider {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly buckets = new Map<string, BucketState>();
  private readonly cacheTtlMs: number;

  /**
   * Methods that must always hit the network (no caching).
   * Add chain-specific simulation methods here as plugins are added.
   */
  private static readonly BYPASS_CACHE = new Set([
    "simulateTransaction",
    "eth_call",
    "eth_estimateGas",
  ]);

  constructor(cacheTtlMs = 15_000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async call<T>(
    endpoint: RpcEndpoint,
    method: string,
    params: unknown[],
  ): Promise<Result<T, NetworkError>> {
    if (!consumeToken(this.buckets, endpoint)) {
      return err({
        code: "NETWORK_ERROR",
        message: `Rate limit exceeded for ${endpoint.url} (${endpoint.rateLimitRps} rps)`,
        endpoint: endpoint.url,
      });
    }

    const shouldCache = !HttpRpcProvider.BYPASS_CACHE.has(method);
    const cacheKey = `${endpoint.url}|${method}|${JSON.stringify(params)}`;

    if (shouldCache) {
      const entry = this.cache.get(cacheKey);
      if (entry !== undefined && Date.now() < entry.expiresAt) {
        return ok(entry.value as T);
      }
    }

    let response: Response;
    try {
      response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
    } catch (cause) {
      return err({
        code: "NETWORK_ERROR",
        message: cause instanceof Error ? cause.message : "Network request failed",
        endpoint: endpoint.url,
        ...(cause instanceof Error ? { cause } : {}),
      });
    }

    if (!response.ok) {
      return err({
        code: "NETWORK_ERROR",
        message: `HTTP ${response.status} ${response.statusText} from ${endpoint.url}`,
        endpoint: endpoint.url,
        statusCode: response.status,
      });
    }

    let json: unknown;
    // TODO(observability): use `catch (cause)` and set `NetworkError.cause` when `cause instanceof Error`
    // (same pattern as the fetch `catch` above) so JSON parse failures retain the underlying error.
    try {
      json = await response.json();
    } catch {
      return err({
        code: "NETWORK_ERROR",
        message: "Failed to parse JSON-RPC response",
        endpoint: endpoint.url,
      });
    }

    const rpc = json as { result?: T; error?: { message: string; code: number } };

    if (rpc.error) {
      return err({
        code: "NETWORK_ERROR",
        message: rpc.error.message,
        endpoint: endpoint.url,
        statusCode: rpc.error.code,
      });
    }

    const value = rpc.result as T;

    if (shouldCache) {
      this.cache.set(cacheKey, { value, expiresAt: Date.now() + this.cacheTtlMs });
    }

    return ok(value);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
