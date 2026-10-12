import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorldAudioSettings } from "../components/game/WorldAudioSettings";
const store = vi.hoisted(() => ({
  state: { soundEnabled: true, track: { title: "Hidden song" }, status: "Playing" },
  off: vi.fn(),
  on: vi.fn(),
}));
vi.mock("@/lib/game-audio", () => ({
  getMusicState: () => store.state,
  getServerMusicState: () => store.state,
  subscribeMusic: () => () => {},
  disableGameAudio: store.off,
  enableGameAudio: store.on,
}));
beforeEach(() => {
  vi.clearAllMocks();
  store.state = { soundEnabled: true, track: { title: "Hidden song" }, status: "Playing" };
  store.off.mockResolvedValue(undefined);
  store.on.mockResolvedValue(true);
});
it("shows only the sound choice, with no song names, preview, sliders or credits", () => {
  render(<WorldAudioSettings enabled onEnabledChange={() => {}} />);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Turn sound off" })).toBeInTheDocument();
  expect(screen.queryByText("Hidden song")).not.toBeInTheDocument();
  expect(screen.queryByText("Playing")).not.toBeInTheDocument();
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("turns sound off and saves the choice", async () => {
  const changed = vi.fn();
  render(<WorldAudioSettings enabled onEnabledChange={changed} />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(changed).toHaveBeenCalledWith(false));
  expect(store.off).toHaveBeenCalledOnce();
});
it("enables sound and handles browsers where audio is unavailable", async () => {
  store.state = { ...store.state, soundEnabled: false };
  store.on.mockResolvedValue(false);
  const changed = vi.fn();
  render(<WorldAudioSettings enabled={false} onEnabledChange={changed} />);
  fireEvent.click(screen.getByRole("button", { name: "Enable sound" }));
  expect(await screen.findByRole("status")).toHaveTextContent("unavailable");
  expect(changed).not.toHaveBeenCalled();
});
