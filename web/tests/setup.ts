import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Stub the runtime singleton for all component tests.
// Individual tests can override vi.mock('@/lib/runtime') to return
// a custom registry / pipeline instance.
vi.mock("@/lib/runtime", () => ({
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
