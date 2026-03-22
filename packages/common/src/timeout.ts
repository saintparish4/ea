import { ok, err } from "@ea/types";
import type { Result, TimeoutError } from "@ea/types";

// Races a promise against a deadline, If the dealine first first it returns
// a typed TimeoutError, so callers stay in Result-space without try/catch
// Non-timeout rejections are re-thrown they represent programming errors,
// not expected runtime failures
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  stage: string,
): Promise<Result<T, TimeoutError>> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new _TimeoutSignal()), ms);
  });

  try {
    const value = await Promise.race([promise, deadline]);
    clearTimeout(timer);
    return ok(value);
  } catch (cause) {
    clearTimeout(timer);

    if (cause instanceof _TimeoutSignal) {
      const elapsedMs = Date.now() - start;
      return err({
        code: "TIMEOUT_ERROR",
        message: `Stage "${stage}" exceeded ${ms} time budget`,
        stage,
        limitMs: ms,
        elapsedMs,
      } satisfies TimeoutError);
    }

    throw cause; 
  }
}

class _TimeoutSignal {} 
