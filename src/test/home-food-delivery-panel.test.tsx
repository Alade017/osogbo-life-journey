import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { HomeFoodDeliveryPanel } from "@/components/game/housing/HomeFoodDeliveryPanel";
import type { FoodDelivery } from "@/lib/food-delivery-service";

const delivery: FoodDelivery = {
  id: "order-1",
  status: "preparing",
  deliveryState: "awaiting_response",
  deliveryChoice: null,
  totalMinor: 1200,
  createdAt: "2026-10-23T10:00:00Z",
  vendorName: "Iya Mufu Kitchen",
  items: [{ name: "Jollof rice", quantity: 2 }],
};

it("offers the player a choice when the courier knocks", () => {
  const onRespond = vi.fn();
  render(
    <HomeFoodDeliveryPanel
      deliveries={[delivery]}
      error={false}
      responsePending={false}
      collectionPending={false}
      onRetry={vi.fn()}
      onRespond={onRespond}
      onCollect={vi.fn()}
    />,
  );

  expect(screen.getByText("Iya Mufu Kitchen · 2 × Jollof rice")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Invite inside" }));
  expect(onRespond).toHaveBeenCalledWith("order-1", "inside");
  fireEvent.click(screen.getByRole("button", { name: "Receive outside" }));
  expect(onRespond).toHaveBeenCalledWith("order-1", "outside");
});

it("keeps the branded package visible and collectible after handoff", () => {
  const onCollect = vi.fn();
  render(
    <HomeFoodDeliveryPanel
      deliveries={[{ ...delivery, deliveryState: "package_waiting" }]}
      error={false}
      responsePending={false}
      collectionPending={false}
      onRetry={vi.fn()}
      onRespond={vi.fn()}
      onCollect={onCollect}
    />,
  );

  expect(screen.getByText("Iya Mufu Kitchen")).toBeInTheDocument();
  expect(screen.getByText("2 × Jollof rice")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collect package" }));
  expect(onCollect).toHaveBeenCalledWith("order-1");
});
