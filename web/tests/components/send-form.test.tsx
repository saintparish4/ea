/**
 * SendForm component tests (React Testing Library)
 *
 * Runtime is mocked via web/tests/setup.ts (vi.mock('@/app/lib/runtime')).
 * Store state is reset between tests via Zustand's internal state reset.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SendForm } from "@/app/components/sendForm";
import { useSendStore } from "@/app/lib/store/send-store";
import { ok } from "@ea/types";

// Reset the send store to its initial state before each test
beforeEach(() => {
  useSendStore.setState({
    chain: "bitcoin",
    from: "",
    to: "",
    amount: "",
    stage: "form",
    simulation: null,
    securityWarnings: [],
    blockReason: null,
    signature: null,
    error: null,
  });
  vi.clearAllMocks();
});

describe("SendForm", () => {
  it("renders chain selector, from, to, and amount fields", () => {
    render(<SendForm />);
    expect(screen.getByLabelText(/chain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/from address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it("submit button shows 'Preview transaction' in idle state", () => {
    render(<SendForm />);
    expect(screen.getByRole("button", { name: /preview transaction/i })).toBeEnabled();
  });

  it("submit button is disabled and shows 'Simulating…' when stage is simulating", () => {
    useSendStore.setState({ stage: "simulating" });
    render(<SendForm />);
    const btn = screen.getByRole("button", { name: /simulating/i });
    expect(btn).toBeDisabled();
  });

  it("filling all fields and submitting calls runSimulationAndCheck", async () => {
    const { getRuntime } = await import("@/app/lib/runtime");
    const runtime = getRuntime();
    (runtime.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok({
        tx: { chain: "bitcoin", raw: new Uint8Array([1]), metadata: {} },
        simulation: {
          fee: 350n,
          feeSymbol: "BTC",
          inputs: [],
          outputs: [],
          sideEffects: [],
          warnings: [],
        },
        signature: { chain: "bitcoin", data: new Uint8Array(64) },
        warnings: [],
        auditEntries: [],
      }),
    );

    render(<SendForm />);

    fireEvent.change(screen.getByLabelText(/from address/i), { target: { value: "bc1q-from" } });
    fireEvent.change(screen.getByLabelText(/to address/i), { target: { value: "bc1q-to" } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "100000" } });
    fireEvent.submit(screen.getByRole("button", { name: /preview transaction/i }).closest("form")!);

    await waitFor(() => {
      expect(runtime.pipeline.execute).toHaveBeenCalled();
    });
  });

  it("chain selector changes update the store's chain field", () => {
    render(<SendForm />);
    const chainSelect = screen.getByLabelText(/chain/i) as HTMLSelectElement;
    fireEvent.change(chainSelect, { target: { value: "solana" } });
    expect(useSendStore.getState().chain).toBe("solana");
  });
});
