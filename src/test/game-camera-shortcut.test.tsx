import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameCameraShortcut } from "@/components/game/GameCameraShortcut";

afterEach(() => vi.restoreAllMocks());

it("opens the Camera phone app from the global in-game shortcut", () => {
  const listener = vi.fn();
  window.addEventListener("osogbo-open-phone-app", listener);
  render(<GameCameraShortcut />);
  fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
  window.removeEventListener("osogbo-open-phone-app", listener);
  expect(listener).toHaveBeenCalledOnce();
  expect(listener.mock.calls[0]?.[0]).toMatchObject({
    detail: { app: "Camera" },
  });
});
