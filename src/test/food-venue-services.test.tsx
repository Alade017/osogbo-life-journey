import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FoodVenueServices } from "@/components/game/FoodVenueServices";
const state = vi.hoisted(() => ({ actor: "owner", consume: vi.fn() }));
vi.mock("@/routes/_authenticated/_game/market", () => ({
  MarketPage: ({ foodOnly, shopSlug }: { foodOnly?: boolean; shopSlug?: string }) => <p>{foodOnly ? "Food catalogue" : "General catalogue"} · {shopSlug}</p>,
}));
vi.mock("@/lib/game", () => ({
  q: { character: () => ({ queryKey: ["character"] }), inventory: () => ({ queryKey: ["inventory"] }) },
  rpc: { useInventoryItem: (id: string) => state.consume(id) },
  useGameAction: (fn: (id: string) => void) => ({ isPending: false, mutate: fn }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "character" ? { id: state.actor } : [{
      id: "owned-meal", character_id: "owner", quantity: 1,
      item: { category: "food", icon: "", slug: "meal", name: "Owned meal", usable: true,
        effects: { time_minutes: 5, stat_changes: { hunger: -20 } } },
    }],
    isLoading: false, isError: false,
  }),
}));
beforeEach(() => { state.actor = "owner"; state.consume.mockClear(); });
afterEach(cleanup);
it("opens the existing food catalogue and consumes only through the item RPC", async () => {
  render(<FoodVenueServices shopSlug="existing-shop" />);
  expect(screen.queryByText(/Food catalogue/)).toBeNull();
  fireEvent.click(screen.getByText("Browse food & eat"));
  const eat = await screen.findByRole("button", { name: "Eat" });
  expect(screen.getByText(/Food catalogue · existing-shop/)).toBeInTheDocument();
  fireEvent.click(eat);
  expect(state.consume).toHaveBeenCalledWith("owned-meal");
});
it("blocks use of another character's inventory", async () => {
  state.actor = "other";
  render(<FoodVenueServices />);
  fireEvent.click(screen.getByText("Browse food & eat"));
  expect(await screen.findByRole("button", { name: "Eat" })).toBeDisabled();
  expect(state.consume).not.toHaveBeenCalled();
});
