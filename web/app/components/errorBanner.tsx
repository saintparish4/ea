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
        "relative box-border flex h-full w-full flex-col justify-center overflow-hidden rounded-[var(--radius-card)] border border-danger-500/25 bg-danger-50/80 p-5",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-danger-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-danger-500/10 blur-2xl" />

      <div className="relative z-10 flex w-full items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-danger-500/20 bg-white text-danger-500 shadow-sm shadow-danger-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex flex-1 flex-col pt-0.5">
          <h3 className="text-sm font-semibold tracking-tight text-danger-500">
            {error.code}
          </h3>
          <p className="mt-1 pr-4 text-sm leading-snug text-danger-500/90">
            {error.message}
          </p>
        </div>
      </div>
    </div>
  );
}
