/**
 * PluginCard component tests
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { PluginCard } from "@/app/components/pluginCard";
import type { PluginManifest } from "@ea/types";
import { describe, it, expect } from "vitest";
import { vi } from "vitest";

const BITCOIN_MANIFEST: PluginManifest = {
  id: "ea-plugin-bitcoin",
  version: "0.1.0",
  name: "Bitcoin",
  type: "chain",
  permissions: ["network:fetch"],
  endowments: ["fetch", "crypto"],
  supportedChains: ["bitcoin", "bitcoin-testnet"],
  capabilities: ["AccountProvider", "TransactionBuilder", "TransactionSimulator"],
  entryPoint: "index.js",
};

const PHISHING_MANIFEST: PluginManifest = {
  id: "ea-plugin-phishing",
  version: "0.1.0",
  name: "Phishing Detection",
  type: "security",
  permissions: [],
  endowments: [],
  capabilities: ["SecurityPlugin"],
  entryPoint: "index.js",
};

describe("PluginCard", () => {
  it("renders the plugin name and id@version", () => {
    render(<PluginCard manifest={BITCOIN_MANIFEST} enabled={true} onToggle={vi.fn()} />);
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText(/ea-plugin-bitcoin@0\.1\.0/i)).toBeInTheDocument();
  });

  it("shows the plugin type badge", () => {
    render(<PluginCard manifest={BITCOIN_MANIFEST} enabled={true} onToggle={vi.fn()} />);
    expect(screen.getByText("chain")).toBeInTheDocument();
  });

  it("lists capability badges", () => {
    render(<PluginCard manifest={BITCOIN_MANIFEST} enabled={true} onToggle={vi.fn()} />);
    expect(screen.getByText("AccountProvider")).toBeInTheDocument();
    expect(screen.getByText("TransactionBuilder")).toBeInTheDocument();
  });

  it("shows permissions text when plugin has permissions", () => {
    render(<PluginCard manifest={BITCOIN_MANIFEST} enabled={true} onToggle={vi.fn()} />);
    expect(screen.getByText(/permissions:/i)).toBeInTheDocument();
    expect(screen.getByText(/network:fetch/i)).toBeInTheDocument();
  });

  it("does not show permissions text when plugin has no permissions", () => {
    render(<PluginCard manifest={PHISHING_MANIFEST} enabled={true} onToggle={vi.fn()} />);
    expect(screen.queryByText(/permissions:/i)).not.toBeInTheDocument();
  });

  it("toggle switch is aria-checked=true when enabled", () => {
    render(<PluginCard manifest={BITCOIN_MANIFEST} enabled={true} onToggle={vi.fn()} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("toggle switch is aria-checked=false when disabled", () => {
    render(<PluginCard manifest={BITCOIN_MANIFEST} enabled={false} onToggle={vi.fn()} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("clicking the toggle calls onToggle", () => {
    const onToggle = vi.fn();
    render(<PluginCard manifest={BITCOIN_MANIFEST} enabled={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("toggle accessible label changes based on enabled state", () => {
    const { rerender } = render(
      <PluginCard manifest={BITCOIN_MANIFEST} enabled={true} onToggle={vi.fn()} />,
    );
    expect(screen.getByText(/disable plugin/i)).toBeInTheDocument();

    rerender(<PluginCard manifest={BITCOIN_MANIFEST} enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/enable plugin/i)).toBeInTheDocument();
  });
});
