import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { HouseCatalogue } from "@/components/game/housing/HouseCatalogue";
import { HouseEditSheets } from "@/components/game/housing/HouseEditSheets";

vi.mock("@/lib/game", () => ({ formatNaira: (amount: number) => `₦${amount}` }));
vi.mock("@/components/game/housing/CatalogThumbnail", () => ({
  CatalogThumbnailQueue: () => null,
  requestCatalogThumb: () => {},
  useCatalogThumb: () => null,
}));

const sofa = {
  id: "velvet-sofa",
  category: "furniture",
  slot_type: "seat",
  art_key: "sofa",
  price_minor: 900,
};
const lamp = {
  id: "floor-lamp",
  category: "furniture",
  slot_type: "light",
  art_key: "lamp",
  price_minor: 400,
};

function catalogueProps(): ComponentProps<typeof HouseCatalogue> {
  return {
    open: true,
    offline: false,
    pending: false,
    cash: 1000,
    inventory: [],
    catalog: [sofa, lamp],
    placements: [],
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onBuy: vi.fn(),
    onPlaceOwned: vi.fn(),
  };
}

describe("house catalogue", () => {
  it("shows a Catalogue button when closed and opens the panel from it", () => {
    const onOpen = vi.fn();
    render(<HouseCatalogue {...catalogueProps()} open={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Catalogue" }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("filters by category on the rail", () => {
    render(<HouseCatalogue {...catalogueProps()} />);
    expect(screen.getByText("velvet sofa")).toBeVisible();
    expect(screen.getByText("floor lamp")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Seats" }));
    expect(screen.getByText("velvet sofa")).toBeVisible();
    expect(screen.queryByText("floor lamp")).toBeNull();
  });

  it("buys an item that is not owned", () => {
    const input = catalogueProps();
    render(<HouseCatalogue {...input} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Buy" })[0]!);
    expect(input.onBuy).toHaveBeenCalledWith("velvet-sofa");
  });

  it("offers Place, not Buy, for an owned item that is not yet placed", () => {
    const input = catalogueProps();
    render(
      <HouseCatalogue
        {...input}
        inventory={[
          {
            id: "row-1",
            item_id: "velvet-sofa",
            category: "furniture",
            slot_type: "seat",
            art_key: "sofa",
            price_minor: 900,
            quantity: 1,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Place" }));
    expect(input.onPlaceOwned).toHaveBeenCalledWith("velvet-sofa");
  });

  it("filters to what the player can afford", () => {
    render(<HouseCatalogue {...catalogueProps()} cash={500} />);
    fireEvent.click(screen.getByRole("button", { name: "I can afford" }));
    expect(screen.getByText("floor lamp")).toBeVisible();
    expect(screen.queryByText("velvet sofa")).toBeNull();
  });
});

function itemProps(): ComponentProps<typeof HouseEditSheets> {
  return {
    offline: false,
    pending: false,
    selectedPlacement: {
      id: "placement-1",
      item_id: "velvet-sofa",
      slot: "free:placement-1",
      art_key: "sofa",
      category: "furniture",
      slot_type: "seat",
      x: 40,
      y: 40,
      rotation_deg: 0,
    },
    singleRoom: false,
    onDeselect: vi.fn(),
    onRemove: vi.fn(),
    onStartMove: vi.fn(),
    onRotate: vi.fn(),
  };
}

describe("placed item panel", () => {
  it("starts placement mode from Move", () => {
    const input = itemProps();
    render(<HouseEditSheets {...input} />);
    fireEvent.click(screen.getByRole("button", { name: /pick a new spot/i }));
    expect(input.onStartMove).toHaveBeenCalledWith(input.selectedPlacement);
  });

  it("turns the item 45 degrees", () => {
    const input = itemProps();
    render(<HouseEditSheets {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Turn velvet sofa 45 degrees" }));
    expect(input.onRotate).toHaveBeenCalledWith(input.selectedPlacement, 45);
  });

  it("stores the item only after confirming", () => {
    const input = itemProps();
    render(<HouseEditSheets {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    expect(input.onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(input.onRemove).toHaveBeenCalledWith(input.selectedPlacement);
  });
});
