"use client";

import type { EaError } from "@ea/types";

interface Props {
  error: EaError;
  className?: string;
}

export function ErrorBanner({ error, className = "" }: Props) {
  return (
    <div
      role="alert"
      className={[
        "rounded-[var(--radius-card)] border border-danger-500 bg-danger-50 p-4",
        className,
      ].join(" ")}
    >
      <p className="font-semibold text-danger-500">{error.code}</p>
      <p className="mt-1 text-sm text-danger-500">{error.message}</p>
    </div>
  );
}
