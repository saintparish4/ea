import { z } from "zod";

export const PermissionSchema = z.enum([
  "network:fetch",
  "crypto:randomValues",
  "console:log",
  "accounts:read",
  "transactions:sign",
  "transactions:build",
  "transactions:simulate",
]);

export type Permission = z.infer<typeof PermissionSchema>;

export const EndowmentSchema = z.enum([
  "fetch",
  "console",
  "crypto",
  "requestSigning",
  "rpcProvider",
]);

export type Endowment = z.infer<typeof EndowmentSchema>;

export const PluginTypeSchema = z.enum(["chain", "security", "utility"]);

export type PluginType = z.infer<typeof PluginTypeSchema>;

export const CapabilitySchema = z.enum([
  "AccountProvider",
  "TransactionBuilder",
  "TransactionSimulator",
  "TransactionSigner",
  "SecurityPlugin",
]);

export type Capability = z.infer<typeof CapabilitySchema>;

export const PluginManifestSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, "id must be lowercase kebab-case"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be in semver format"),
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  type: PluginTypeSchema,
  permissions: z.array(PermissionSchema),
  endowments: z.array(EndowmentSchema),
  supportedChains: z.array(z.string()).optional(),
  capabilities: z.array(CapabilitySchema),
  entryPoint: z.string().min(1),
  author: z.string().optional(),
  homepage: z.string().url().optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
