import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhoneMarketApp } from "@/components/game/phone/PhoneMarketApp";
const api = vi.hoisted(() => ({
  profile: vi.fn(),
  rent: vi.fn(),
  stock: vi.fn(),
  manage: vi.fn(),
  save: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  actor: "player",
}));
vi.mock("@/lib/market-stall-service", async (original) => ({
  ...(await original<typeof import("@/lib/market-stall-service")>()),
  getMyPlayerStall: api.profile,
  getMarketStallRentStatus: api.rent,
  getMyStallStock: api.stock,
  manageMyStallStock: api.manage,
  saveMyPlayerStall: api.save,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: async () => ({ data: [], error: null }) }), rpc: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: api.error, success: api.success } }));
vi.mock("@/components/game/StallIncomePanel", () => ({
  StallIncomePanel: () => <div>Passive income</div>,
}));
vi.mock("@/components/game/phone/PublicStallDirectory", () => ({
  PublicStallDirectory: () => <div>Player stalls</div>,
}));
vi.mock("@/components/ui/palette-select", () => ({
  PaletteSelect: ({
    value,
    onValueChange,
    disabled,
    options,
  }: {
    value: string;
    onValueChange: (s: string) => void;
    disabled: boolean;
    options: Array<{ value: string; label: string }>;
  }) => (
    <select
      aria-label="Stall category"
      disabled={disabled}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/hooks/use-world-clock", () => ({ useWorldClock: () => ({ data: { hour: 12 } }) }));
vi.mock("@/lib/game", () => ({
  formatNaira: (n: number) => `₦${n}`,
  rpc: {},
  useGameAction: () => ({ isPending: false, mutate: vi.fn() }),
  q: {
    character: () => ({
      queryKey: ["character"],
      queryFn: async () => ({
        id: api.actor,
        user_id: api.actor,
        name: "Ade",
        current_location_id: "city",
      }),
    }),
    wallet: () => ({ queryKey: ["wallet"], queryFn: async () => ({ balance: 10000 }) }),
    inventory: () => ({
      queryKey: ["inventory"],
      queryFn: async () => [
        {
          id: "bag",
          item_id: "22222222-2222-4222-8222-222222222222",
          quantity: 3,
          item: { name: "Cotton", sellable: true, buy_price: 100 },
        },
      ],
    }),
    shopItems: () => ({ queryKey: ["shopItems"], queryFn: async () => [] }),
    locations: () => ({ queryKey: ["locations"], queryFn: async () => [] }),
  },
}));
const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ade Cloth",
  stall_category: "fabrics",
  goods: "Fabrics",
  is_open: false,
};
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <PhoneMarketApp />
      </QueryClientProvider>,
    ),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.actor = "player";
  api.profile.mockResolvedValue(profile);
  api.rent.mockResolvedValue({
    status: "current",
    weeklyRentMinor: 2000,
    dueAt: "2026-11-25T12:00:00Z",
  });
  api.stock.mockResolvedValue([]);
  api.manage.mockResolvedValue({ ok: true, action: "add", id: profile.id, quantity: 1 });
  api.save.mockImplementation(async (input) => {
    api.profile.mockResolvedValue({
      ...profile,
      name: input.name,
      stall_category: input.category,
      is_open: input.isOpen,
    });
    return { ok: true, isOpen: input.isOpen, category: input.category };
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  vi.restoreAllMocks();
});
it("keeps unsaved open changes separate from the saved badge, then resyncs the editor after save", async () => {
  const { client } = setup();
  await screen.findByText("○ Closed (saved)");
  fireEvent.click(screen.getByRole("button", { name: "Stall is Closed" }));
  expect(screen.getByText("○ Closed (saved)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save stall details" }));
  await screen.findByText("● Open (saved)");
  await waitFor(() => expect(api.success).toHaveBeenCalled());
  act(() =>
    client.setQueryData(["playerStall", "player"], {
      ...profile,
      is_open: false,
      name: "Renamed by server",
    }),
  );
  expect(await screen.findByRole("button", { name: "Stall is Closed" })).toBeInTheDocument();
  expect(await screen.findByDisplayValue("Renamed by server")).toBeInTheDocument();
});
it("blocks the editor on profile loading failure and offers recovery", async () => {
  api.profile.mockRejectedValue(new Error("offline"));
  setup();
  await screen.findByRole("button", { name: "Reload stall details" });
  expect(screen.queryByRole("button", { name: "Save stall details" })).not.toBeInTheDocument();
  api.profile.mockResolvedValue(profile);
  fireEvent.click(screen.getByRole("button", { name: "Reload stall details" }));
  await screen.findByDisplayValue("Ade Cloth");
  expect(api.save).not.toHaveBeenCalled();
});
it("displays sold-out listings with restock and remove controls", async () => {
  api.stock.mockResolvedValue([
    {
      id: profile.id,
      itemId: "22222222-2222-4222-8222-222222222222",
      name: "Cotton",
      quantity: 0,
      priceMinor: 100,
      referenceBuyPrice: 100,
    },
  ]);
  setup();
  expect(await screen.findByText(/Sold out/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Stock" })).toBeEnabled();
});
it("persists before submission, blocks duplicate clicks and recovers the exact request across remount", async () => {
  api.manage.mockImplementationOnce(async (intent) => {
    expect(JSON.parse(localStorage.getItem("osun:stall-stock:player")!)).toEqual(intent);
    throw new Error("offline");
  });
  const view = setup();
  const button = await screen.findByRole("button", { name: "Stock" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(api.error).toHaveBeenCalled());
  expect(api.manage).toHaveBeenCalledTimes(1);
  const first = api.manage.mock.calls[0]![0];
  view.unmount();
  setup();
  const retry = await screen.findByRole("button", { name: "Retry stock update" });
  expect(await screen.findByRole("button", { name: "Stock" })).toBeDisabled();
  fireEvent.click(retry);
  await waitFor(() => expect(api.manage).toHaveBeenCalledTimes(2));
  expect(api.manage.mock.calls[1]![0]).toEqual(first);
  await waitFor(() => expect(localStorage.length).toBe(0));
});
it("does not submit if request storage fails", async () => {
  setup();
  const button = await screen.findByRole("button", { name: "Stock" });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("disabled");
  });
  fireEvent.click(button);
  expect(api.manage).not.toHaveBeenCalled();
  expect(api.error).toHaveBeenCalledWith(expect.stringContaining("No stock update was submitted"));
});
it("replays the saved request if inventory refresh fails after confirmation", async () => {
  const { client } = setup();
  const button = await screen.findByRole("button", { name: "Stock" });
  const invalidate = vi
    .spyOn(client, "invalidateQueries")
    .mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(button);
  await waitFor(() => expect(api.error).toHaveBeenCalled());
  const first = api.manage.mock.calls[0]![0];
  invalidate.mockRestore();
  fireEvent.click(await screen.findByRole("button", { name: "Retry stock update" }));
  await waitFor(() => expect(api.manage).toHaveBeenCalledTimes(2));
  expect(api.manage.mock.calls[1]![0]).toEqual(first);
});
it("loads a new character editor without carrying over unsaved details", async () => {
  const { client } = setup();
  const input = await screen.findByDisplayValue("Ade Cloth");
  fireEvent.change(input, { target: { value: "Unsaved name" } });
  api.actor = "other-player";
  api.profile.mockResolvedValue({ ...profile, name: "Other stall" });
  act(() =>
    client.setQueryData(["character"], { id: api.actor, user_id: api.actor, name: "Bisi" }),
  );
  await screen.findByDisplayValue("Other stall");
  expect(screen.queryByDisplayValue("Unsaved name")).not.toBeInTheDocument();
});
