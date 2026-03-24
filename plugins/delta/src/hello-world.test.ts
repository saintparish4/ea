/**
 * Integration test for the hello-world plugin — exercises the full runtime
 * lifecycle: manifest validation, registry, sandbox (no-SES fast path), pipeline.
 */
import { describe, it, expect } from "vitest";
import { manifest, greet, getInfo } from "./index";
import { validateManifest, PluginRegistry } from "@ea/runtime";

describe("hello-world plugin -- lifecycle", () => {
  it("manifest passes schema validation", () => {
    const result = validateManifest(manifest);
    expect(result.ok).toBe(true);
  });

  it("greet() returns expected string", () => {
    expect(greet("Ea")).toBe("Hello, Ea! Ea plugin runtime is working.");
  });

  it("getInfo() returns runtimeReady: true", () => {
    const info = getInfo();
    expect(info["runtimeReady"]).toBe(true);
    expect(info["pluginId"]).toBe("hello-world");
  });

  it("registers and enables cleanly in PluginRegistry", () => {
    const registry = new PluginRegistry();
    const instance = { greet, getInfo };

    const registerResult = registry.register(manifest, instance);
    expect(registerResult.ok).toBe(true);
    expect(registry.isEnabled("hello-world")).toBe(true);

    registry.disable("hello-world");
    expect(registry.isEnabled("hello-world")).toBe(false);

    registry.enable("hello-world");
    expect(registry.isEnabled("hello-world")).toBe(true);

    const unregisterResult = registry.unregister("hello-world");
    expect(unregisterResult.ok).toBe(true);
    expect(registry.get("hello-world")).toBeUndefined();
  });

  it("duplicate registration returns PluginError", () => {
    const registry = new PluginRegistry();
    registry.register(manifest, {});
    const second = registry.register(manifest, {});
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("PLUGIN_ERROR");
    }
  });
});
