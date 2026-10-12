import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MusicNowPlayingToast } from "../components/game/MusicNowPlayingToast";
import { WorldAudioSettings } from "../components/game/WorldAudioSettings";
import { pauseGameMusic, resumeGameMusic, nextGameMusic } from "../lib/game-audio";
const store = vi.hoisted(() => ({
  state: {
    track: { title: "A local track", artist: "A local artist" } as {
      title: string;
      artist: string;
    } | null,
    playing: true,
    soundEnabled: true,
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
  pauseGameMusic: vi.fn(),
  resumeGameMusic: vi.fn(),
  nextGameMusic: vi.fn(),
  readGameAudioLevels: () => ({ master: 0.5, music: 0.5, effects: 0.5 }),
  isGameAudioActive: () => true,
  disableGameAudio: vi.fn(),
  enableGameAudio: vi.fn(),
  playGameSound: vi.fn(),
  setGameAudioLevels: vi.fn(),
}));
beforeEach(() => {
  vi.useFakeTimers();
  store.state = {
    track: { title: "A local track", artist: "A local artist" },
    playing: true,
    soundEnabled: true,
    playbackId: 1,
  };
});
afterEach(() => vi.useRealTimers());
it("shows the title and artist for exactly ten seconds", () => {
  render(<MusicNowPlayingToast />);
  expect(screen.getByText("A local track")).toBeInTheDocument();
  expect(screen.getByText("A local artist")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(9999));
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("shows a fresh notification for replay and resets its timeout", () => {
  render(<MusicNowPlayingToast />);
  act(() => vi.advanceTimersByTime(9000));
  act(() => {
    store.state = { ...store.state, playbackId: 2 };
    store.listeners.forEach((listener) => listener());
  });
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(9000));
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
    store.state = { ...store.state, playing: false, soundEnabled: false };
    store.listeners.forEach((listener) => listener());
  });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("renders nothing for an empty library", () => {
  store.state = { ...store.state, track: null, playing: false };
  render(<MusicNowPlayingToast />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("keeps controls available while paused and can reopen after hiding", () => {
  render(<MusicNowPlayingToast />);
  fireEvent.click(screen.getByRole("button", { name: "Pause music" }));
  expect(pauseGameMusic).toHaveBeenCalled();
  act(() => {
    store.state = { ...store.state, playing: false };
    store.listeners.forEach((listener) => listener());
  });
  fireEvent.click(screen.getByRole("button", { name: "Resume music" }));
  expect(resumeGameMusic).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Next track" }));
  expect(nextGameMusic).toHaveBeenCalledWith(true);
  act(() => vi.advanceTimersByTime(10000));
  fireEvent.click(screen.getByRole("button", { name: "Open music player" }));
  expect(screen.getByText("A local track")).toBeInTheDocument();
});
it("does not show names, credits or playback controls in Settings", () => {
  render(<WorldAudioSettings enabled onEnabledChange={() => {}} />);
  expect(screen.queryByText("A local track")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Pause|Resume|Next/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /credits/i })).not.toBeInTheDocument();
  expect(screen.getByLabelText("master volume")).toBeInTheDocument();
});
