import { render, screen } from "@testing-library/react";
import { ErrorBanner } from "@/app/components/errorBanner";
import type { EaError } from "@ea/types";
import { describe, it, expect } from "vitest";

const error: EaError = {
  code: "NETWORK_ERROR",
  message: "Connection refused",
};

describe("ErrorBanner", () => {
  it("renders error code and message", () => {
    render(<ErrorBanner error={error} />);
    expect(screen.getByText("NETWORK_ERROR")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("has role=alert for screen readers", () => {
    render(<ErrorBanner error={error} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
