import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VoiceNotePlayer } from "@/components/game/VoiceNotes";
const signedUrl = vi.hoisted(() => vi.fn());
vi.mock("@/lib/voice-notes", () => ({ getVoiceNoteUrl: signedUrl }));
beforeEach(() => {
  signedUrl.mockResolvedValue("https://example.test/voice.webm");
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it("loads a signed audio URL only on play, exposes duration, seeking and speed", async () => {
  const { container, unmount } = render(<VoiceNotePlayer messageId="m" durationMs={65000} />);
  expect(signedUrl).not.toHaveBeenCalled();
  expect(screen.getByText("1:05")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Play voice note" }));
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
  const audio = container.querySelector("audio")!;
  Object.defineProperty(audio, "readyState", { value: 1 });
  fireEvent.loadedMetadata(audio);
  fireEvent.play(audio);
  expect(screen.getByRole("button", { name: "Pause voice note" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider", { name: "Voice note position" }), {
    target: { value: "32" },
  });
  expect(audio.currentTime).toBe(32);
  fireEvent.click(screen.getByRole("button", { name: "Playback speed 1 times" }));
  expect(audio.playbackRate).toBe(1.5);
  unmount();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
});
it("does not start a note after its player unmounts during URL loading", async () => {
  let resolve!: (url: string) => void;
  signedUrl.mockImplementationOnce(
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  const { unmount } = render(<VoiceNotePlayer messageId="m" durationMs={5000} />);
  fireEvent.click(screen.getByRole("button", { name: "Play voice note" }));
  unmount();
  resolve("https://example.test/voice.webm");
  await Promise.resolve();
  await Promise.resolve();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});
