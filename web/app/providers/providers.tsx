"use client";

import { useEffect, useState } from "react";
import { initRuntime } from "../lib/runtime";

export function Providers({ children }: { readonly children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    initRuntime()
      .then(() => setReady(true))
      .catch((err: unknown) => {
        console.error("[Ea] Runtime init failed", err);
        setInitError(err instanceof Error ? err : new Error(String(err)));
      });
  }, []);

  if (initError !== null) {
    return (
      <div role="alert" className="p-4 text-red-600">
        Wallet runtime failed to start: {initError.message}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Starting wallet…
      </div>
    );
  }

  return <>{children}</>;
}
