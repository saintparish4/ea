import { render, screen, fireEvent } from "@testing-library/react";
import { PluginCard } from "@/app/components/pluginCard";
import type { PluginManifest } from "@ea/types";
import { describe, it, expect } from "vitest";
import { vi } from "vitest";

const manifest: PluginManifest = {
  id: "ea.plugin.bitcoin",
  version: "0.1.0",
  name: "Bitcoin",
  type: "chain",
  permissions: ["network:esplora"],
  endowments: ["fetch"],
  supportedChains: ["bitcoin"],
  capabilities: ["AccountProvider", "TransactionBuilder"],
  entryPoint: "./src/index",
};

describe("PluginCard", () => {
  it("renders plugin name and id", () => {
    render(<PluginCard manifest={manifest} enabled={true} onToggle={() => undefined} />);
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText(/ea\.plugin\.bitcoin/)).toBeInTheDocument();
  });

  it("toggle switch has correct aria-checked when enabled", () => {
    render(<PluginCard manifest={manifest} enabled={true} onToggle={() => undefined} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("toggle switch has correct aria-checked when disabled", () => {
    render(<PluginCard manifest={manifest} enabled={false} onToggle={() => undefined} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("calls onToggle when switch is clicked", () => {
    const onToggle = vi.fn();
    render(<PluginCard manifest={manifest} enabled={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders capabilities as badges", () => {
    render(<PluginCard manifest={manifest} enabled={true} onToggle={() => undefined} />);
    expect(screen.getByText("AccountProvider")).toBeInTheDocument();
    expect(screen.getByText("TransactionBuilder")).toBeInTheDocument();
  });
});
