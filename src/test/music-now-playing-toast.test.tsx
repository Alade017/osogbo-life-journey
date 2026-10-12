import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MusicNowPlayingToast } from "../components/game/MusicNowPlayingToast";
const store = vi.hoisted(() => ({
  state: {
    track: { title: "A local track", artist: "A local artist" } as {
      title: string;
      artist: string;
    } | null,
    playing: true,
    playbackId: 1,
  },
  listeners: new Set<() => void>(),
}));
vi.mock("@/lib/game-audio", () => ({
  getMusicState: () => store.state,
  getServerMusicState: () => store.state,
  subscribeMusic: (listener: () => void) => {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },
}));
beforeEach(() => {
  vi.useFakeTimers();
  store.state = {
    track: { title: "A local track", artist: "A local artist" },
    playing: true,
    playbackId: 1,
  };
});
afterEach(() => vi.useRealTimers());
it("shows the title and artist for exactly five seconds", () => {
  render(<MusicNowPlayingToast />);
  expect(screen.getByText("A local track")).toBeInTheDocument();
  expect(screen.getByText("A local artist")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(4999));
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("shows a fresh notification for replay and resets its timeout", () => {
  render(<MusicNowPlayingToast />);
  act(() => vi.advanceTimersByTime(4000));
  act(() => {
    store.state = { ...store.state, playbackId: 2 };
    store.listeners.forEach((listener) => listener());
  });
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("dismisses without changing audio and hides when playback stops", () => {
  render(<MusicNowPlayingToast />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss music notification" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(store.state.playing).toBe(true);
  act(() => {
    store.state = { ...store.state, playbackId: 2 };
    store.listeners.forEach((listener) => listener());
  });
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => {
    store.state = { ...store.state, playing: false };
    store.listeners.forEach((listener) => listener());
  });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("renders nothing for an empty library", () => {
  store.state = { ...store.state, track: null, playing: false };
  render(<MusicNowPlayingToast />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
