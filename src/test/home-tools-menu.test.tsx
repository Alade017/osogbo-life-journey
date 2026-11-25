import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HomeToolsMenu } from "@/components/game/housing/HomeToolsMenu";

afterEach(() => {
  vi.restoreAllMocks();
});

it("opens Settings in the existing player hub without navigating away", () => {
  const dispatch = vi.spyOn(window, "dispatchEvent");
  render(
    <HomeToolsMenu>
      <button type="button">Shop</button>
      <button type="button">Lights</button>
      <button type="button">Rearrange</button>
    </HomeToolsMenu>,
  );

  fireEvent.click(screen.getByRole("button", { name: /Settings/ }));

  const event = dispatch.mock.calls
    .map(([value]) => value)
    .find((value) => value.type === "osogbo-open-player-hub") as CustomEvent<{ tab: string }> | undefined;
  expect(event?.detail).toEqual({ tab: "settings" });
  expect(screen.getByRole("button", { name: "Shop" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lights" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rearrange" })).toBeInTheDocument();
});
