import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HomeAccessoryPanel } from "@/components/game/housing/HomeAccessoryPanel";
import { ACTION_CATALOG } from "@/lib/life-simulation";

afterEach(cleanup);
const placement = {
  id: "cooker",
  item_id: "two-burner-cooker",
  slot: "kitchen",
  slot_type: "kitchen",
  art_key: "stove",
  category: "furniture",
};
const props = () => ({
  placement,
  disabledReason: null,
  pending: false,
  error: "",
  onClose: vi.fn(),
  onUse: vi.fn(async () => true),
});

it("shows real cooking terms and changes meal preference without changing the activity", () => {
  const p = props();
  render(<HomeAccessoryPanel {...p} />);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Your cooker");
  expect(screen.getByText(`${ACTION_CATALOG.cook.durationMinutes} game min`)).toBeInTheDocument();
  expect(screen.getByText(`+${ACTION_CATALOG.cook.needs.hunger} Hunger`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Indomie & egg" }));
  expect(screen.getByRole("radio", { name: "Indomie & egg" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Cook Indomie & egg" }));
  expect(p.onUse).toHaveBeenCalledOnce();
  expect(screen.getByText(`+${ACTION_CATALOG.cook.needs.hunger} Hunger`)).toBeInTheDocument();
});
it("blocks use and reports the existing availability reason", () => {
  const p = props();
  render(<HomeAccessoryPanel {...p} disabledReason="Enter your home to use this accessory." />);
  fireEvent.click(screen.getByRole("button", { name: "Cook Jollof rice" }));
  expect(p.onUse).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Enter your home");
});
it("prevents repeated submissions while an activity request is pending", () => {
  const p = props();
  render(<HomeAccessoryPanel {...p} pending />);
  expect(screen.getByRole("button", { name: "Starting cook jollof rice…" })).toBeDisabled();
  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
});

it("labels a shower action explicitly and confirms the synced needs update", async () => {
  const p = props();
  render(
    <HomeAccessoryPanel
      {...p}
      placement={{ ...placement, id: "shower", item_id: "rain-shower" }}
    />,
  );
  const actionButton = screen.getByRole("button", { name: "Take a shower" });
  fireEvent.click(actionButton);
  expect(p.onUse).toHaveBeenCalledOnce();
  expect(await screen.findByRole("button", { name: "Done — needs updated" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Needs updated");
});

it("presents non-cooking tasks without invented meal options", () => {
  const p = props();
  render(
    <HomeAccessoryPanel
      {...p}
      placement={{ ...placement, item_id: "starter-bed" }}
      error="Reconnect first"
    />,
  );
  expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: ACTION_CATALOG.sleep.name })).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Reconnect first");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(p.onClose).toHaveBeenCalledOnce();
});
