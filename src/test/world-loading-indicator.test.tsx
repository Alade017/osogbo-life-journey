import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";

it("portals page loading outside transformed page containers", () => {
  const view = render(
    <div style={{ transform: "translateY(20px)" }}>
      <WorldLoadingIndicator presentation="screen" title="Travelling" progress={63} />
    </div>,
  );
  const indicator = screen.getByRole("status");
  expect(indicator.parentElement).toHaveClass("world-loading-overlay");
  expect(indicator.parentElement?.parentElement).toBe(document.body);
  expect(view.container).not.toContainElement(indicator);
  expect(screen.getByRole("progressbar", { name: "Travelling" })).toHaveAttribute(
    "aria-valuenow",
    "63",
  );
  view.unmount();
  expect(document.querySelector(".world-loading-overlay")).toBeNull();
});

it("keeps local loaders inline and bounds reported progress", () => {
  const view = render(<WorldLoadingIndicator title="Loading conversation" progress={150} />);
  expect(view.container).toContainElement(screen.getByRole("status"));
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  expect(document.querySelector(".world-loading-overlay")).toBeNull();
});
