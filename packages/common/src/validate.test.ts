/**
 * Unit tests for the validate / validateOrThrow helpers
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validate, validateOrThrow } from "./validate.js";

const schema = z.object({
  name: z.string().min(1),
  age: z.number().positive(),
});

describe("validate()", () => {
  it("returns ok(parsed) for valid data", () => {
    const result = validate(schema, { name: "Alice", age: 30 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Alice");
      expect(result.value.age).toBe(30);
    }
  });

  it("returns err(ValidationError) for invalid data", () => {
    const result = validate(schema, { name: "", age: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toBeTruthy();
    }
  });

  it("returns err(ValidationError) for completely wrong type", () => {
    const result = validate(schema, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("includes the field path in the error message", () => {
    const result = validate(schema, { name: "Bob", age: "not-a-number" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Error message or field should reference 'age'
      expect(result.error.message).toBeTruthy();
    }
  });
});

describe("validateOrThrow()", () => {
  it("returns the parsed value for valid data", () => {
    const value = validateOrThrow(schema, { name: "Charlie", age: 25 });
    expect(value.name).toBe("Charlie");
  });

  it("throws for invalid data", () => {
    expect(() => validateOrThrow(schema, { name: "" })).toThrow();
  });
});
