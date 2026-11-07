import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HomeAccessoryPanel } from "@/components/game/housing/HomeAccessoryPanel";
import { ACTION_CATALOG } from "@/lib/life-simulation";
import { homeTaskSeconds } from "@/lib/home-furniture-actions";

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
  expect(screen.getByRole("region", { name: "Your cooker action" })).toBeVisible();
  expect(screen.getAllByText(`${homeTaskSeconds("cook")}s`).length).toBeGreaterThan(0);
  expect(screen.getByText(`+${ACTION_CATALOG.cook.needs.hunger} Hunger`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Akara & ogi" }));
  expect(screen.getByRole("radio", { name: "Akara & ogi" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Cook Akara & ogi" }));
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
  expect(screen.getByRole("region", { name: "Shower action" })).toBeVisible();
  const actionButton = screen.getByRole("button", { name: "Take a shower" });
  expect(screen.queryByRole("button", { name: "Go outside" })).not.toBeInTheDocument();
  fireEvent.click(actionButton);
  expect(p.onUse).toHaveBeenCalledOnce();
  const repeat = await screen.findByRole("button", { name: "Take a shower again" });
  expect(repeat).toBeEnabled();
  expect(screen.getByRole("status")).toHaveTextContent("Needs updated");
  fireEvent.click(repeat);
  expect(p.onUse).toHaveBeenCalledTimes(2);
});

it("cooks another meal without closing the panel and clears the previous confirmation", async () => {
  const p = props();
  render(<HomeAccessoryPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "Cook Jollof rice" }));
  expect(await screen.findByRole("button", { name: "Cook Jollof rice again" })).toBeEnabled();
  fireEvent.click(screen.getByRole("radio", { name: "Akara & ogi" }));
  expect(screen.queryByText(/Needs updated/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cook Akara & ogi" }));
  expect(p.onUse).toHaveBeenCalledTimes(2);
});

it("blocks rapid duplicate requests before the parent reports pending", async () => {
  let finish!: (ok: boolean) => void;
  const p = props();
  p.onUse = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  render(<HomeAccessoryPanel {...p} />);
  const button = screen.getByRole("button", { name: "Cook Jollof rice" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(p.onUse).toHaveBeenCalledOnce();
  expect(button).toBeDisabled();
  finish(true);
  expect(await screen.findByRole("button", { name: "Cook Jollof rice again" })).toBeEnabled();
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
  fireEvent.click(screen.getByRole("button", { name: "Close accessory" }));
  expect(p.onClose).toHaveBeenCalledOnce();
});

it("shows alternative task durations and passes the chosen action to the task runner", () => {
  const p = props();
  render(<HomeAccessoryPanel {...p} placement={{ ...placement, item_id: "rain-shower" }} />);
  fireEvent.click(screen.getByRole("button", { name: /Wash your hands 3s/ }));
  expect(screen.getAllByText("3s").length).toBeGreaterThan(0);
  expect(screen.getByText("+12 Hygiene")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Wash your hands" }));
  expect(p.onUse).toHaveBeenCalledWith("wash_hands");
});
