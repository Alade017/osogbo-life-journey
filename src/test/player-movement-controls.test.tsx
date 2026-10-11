import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerMovementControls } from "@/components/game/PlayerMovementControls";

describe("player movement controls", () => {
  it("maps keyboard input into movement directions and releases on keyup", () => {
    const onDirectionChange = vi.fn();
    render(
      <PlayerMovementControls onDirectionChange={onDirectionChange} onFollowChange={vi.fn()} />,
    );
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(onDirectionChange).toHaveBeenLastCalledWith(new Set(["north"]));
    fireEvent.keyUp(window, { key: "ArrowUp" });
    expect(onDirectionChange).toHaveBeenLastCalledWith(new Set());
  });

  it("supports touch-pad presses and releases", () => {
    const onDirectionChange = vi.fn();
    render(
      <PlayerMovementControls onDirectionChange={onDirectionChange} onFollowChange={vi.fn()} />,
    );
    const button = screen.getByRole("button", { name: "Move east" });
    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(onDirectionChange).toHaveBeenLastCalledWith(new Set(["east"]));
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(onDirectionChange).toHaveBeenLastCalledWith(new Set());
  });
});
