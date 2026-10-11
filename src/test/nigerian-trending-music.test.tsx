import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NigerianTrendingMusic } from "@/components/game/NigerianTrendingMusic";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NigerianTrendingMusic", () => {
  it("shows a useful empty state for an unavailable chart and lets the player retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    render(<NigerianTrendingMusic />);

    expect(await screen.findByText(/Could not reach the Nigeria music chart/i)).toBeInTheDocument();
    expect(screen.getByText(/The rest of Settings is still available/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("shows Apple Music links without implying the list streams in-game", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          feed: {
            results: [
              {
                id: "song-1",
                name: "Market Day",
                artistName: "Osun Artist",
                url: "https://music.apple.com/ng/album/market-day/123",
              },
            ],
          },
        }),
      }),
    );
    render(<NigerianTrendingMusic />);
    const link = await screen.findByRole("link", { name: /Market Day by Osun Artist/i });
    expect(link).toHaveAttribute("href", "https://music.apple.com/ng/album/market-day/123");
    expect(
      screen.getByText(/does not stream copyrighted tracks inside the game/i),
    ).toBeInTheDocument();
  });
});
