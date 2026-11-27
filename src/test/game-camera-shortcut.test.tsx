import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameCameraShortcut, CAMERA_HOLD_MS } from "@/components/game/GameCameraShortcut";
import { deletePhoto, listPhotos } from "@/lib/camera-gallery";
import { registerScreenCapture } from "@/lib/camera-screen-capture";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.useRealTimers();
  for (const photo of await listPhotos()) await deletePhoto(photo.id);
});

it("opens the Camera app on a normal tap", () => {
  const listener = vi.fn();
  window.addEventListener("osogbo-open-phone-app", listener);
  render(<GameCameraShortcut />);
  const button = screen.getByRole("button", { name: "Open camera" });
  fireEvent.pointerDown(button);
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  window.removeEventListener("osogbo-open-phone-app", listener);
  expect(listener).toHaveBeenCalledOnce();
  expect(listener.mock.calls[0]?.[0]).toMatchObject({ detail: { app: "Camera" } });
});

it("takes a screenshot when held for the full hold time, without opening the app", async () => {
  const listener = vi.fn();
  window.addEventListener("osogbo-open-phone-app", listener);
  const capture = vi.fn(async () => new Blob(["png"], { type: "image/png" }));
  const unregister = registerScreenCapture(capture);
  try {
    render(<GameCameraShortcut />);
    const button = screen.getByRole("button", { name: "Open camera" });
    fireEvent.pointerDown(button);
    await act(async () => {
      vi.advanceTimersByTime(CAMERA_HOLD_MS);
    });
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(capture).toHaveBeenCalledOnce();
    expect(listener).not.toHaveBeenCalled();
    const photos = await listPhotos();
    expect(photos.map((photo) => photo.label)).toEqual(["Screenshot"]);
  } finally {
    unregister();
    window.removeEventListener("osogbo-open-phone-app", listener);
  }
});

it("does not take a screenshot when released before the hold time", async () => {
  const capture = vi.fn(async () => new Blob(["png"], { type: "image/png" }));
  const unregister = registerScreenCapture(capture);
  try {
    render(<GameCameraShortcut />);
    const button = screen.getByRole("button", { name: "Open camera" });
    fireEvent.pointerDown(button);
    await act(async () => {
      vi.advanceTimersByTime(CAMERA_HOLD_MS - 500);
    });
    fireEvent.pointerUp(button);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(capture).not.toHaveBeenCalled();
  } finally {
    unregister();
  }
});
