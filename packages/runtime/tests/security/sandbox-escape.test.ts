/**
 * Adversarial Sandbox Tests
 *
 * Verifies that the SES-backed sandbox prevents:
 *   - Access to Node.js globals (process, require, etc.)
 *   - Prototype pollution
 *   - Constructor-chain escapes
 *   - eval / Function-constructor escapes
 *   - Access to endowments not listed in the plugin manifest
 *
 * Requires `import "ses"` + `lockdown()` to be called once per worker.
 * Vitest runs each test file in its own worker thread, so lockdown here
 * is isolated and will not affect other test suites.
 */
import "ses";
import { describe, it, expect, beforeAll } from "vitest";
import { SesSandboxProvieder, buildEndowments } from "../../src/sandbox";

// SES initialisation

beforeAll(() => {
  const Id = (globalThis as Record<string, unknown>)["lockdown"] as
    | ((opts?: Record<string, unknown>) => void)
    | undefined;

  if (typeof Id === "function") {
    try {
      Id({
        consoleTaming: "unsafe", // keep console working in tests
        errorTaming: "unsafe", // keep stack traces readable
        overrideTaming: "min", // minimal override shim -- faster
        stackFiltering: "verbose",
        domainTaming: "unsafe",
      });
    } catch {
      // lockdown already called -- environment already hardened
    }
  }
});

// Helpers

/** Returns the exports object produced by `createCompartment`. */
async function loadCode(pluginId: string, code: string, endowments: Record<string, unknown> = {}) {
  const provider = new SesSandboxProvieder();
  return provider.createCompartment(pluginId, code, endowments);
}

// Process Access

describe(" escape: process access", () => {
  it("accessing process.env inside the sandbox throws ( not in endowments)", async () => {
    const code = `({ test: () => process.env.SECRET })`;
    const compartmentResult = await loadCode("test-process", code);

    // compartment creation may success (arrow fn body is not evaluated yet)
    if (!compartmentResult.ok) {
      expect(compartmentResult.error.code).toBe("SANDBOX_ERROR");
      return;
    }

    const callResult = await compartmentResult.value.call("test", []);
    expect(callResult.ok).toBe(false);
    if (!callResult.ok) {
      expect(callResult.error.code).toBe("SANDBOX_ERROR");
    }
  });

  it("accessing process.exit inside the sandbox throws", async () => {
    const code = `({ test: () => { process.exit(0); return "escaped"; } })`;
    const compartmentResult = await loadCode("test-exit", code);
    if (!compartmentResult.ok) {
      expect(compartmentResult.error.code).toBe("SANDBOX_ERROR");
      return;
    }
    const callResult = await compartmentResult.value.call("test", []);
    expect(callResult.ok).toBe(false);
  });
});

// Prototype Pollution

describe("escape: prototype pollution", () => {
  it("assigning to Object.prototype at eval-time is rejected by the hardened environment", async () => {
    // In a hardened SES environment Object.prototype is frozen —
    // any assignment throws TypeError at evaluate() time.
    const code = `Object.prototype.__injected__ = true; ({ test: () => 42 })`;
    const result = await loadCode("test-proto", code);

    if (result.ok) {
      // If compartment creation succeeded, the property must NOT have leaked out
      expect((Object.prototype as Record<string, unknown>)["__injected__"]).toBeUndefined();
    } else {
      expect(result.error.code).toBe("SANDBOX_ERROR");
    }
  });

  it("compartment cannot modify Array.prototype", async () => {
    const code = `Array.prototype.evil = () => "pwned"; ({ test: () => [].evil() })`;
    const result = await loadCode("test-array-proto", code);
    if (result.ok) {
      // If it ran, the outer Array.prototype must be clean
      expect((Array.prototype as unknown as Record<string, unknown>)["evil"]).toBeUndefined();
    } else {
      expect(result.error.code).toBe("SANDBOX_ERROR");
    }
  });
});

// Constructor Chain

describe("escape: constructor chain", () => {
  it("constructor.constructor('return this')() cannot escape to outer realm", async () => {
    const code = `({ test: () => (function(){}).constructor("return this")() })`;
    const compartmentResult = await loadCode("test-ctor", code);
    if (!compartmentResult.ok) {
      expect(compartmentResult.error.code).toBe("SANDBOX_ERROR");
      return;
    }
    const callResult = await compartmentResult.value.call<unknown>("test", []);
    // Either throws (SandboxError) or returns the compartment's restricted globalThis,
    // not the outer Node.js globalThis (which has `process`).
    if (callResult.ok) {
      const returned = callResult.value as Record<string, unknown>;
      expect(returned?.["process"]).toBeUndefined();
    } else {
      expect(callResult.error.code).toBe("SANDBOX_ERROR");
    }
  });
});

// Dynamic Import / Require

describe("escape: dynamic import and require", () => {
  it("require() is not available in the compartment", async () => {
    const code = `({ test: () => require("fs").readFileSync("/etc/passwd", "utf8") })`;
    const compartmentResult = await loadCode("test-require", code);
    if (!compartmentResult.ok) {
      expect(compartmentResult.error.code).toBe("SANDBOX_ERROR");
      return;
    }
    const callResult = await compartmentResult.value.call("test", []);
    expect(callResult.ok).toBe(false);
    if (!callResult.ok) expect(callResult.error.code).toBe("SANDBOX_ERROR");
  });

  it("dynamic import() is not available in the compartment", async () => {
    const code = `({ test: async () => { const m = await import("fs"); return m.existsSync("/"); } })`;
    const compartmentResult = await loadCode("test-dynimport", code);
    if (!compartmentResult.ok) {
      expect(compartmentResult.error.code).toBe("SANDBOX_ERROR");
      return;
    }
    const callResult = await compartmentResult.value.call("test", []);
    expect(callResult.ok).toBe(false);
    if (!callResult.ok) expect(callResult.error.code).toBe("SANDBOX_ERROR");
  });
});

// Eval / Function constructor

describe("escape: eval and Function constructor", () => {
  it("Function('return process')() cannot access the outer process object", async () => {
    const code = `({ test: () => Function("return process")() })`;
    const compartmentResult = await loadCode("test-fn-ctor", code);
    if (!compartmentResult.ok) {
      expect(compartmentResult.error.code).toBe("SANDBOX_ERROR");
      return;
    }
    const callResult = await compartmentResult.value.call<unknown>("test", []);
    if (callResult.ok) {
      // If it returns, process must be undefined in that realm
      expect(callResult.value).toBeUndefined();
    } else {
      expect(callResult.error.code).toBe("SANDBOX_ERROR");
    }
  });

  it("setTimeout with string argument is not eval (no code injection)", async () => {
    // In SES, setTimeout is not endowed unless declared. Accessing it throws.
    const code = `({ test: () => setTimeout("process.exit(1)", 0) })`;
    const compartmentResult = await loadCode("test-settimeout-str", code);
    if (!compartmentResult.ok) {
      expect(compartmentResult.error.code).toBe("SANDBOX_ERROR");
      return;
    }
    const callResult = await compartmentResult.value.call("test", []);
    // setTimeout not in endowments → ReferenceError → SandboxError
    expect(callResult.ok).toBe(false);
  });
});

// Endowment Boundary

describe("endowment boundary", () => {
  it("buildEndowments omits fetch when not declared in manifest endowments", () => {
    const endowments = buildEndowments(["console"], {
      scopedFetch: async () => new Response(),
      scopedConsole: console,
    });
    expect(endowments["fetch"]).toBeUndefined();
    expect(endowments["console"]).toBeDefined();
  });

  it("buildEndowments includes fetch only when declared", () => {
    const scopedFetch = async (_url: string) => new Response();
    const endowments = buildEndowments(["fetch", "crypto"], {
      scopedFetch,
    });
    expect(endowments["fetch"]).toBe(scopedFetch);
    expect(endowments["crypto"]).toBeDefined();
    expect((endowments["crypto"] as Record<string, unknown>)["getRandomValues"]).toBeTypeOf(
      "function",
    );
  });

  it("buildEndowments includes requestSigning only when declared and provided", () => {
    const rs = async (_p: unknown) => ({ chain: "btc", data: new Uint8Array(64) });
    const withRs = buildEndowments(["requestSigning"], { requestSigning: rs });
    const withoutRs = buildEndowments(["crypto"], { requestSigning: rs });

    expect(withRs["requestSigning"]).toBe(rs);
    expect(withoutRs["requestSigning"]).toBeUndefined();
  });

  it("plugin code cannot access undeclared endowment (rpcProvider not in endowments)", async () => {
    const code = `({ test: () => rpcProvider.call({}, "getBalance", []) })`;
    // rpcProvider NOT in declared list and not passed → undefined in compartment
    const compartmentResult = await loadCode("test-endow", code, {});
    if (!compartmentResult.ok) {
      expect(compartmentResult.error.code).toBe("SANDBOX_ERROR");
      return;
    }
    const callResult = await compartmentResult.value.call("test", []);
    expect(callResult.ok).toBe(false);
  });
});
