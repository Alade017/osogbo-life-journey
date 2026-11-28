import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { HomeToolsMenu } from "@/components/game/housing/HomeToolsMenu";

it("keeps home tools available without exposing a Settings action", () => {
  render(
    <HomeToolsMenu>
      <button type="button">Shop</button>
      <button type="button">Lights</button>
      <button type="button">Rearrange</button>
    </HomeToolsMenu>,
  );

  const summary = screen.getByTitle("Home tools");
  fireEvent.click(summary);
  expect(summary.closest("details")).toHaveAttribute("open");
  expect(screen.queryByRole("button", { name: /Settings/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Shop" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lights" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rearrange" })).toBeInTheDocument();
});
