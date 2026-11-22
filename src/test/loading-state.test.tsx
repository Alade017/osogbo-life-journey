import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingState } from "@/components/game/ui";
import { SLOW_LOAD_AFTER_MS } from "@/lib/request-timeout";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("LoadingState", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the page it is opening", () => {
    renderWithClient(<LoadingState title="Opening the market" detail="Loading your stall…" />);
    expect(screen.getByRole("status", { name: "Opening the market" })).toBeTruthy();
    expect(screen.getByText("Loading your stall…")).toBeTruthy();
  });

  it("offers a retry only after the wait is slow", () => {
    vi.useFakeTimers();
    renderWithClient(<LoadingState title="Opening the market" />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(SLOW_LOAD_AFTER_MS);
    });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
