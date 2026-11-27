import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HomeToolsMenu } from "@/components/game/housing/HomeToolsMenu";

afterEach(() => {
  vi.restoreAllMocks();
});

it("keeps home tools available without exposing a Settings action", () => {
  const dispatch = vi.spyOn(window, "dispatchEvent");
  render(
    <HomeToolsMenu>
      <button type="button">Shop</button>
      <button type="button">Lights</button>
      <button type="button">Rearrange</button>
    </HomeToolsMenu>,
  );

  expect(screen.queryByRole("button", { name: /Settings/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Shop" }));

  expect(screen.getByRole("button", { name: "Lights" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rearrange" })).toBeInTheDocument();
  expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "osogbo-open-player-hub" }));
});
