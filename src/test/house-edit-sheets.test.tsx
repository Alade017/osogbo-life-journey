import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { HouseEditSheets } from "@/components/game/housing/HouseEditSheets";

vi.mock("@/lib/game", () => ({ formatNaira: (amount: number) => `₦${amount}` }));
vi.mock("@/components/game/housing/CatalogThumbnail", () => ({
  CatalogThumbnailQueue: () => null,
  requestCatalogThumb: () => {},
  useCatalogThumb: () => null,
}));

const slot = { id: "bed-1", slot_type: "bed", x: 25, y: 40 };

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
    slots: [slot],
    placements: [],
    selectedSlot: null,
    selectedPlacement: null,
    singleRoom: true,
    onClose: vi.fn(),
    onPlace: vi.fn(),
    onSelectSlot: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    onBuy: vi.fn(),
    onRotate: vi.fn(),
  };
}

describe("household item panel", () => {
  it("opens the room shop and sends a purchase request", () => {
    const input = props();
    render(<HouseEditSheets {...input} />);
    expect(screen.getByRole("dialog", { name: "Shop and arrange your home" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Bedroom" }));
    expect(screen.getByText("₦1400")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    expect(input.onBuy).toHaveBeenCalledWith("bed");
  });

  it("switches between room accessories with carousel controls", () => {
    const input = props();
    input.slots.push({ id: "bathroom-1", slot_type: "bathroom", x: 50, y: 50 });
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
    fireEvent.click(screen.getByRole("button", { name: "Place bed" }));
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

  it("filters the room catalog and offers a compatible slot for owned furniture", () => {
    const input = props();
    input.slots.push({ id: "bathroom-1", slot_type: "bathroom", x: 50, y: 50 });
    input.catalog.push({
      id: "shower",
      category: "furniture",
      slot_type: "bathroom",
      art_key: "shower",
      price_minor: 1100,
    });
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
    render(<HouseEditSheets {...input} />);
    expect(screen.getByRole("tabpanel", { name: "Bathroom accessories" })).toHaveTextContent(
      "shower",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Bedroom" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose slot" }));
    expect(input.onSelectSlot).toHaveBeenCalledWith(slot);
  });

  it("keeps avatar equipment out of the furniture catalogue", () => {
    const input = props();
    input.catalog.push({
      id: "blue-shirt",
      category: "outfit",
      slot_type: "top",
      art_key: "blue-shirt",
      price_minor: 900,
    });
    input.inventory.push({
      id: "owned-shirt",
      item_id: "blue-shirt",
      category: "outfit",
      slot_type: "top",
      art_key: "blue-shirt",
      price_minor: 900,
      quantity: 1,
    });
    render(<HouseEditSheets {...input} />);
    expect(screen.queryByRole("tab", { name: "Avatar" })).not.toBeInTheDocument();
    expect(screen.queryByText("blue shirt")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Equip" })).not.toBeInTheDocument();
  });

  it("saves a selected accessory angle through the rotation callback", () => {
    const input = props();
    input.selectedPlacement = {
      id: "bed-placement",
      item_id: "bed",
      slot: slot.id,
      slot_type: "bed",
      category: "furniture",
      art_key: "bed",
      rotation_deg: 15,
    };
    render(<HouseEditSheets {...input} />);
    const slider = screen.getByRole("slider", { name: "Turn angle" });
    expect(slider).toHaveAttribute("aria-valuetext", "15 degrees");
    fireEvent.change(slider, { target: { value: "120" } });
    fireEvent.pointerUp(slider);
    expect(input.onRotate).toHaveBeenCalledWith(input.selectedPlacement, 120);
  });

  it("turns a selected accessory by 45 degrees", () => {
    const input = props();
    input.selectedPlacement = {
      id: "bed-placement",
      item_id: "bed",
      slot: slot.id,
      slot_type: "bed",
      category: "furniture",
      art_key: "bed",
      rotation_deg: 315,
    };
    render(<HouseEditSheets {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Turn bed 45 degrees" }));
    expect(input.onRotate).toHaveBeenCalledWith(input.selectedPlacement, 0);
  });
});
