import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { HouseEditSheets } from "@/components/game/housing/HouseEditSheets";

vi.mock("@/lib/game", () => ({ formatNaira: (amount: number) => `₦${amount}` }));

const slot = { id: "bed-1", slot_type: "bed", x: 25, y: 40 };
const outfit = { head: null, top: null, bottom: null, shoes: null, accessory: null };

function props(): ComponentProps<typeof HouseEditSheets> {
  return {
    open: true,
    offline: false,
    pending: false,
    cash: 2000,
    inventory: [],
    catalog: [
      { id: "bed", category: "furniture", slot_type: "bed", art_key: "bed", price_minor: 1400 },
    ],
    outfit,
    slots: [],
    placements: [],
    selectedSlot: null,
    selectedPlacement: null,
    onClose: vi.fn(),
    onPlace: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    onEquip: vi.fn(),
    onUnequip: vi.fn(),
    onBuy: vi.fn(),
  };
}

describe("household item panel", () => {
  it("opens the room shop and sends a purchase request", () => {
    const input = props();
    render(<HouseEditSheets {...input} />);
    expect(screen.getByRole("dialog", { name: "Shop and arrange your home" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Bedroom" }));
    expect(screen.getByText("₦1400 · bed")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    expect(input.onBuy).toHaveBeenCalledWith("bed");
  });

  it("switches between room accessories with carousel controls", () => {
    const input = props();
    input.catalog.push({
      id: "shower",
      category: "furniture",
      slot_type: "bathroom",
      art_key: "shower",
      price_minor: 1100,
    });
    render(<HouseEditSheets {...input} />);
    expect(screen.getByRole("tabpanel", { name: "Bathroom accessories" })).toHaveTextContent(
      "shower",
    );
    fireEvent.click(screen.getByRole("button", { name: "Next room" }));
    expect(
      screen.getByRole("tabpanel", { name: "Sitting room accessories" }),
    ).not.toHaveTextContent("shower");
  });

  it("moves to the next room on a horizontal swipe", () => {
    render(<HouseEditSheets {...props()} />);
    const panel = screen.getByRole("tabpanel", { name: "Bathroom accessories" });
    fireEvent.touchStart(panel, { touches: [{ clientX: 220 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 80 }] });
    expect(screen.getByRole("tabpanel", { name: "Sitting room accessories" })).toBeVisible();
  });

  it("shows included accessories in their room", () => {
    const input = props();
    input.inventory = [
      {
        id: "owned-shower",
        item_id: "shower",
        category: "furniture",
        slot_type: "bathroom",
        art_key: "shower",
        price_minor: 0,
        quantity: 1,
      },
    ];
    render(<HouseEditSheets {...input} />);
    expect(screen.getByRole("tabpanel", { name: "Bathroom accessories" })).toHaveTextContent(
      "shower",
    );
    expect(screen.getByText("Owned")).toBeVisible();
  });

  it("places owned furniture into a matching room slot", () => {
    const input = props();
    input.inventory = [
      {
        id: "owned-bed",
        item_id: "bed",
        category: "furniture",
        slot_type: "bed",
        art_key: "bed",
        price_minor: 1400,
        quantity: 1,
      },
    ];
    input.selectedSlot = slot;
    render(<HouseEditSheets {...input} />);
    fireEvent.click(screen.getByRole("button", { name: /bed Place/i }));
    expect(input.onPlace).toHaveBeenCalledWith("bed", slot);
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
  });

  it("blocks a purchase when the displayed wallet cannot afford it", () => {
    const input = props();
    input.cash = 100;
    render(<HouseEditSheets {...input} />);
    fireEvent.click(screen.getByRole("tab", { name: "Bedroom" }));
    expect(screen.getByText("Insufficient funds")).toBeVisible();
    expect(screen.getByRole("button", { name: "Buy" })).toBeDisabled();
  });
});
