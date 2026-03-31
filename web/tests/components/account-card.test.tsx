import { render, screen } from "@testing-library/react";
import { AccountCard } from "@/app/components/accountCard";
import type { Account, Balance } from "@ea/types";
import { describe, it, expect } from "vitest";

const account: Account = {
  address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  chain: "bitcoin",
  accountIndex: 0,
  label: "Main",
};

const balance: Balance = {
  amount: 100_000n,
  decimals: 8,
  symbol: "BTC",
};

describe("AccountCard", () => {
  it("renders chain and address", () => {
    render(<AccountCard account={account} balance={null} />);
    expect(screen.getByText("bitcoin")).toBeInTheDocument();
    expect(screen.getByText(account.address)).toBeInTheDocument();
  });

  it("renders formatted balance when provided", () => {
    render(<AccountCard account={account} balance={balance} />);
    expect(screen.getByText("0.001")).toBeInTheDocument();
    expect(screen.getByText("BTC")).toBeInTheDocument();
  });

  it("shows loading state when balance is null", () => {
    render(<AccountCard account={account} balance={null} />);
    expect(screen.getByText("Balance loading…")).toBeInTheDocument();
  });

  it("renders optional label", () => {
    render(<AccountCard account={account} balance={null} />);
    expect(screen.getByText("Main")).toBeInTheDocument();
  });
});
