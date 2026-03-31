"use client";

import { useSendStore } from "@/app/lib/store/send-store";
import { SendForm } from "@/app/components/sendForm";
import { SimulationConfirmation } from "@/app/components/simulation-confirmation";
import { ErrorBanner } from "@/app/components/errorBanner";

export function SendView() {
  const { stage, error } = useSendStore();

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">Send</h1>

      {error !== null && <ErrorBanner error={error} className="mb-4" />}

      {(stage === "form" || stage === "simulating") && <SendForm />}

      {(stage === "confirmation" ||
        stage === "signing" ||
        stage === "done" ||
        stage === "blocked") && <SimulationConfirmation />}
    </section>
  );
}
