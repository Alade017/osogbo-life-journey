import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawerSheet } from "@/components/game/housing/DrawerSheet";

afterEach(cleanup);

const handlers = () => ({
  onStore: vi.fn(),
  onRetrieve: vi.fn(),
  onEquip: vi.fn(),
  onClose: vi.fn(),
});

const stored = {
  capacity: 1,
  items: [
    {
      id: "d1",
      item_id: "red-cap",
      quantity: 1,
      stored_at: "",
      category: "outfit",
      slot_type: "head",
      art_key: "red-cap",
    },
  ],
};

describe("DrawerSheet", () => {
  it("shows the stored count against the server capacity", () => {
    render(
      <DrawerSheet
        drawer={stored}
        storable={[]}
        offline={false}
        pending={false}
        error={null}
        {...handlers()}
      />,
    );
    expect(screen.getByText("1/1 stored")).toBeTruthy();
  });

  it("sends wear and take-out with the drawer id", () => {
    const h = handlers();
    render(
      <DrawerSheet
        drawer={stored}
        storable={[]}
        offline={false}
        pending={false}
        error={null}
        {...h}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Wear" }));
    fireEvent.click(screen.getByRole("button", { name: "Take out" }));
    expect(h.onEquip).toHaveBeenCalledWith("d1");
    expect(h.onRetrieve).toHaveBeenCalledWith("d1");
  });

  it("disables storing when the drawer is full", () => {
    render(
      <DrawerSheet
        drawer={stored}
        storable={[{ id: "inv1", item_id: "blue-shoes", category: "outfit", slot_type: "shoes" }]}
        offline={false}
        pending={false}
        error={null}
        {...handlers()}
      />,
    );
    const store = screen.getByRole("button", { name: "Store" }) as HTMLButtonElement;
    expect(store.disabled).toBe(true);
  });

  it("disables every action while offline", () => {
    render(
      <DrawerSheet
        drawer={stored}
        storable={[]}
        offline
        pending={false}
        error={null}
        {...handlers()}
      />,
    );
    const wear = screen.getByRole("button", { name: "Wear" }) as HTMLButtonElement;
    expect(wear.disabled).toBe(true);
  });
});
