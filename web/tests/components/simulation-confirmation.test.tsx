/**
 * SimulationConfirmation component tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SimulationConfirmation } from "@/app/components/simulation-confirmation";
import { useSendStore } from "@/app/lib/store/send-store";

beforeEach(() => {
  useSendStore.setState({
    chain: "bitcoin",
    from: "bc1q-from",
    to: "bc1q-to",
    amount: "50000",
    stage: "confirmation",
    simulation: {
      fee: 350n,
      feeSymbol: "BTC",
      inputs: [{ address: "bc1q-from", amount: 50350n, symbol: "BTC" }],
      outputs: [{ address: "bc1q-to", amount: 50000n, symbol: "BTC" }],
      sideEffects: ["Send 0.0005 BTC to bc1q-to"],
      warnings: [],
    },
    securityWarnings: [],
    blockReason: null,
    signature: { chain: "bitcoin", data: new Uint8Array(64) },
    error: null,
  });
  vi.clearAllMocks();
});

describe("SimulationConfirmation — confirmation stage", () => {
  it("shows the network fee", () => {
    render(<SimulationConfirmation />);
    expect(screen.getByText(/network fee/i)).toBeInTheDocument();
  });

  it("lists outputs with recipient address", () => {
    render(<SimulationConfirmation />);
    const outputsBlock = screen.getByText("Outputs").closest("div");
    expect(outputsBlock).not.toBeNull();
    expect(within(outputsBlock!).getByText("bc1q-to")).toBeInTheDocument();
  });

  it("Confirm & sign button is enabled when not blocked", () => {
    render(<SimulationConfirmation />);
    expect(screen.getByRole("button", { name: /confirm & sign/i })).toBeEnabled();
  });

  it("Cancel button resets the form", () => {
    const reset = vi.fn();
    useSendStore.setState({ reset } as never);
    render(<SimulationConfirmation />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(reset).toHaveBeenCalled();
  });
});

describe("SimulationConfirmation — blocked stage", () => {
  beforeEach(() => {
    useSendStore.setState({ stage: "blocked", blockReason: "Address on threat list" });
  });

  it("shows blocked banner with the block reason", () => {
    render(<SimulationConfirmation />);
    expect(screen.getByText(/transaction blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/address on threat list/i)).toBeInTheDocument();
  });

  it("Confirm & sign button is hidden when blocked", () => {
    render(<SimulationConfirmation />);
    expect(screen.queryByRole("button", { name: /confirm & sign/i })).not.toBeInTheDocument();
  });

  it("shows a Dismiss button when blocked", () => {
    render(<SimulationConfirmation />);
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });
});

describe("SimulationConfirmation — security warnings", () => {
  beforeEach(() => {
    useSendStore.setState({
      stage: "confirmation",
      securityWarnings: ["Suspicious address pattern detected", "Self-send detected"],
    });
  });

  it("renders each security warning as a list item", () => {
    render(<SimulationConfirmation />);
    expect(screen.getByText(/suspicious address pattern detected/i)).toBeInTheDocument();
    expect(screen.getByText(/self-send detected/i)).toBeInTheDocument();
  });

  it("Confirm & sign button is still enabled with warnings (not blocked)", () => {
    render(<SimulationConfirmation />);
    expect(screen.getByRole("button", { name: /confirm & sign/i })).toBeEnabled();
  });
});

describe("SimulationConfirmation — done stage", () => {
  beforeEach(() => {
    useSendStore.setState({
      stage: "done",
      signature: { chain: "bitcoin", data: new Uint8Array(64).fill(0xab) },
    });
  });

  it("shows 'Transaction sent' success message", () => {
    render(<SimulationConfirmation />);
    expect(screen.getByText(/transaction sent/i)).toBeInTheDocument();
  });

  it("shows the signature hex", () => {
    render(<SimulationConfirmation />);
    // 64 bytes filled with 0xab → "ab".repeat(64)
    expect(screen.getByText(/abab/i)).toBeInTheDocument();
  });

  it("New transaction button triggers reset", () => {
    const reset = vi.fn();
    useSendStore.setState({ reset } as never);
    render(<SimulationConfirmation />);
    fireEvent.click(screen.getByRole("button", { name: /new transaction/i }));
    expect(reset).toHaveBeenCalled();
  });
});
