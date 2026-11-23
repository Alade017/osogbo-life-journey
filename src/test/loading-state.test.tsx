import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingState } from "@/components/game/ui";
import { retryLoadingQueries } from "@/lib/query-retry";
import { SLOW_LOAD_AFTER_MS } from "@/lib/request-timeout";

vi.mock("@/lib/query-retry", () => ({ retryLoadingQueries: vi.fn().mockResolvedValue(undefined) }));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("LoadingState", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("names the page it is opening", () => {
    renderWithClient(<LoadingState title="Opening the market" detail="Loading your stall…" />);
    expect(screen.getByRole("status", { name: "Opening the market" })).toBeTruthy();
    expect(screen.getByText("Loading your stall…")).toBeTruthy();
  });

  it("offers a retry only after the wait is slow", () => {
    vi.useFakeTimers();
    renderWithClient(<LoadingState title="Opening the market" queryKeys={[["shopItems"]]} />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(SLOW_LOAD_AFTER_MS);
    });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("passes only the loading page's keys and disables retry while restarting", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    vi.mocked(retryLoadingQueries).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderWithClient(<LoadingState queryKeys={[["friendHouseVisit", "friend-1"]]} />);
    act(() => {
      vi.advanceTimersByTime(SLOW_LOAD_AFTER_MS);
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retryLoadingQueries).toHaveBeenCalledWith(expect.any(QueryClient), [
      ["friendHouseVisit", "friend-1"],
    ]);
    expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("does not offer an unscoped retry when the caller has supplied no keys", () => {
    vi.useFakeTimers();
    renderWithClient(<LoadingState />);
    act(() => {
      vi.advanceTimersByTime(SLOW_LOAD_AFTER_MS);
    });
    expect(screen.queryByRole("button")).toBeNull();
  });
});
