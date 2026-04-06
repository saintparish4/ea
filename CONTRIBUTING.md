# Contributing to Ea

## Prerequisites

- Node.js >= 20 LTS
- pnpm >= 9 (`npm install -g pnpm`)

## Getting started

```bash
git clone https://github.com/saintparish4/ea.git
cd ea
pnpm install
pnpm build
pnpm test
```

## Repository layout

```
packages/
  types/    @ea/types    — shared types, interfaces, Zod schemas
  runtime/  @ea/runtime  — sandbox, loader, pipeline, RPC provider, KeyProvider
  common/   @ea/common   — validation helpers, timeout wrapper, logger
plugins/
  bitcoin/  @ea/plugin-bitcoin  — chain plugin
  solana/   @ea/plugin-solana   — chain plugin
  phishing/ @ea/plugin-phishing — security plugin
  delta/    @ea/plugin-delta    — hello-world utility plugin (lifecycle validation)
web/        Next.js reference wallet
```

## Available commands

```bash
pnpm build       # compile all packages (Turborepo, respects dependency order)
pnpm typecheck   # tsc --noEmit across all packages
pnpm lint        # ESLint across all packages
pnpm format      # Prettier write
pnpm format:check
pnpm test        # Vitest unit + integration tests
pnpm clean       # remove all dist/ and node_modules/
```

Run a single package in watch mode:

```bash
cd packages/runtime
pnpm dev
```

## Test pyramid

Each chain plugin has three test layers:

| Layer | Location | How it works |
|-------|----------|--------------|
| 1 — Unit | `plugins/{name}/src/*.test.ts` | RPC/Connection stubbed with `vi.fn()` |
| 2 — Integration | `plugins/{name}/tests/integration/` | MSW intercepts real HTTP at the network layer |
| 3 — E2E (optional) | guarded by env var | live testnet (Bitcoin Signet / Solana Devnet) |

When writing a new chain plugin, add tests at all three layers.

## Adding a new chain plugin

### 1. Scaffold the package

```bash
mkdir -p plugins/mychainname/src
cd plugins/mychainname
```

Create `package.json`:

```json
{
  "name": "@ea/plugin-mychainname",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "dev": "tsc --watch --project tsconfig.json",
    "test": "vitest run --config ../../vitest.config.ts",
    "typecheck": "tsc --noEmit --project tsconfig.json",
    "lint": "eslint src/",
    "clean": "rimraf dist"
  }
}
```

### 2. Implement the capability interfaces

Chain plugins must implement at minimum `AccountProvider` and `TransactionBuilder` from `@ea/types`. `TransactionSimulator` is strongly recommended.

```typescript
import type {
  AccountProvider,
  TransactionBuilder,
  TransactionSimulator,
} from "@ea/types";

export class MychainAccountProvider implements AccountProvider { ... }
export class MychainTxBuilder implements TransactionBuilder { ... }
export class MychainSimulator implements TransactionSimulator { ... }
```

### 3. Write the manifest

```typescript
import type { PluginManifest } from "@ea/types";

export const manifest: PluginManifest = {
  id: "mychainname",
  version: "0.1.0",
  name: "My Chain",
  description: "...",
  type: "chain",
  permissions: ["network:rpc"],
  endowments: ["fetch"],
  capabilities: ["AccountProvider", "TransactionBuilder", "TransactionSimulator"],
  supportedChains: ["mychainname"],
  entryPoint: "index.js",
};
```

### 4. Export from `src/index.ts`

```typescript
export { manifest } from "./manifest.js";
export { MychainAccountProvider } from "./accounts.js";
export { MychainTxBuilder } from "./builder.js";
export { MychainSimulator } from "./simulator.js";
```

### 5. Register with the reference wallet

Add your plugin to `web/app/lib/runtime.ts` following the pattern used by the Bitcoin and Solana plugins.

## Pull request guidelines

- One logical change per PR.
- All checks must pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- New capabilities require tests at Layers 1 and 2.
- Security-relevant changes (sandbox endowments, KeyProvider, pipeline stages) require a note in the PR description explaining the threat model impact.
