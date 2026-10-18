import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorldAudioSettings } from "../components/game/WorldAudioSettings";

const audio = vi.hoisted(() => ({
  enable: vi.fn(),
  save: vi.fn(),
  disable: vi.fn(),
  play: vi.fn(),
}));
vi.mock("@/lib/game-audio", () => ({
  readGameAudioLevels: () => ({ master: 0.55, music: 0.2, effects: 0.45 }),
  setGameAudioLevels: audio.save,
  enableGameAudio: audio.enable,
  playGameSound: audio.play,
  disableGameAudio: audio.disable,
}));
beforeEach(() => {
  vi.clearAllMocks();
  audio.enable.mockResolvedValue(true);
  audio.disable.mockResolvedValue(undefined);
});
it("shows independent music and sound effects switches", () => {
  render(<WorldAudioSettings enabled onEnabledChange={() => {}} />);
  expect(screen.getByRole("switch", { name: "Music" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Sound effects" })).toBeChecked();
});
it("turns music off while keeping effects on", async () => {
  const changed = vi.fn();
  render(<WorldAudioSettings enabled onEnabledChange={changed} />);
  fireEvent.click(screen.getByRole("switch", { name: "Music" }));
  await waitFor(() =>
    expect(audio.save).toHaveBeenCalledWith({ master: 0.55, music: 0, effects: 0.45 }),
  );
  expect(screen.getByRole("switch", { name: "Sound effects" })).toBeChecked();
  expect(changed).toHaveBeenCalledWith(true);
});
it("previews effects only when that channel is turned on", async () => {
  render(<WorldAudioSettings enabled={false} onEnabledChange={() => {}} />);
  fireEvent.click(screen.getByRole("switch", { name: "Sound effects" }));
  await waitFor(() => expect(audio.play).toHaveBeenCalledWith("ui"));
});
it("reports unavailable audio without claiming the preference saved", async () => {
  audio.enable.mockResolvedValue(false);
  const changed = vi.fn();
  render(<WorldAudioSettings enabled={false} onEnabledChange={changed} />);
  fireEvent.click(screen.getByRole("switch", { name: "Sound effects" }));
  expect(await screen.findByRole("status")).toHaveTextContent("unavailable");
  expect(changed).not.toHaveBeenCalled();
});

it("turns both channels off without resuming audio", async () => {
  const changed = vi.fn();
  render(<WorldAudioSettings enabled onEnabledChange={changed} />);
  fireEvent.click(screen.getByRole("switch", { name: "Music" }));
  await waitFor(() => expect(screen.getByRole("switch", { name: "Music" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("switch", { name: "Sound effects" }));
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith(false));
  expect(audio.enable).not.toHaveBeenCalled();
  expect(audio.disable).toHaveBeenCalled();
  expect(screen.getByRole("switch", { name: "Music" })).not.toBeChecked();
  expect(screen.getByRole("switch", { name: "Sound effects" })).not.toBeChecked();
});
