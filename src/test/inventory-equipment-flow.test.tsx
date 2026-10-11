import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InventoryPage } from "@/routes/_authenticated/_game/inventory";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  ownedShirt: {
    id: "owned-shirt",
    character_id: "character-1",
    user_id: "user-1",
    item_id: "item-shirt",
    quantity: 1,
    item: {
      id: "item-shirt",
      slug: "basic_outfit",
      name: "Basic Outfit",
      description: "A simple outfit.",
      category: "clothing",
      icon: "shirt",
      usable: false,
      equippable: true,
      equipment_slot: "top",
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "inventory")
      return { data: [mocks.ownedShirt], isLoading: false, isError: false };
    if (queryKey[0] === "character") return { data: { id: "character-1" } };
    if (queryKey[0] === "equipment") return { data: [] };
    return { data: [] };
  },
}));
vi.mock("@/lib/game", () => ({
  q: {
    inventory: () => ({ queryKey: ["inventory"] }),
    character: () => ({ queryKey: ["character"] }),
    equipment: () => ({ queryKey: ["equipment"] }),
  },
  rpc: { useInventoryItem: vi.fn(), unequipItem: vi.fn(), discardInventoryItem: vi.fn() },
  useGameAction: () => ({ mutate: mocks.mutate, isPending: false }),
}));
vi.mock("@/lib/seo", () => ({ pageMeta: vi.fn() }));

describe("inventory equipment selection", () => {
  it("filters to a slot when tapped and uses the existing equip action", () => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    render(<InventoryPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Choose from bag" })[1]!);
    expect(screen.getByRole("status")).toHaveTextContent(/Choose an item for the top slot/i);
    fireEvent.click(screen.getByRole("button", { name: /Basic Outfit/ }));
    fireEvent.click(screen.getByRole("button", { name: "Equip (top)" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ id: "owned-shirt", slot: "top" });
  });
});
