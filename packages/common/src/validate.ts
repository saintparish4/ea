import type { ZodSchema } from "zod";
import { ok, err } from "@ea/types";
import type { Result, ValidationError } from "@ea/types";

export function validate<T>(schema: ZodSchema<T>, data: unknown): Result<T, ValidationError> {
  const parsed = schema.safeParse(data);

  if (parsed.success) {
    return ok(parsed.data);
  }

  const firstIssue = parsed.error.issues[0];
  const field =
    firstIssue !== undefined && firstIssue.path.length > 0
      ? firstIssue.path.join(".")
      : undefined;

  const error: ValidationError =
    field !== undefined
      ? {
          code: "VALIDATION_ERROR",
          message: parsed.error.message,
          field,
        }
      : {
          code: "VALIDATION_ERROR",
          message: parsed.error.message,
        };

  return err(error);
}

// Throws on invalid input -- use only at startup
// config-load boundaries, never inside the plugin execution path
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}


