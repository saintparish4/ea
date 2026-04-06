import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/** Minimal `PluginRecord`-shaped stub so `send-store` can resolve a chain plugin. */
const mockChainPluginRecord = {
  manifest: {
    id: "bitcoin-test",
    version: "0.1.0",
    name: "Bitcoin",
    type: "chain" as const,
    permissions: [] as const,
    endowments: [] as const,
    supportedChains: ["bitcoin", "solana"],
    capabilities: [] as const,
    entryPoint: "index",
  },
  instance: {},
  enabled: true,
  loadedAt: Date.now(),
};

// Stub the runtime singleton for all component tests (must match `@/app/lib/runtime`,
// the same module `send-store` resolves via `../runtime`).
// Individual tests can override vi.mock('@/app/lib/runtime') for custom mocks.
vi.mock("@/app/lib/runtime", () => ({
  initRuntime: vi.fn().mockResolvedValue(undefined),
  getRuntime: vi.fn().mockReturnValue({
    registry: {
      getAll: vi.fn().mockReturnValue([]),
      getChainPlugins: vi.fn().mockReturnValue([]),
      getSecurityPlugins: vi.fn().mockReturnValue([]),
      getChainPlugin: vi.fn().mockReturnValue(undefined),
      get: vi.fn().mockReturnValue(undefined),
      enable: vi.fn(),
      disable: vi.fn(),
      listEnabledByType: vi.fn((type: string) => {
        if (type === "chain") return [mockChainPluginRecord];
        if (type === "security") return [];
        return [];
      }),
    },
    pipeline: {
      execute: vi.fn(),
    },
    keyProvider: {
      sign: vi.fn(),
      getPublicKey: vi.fn(),
      deriveAccount: vi.fn(),
    },
  }),
}));
