import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HomeFurniturePanel } from "@/components/game/housing/HomeFurniturePanel";
import { ACTION_CATALOG } from "@/lib/life-simulation";

afterEach(cleanup);

const placement = {
  id: "tv-1",
  item_id: "television",
  slot: "living-room",
  slot_type: "entertainment",
  art_key: "television",
  category: "furniture",
  floor: 0,
  rotation_deg: 90,
};

const props = () => ({
  placement,
  roomLabel: "Living room",
  disabledReason: null,
  pending: false,
  error: "",
  onClose: vi.fn(),
  onUse: vi.fn(async () => true),
  onMove: vi.fn(),
  onStore: vi.fn(async () => {}),
});

it("routes configured tasks through the existing activity callback", async () => {
  const p = props();
  render(<HomeFurniturePanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Watch.*Choose an activity/i }));
  expect(p.onUse).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: ACTION_CATALOG.watch_tv.name }));
  expect(p.onUse).toHaveBeenCalledWith("watch_tv");
  expect(await screen.findByText(/Needs updated/)).toBeVisible();
});

it("passes Move to placement mode without starting a furniture activity", () => {
  const p = props();
  render(<HomeFurniturePanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Move.*Pick a new spot/ }));
  expect(p.onMove).toHaveBeenCalledOnce();
  expect(p.onUse).not.toHaveBeenCalled();
  expect(p.onStore).not.toHaveBeenCalled();
});

it("confirms storage and blocks rapid duplicate saves until the request settles", async () => {
  const p = props();
  let finish!: () => void;
  p.onStore = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<HomeFurniturePanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Store.*Return to inventory/ }));
  expect(p.onStore).not.toHaveBeenCalled();
  const confirm = screen.getByRole("button", { name: "Confirm store" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(p.onStore).toHaveBeenCalledOnce();
  expect(confirm).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Confirm store" })).toBeEnabled();
});

it("shows a failed store without claiming success and permits a retry", async () => {
  const p = props();
  p.onStore = vi.fn(async () => {
    throw new Error("Reconnect before saving.");
  });
  render(<HomeFurniturePanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Store.*Return to inventory/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm store" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reconnect before saving.");
  expect(screen.getByRole("button", { name: "Confirm store" })).toBeEnabled();
});

it("allows inspection while offline, but blocks mutations and activities", () => {
  const p = props();
  render(<HomeFurniturePanel {...p} disabledReason="Reconnect to use this accessory." />);
  expect(screen.getByRole("button", { name: /Move.*Pick a new spot/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Store.*Return to inventory/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Inspect.*Look closer/ }));
  expect(screen.getByText("90°")).toBeVisible();
  expect(screen.getByText("Ground floor")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Reconnect");
  expect(p.onUse).not.toHaveBeenCalled();
});

it("offers inspect and rearrangement for decorative items without inventing an activity", () => {
  const p = props();
  render(<HomeFurniturePanel {...p} placement={{ ...placement, item_id: "wall-art-landscape" }} />);
  expect(screen.getByRole("button", { name: /Decoration.*Inspect or rearrange/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Move.*Pick a new spot/ })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: /Inspect.*Look closer/ }));
  expect(screen.getByRole("heading", { name: "Wall Art Landscape" })).toBeVisible();
});

it("supports Escape and shared HUD dismissal", () => {
  const p = props();
  render(<HomeFurniturePanel {...p} />);
  expect(screen.getByRole("button", { name: "Close furniture actions" })).toHaveFocus();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(p.onClose).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event("osogbo-hud-dismiss-panels"));
  expect(p.onClose).toHaveBeenCalledTimes(2);
});
