import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NeighborhoodZoneModal } from "@/components/game/NeighborhoodZoneModal";
import { findInteractableZone } from "@/game/neighborhood-interactions";
const state = vi.hoisted(() => ({
  location: "city",
  failArrival: false,
  travel: vi.fn(),
  deposit: vi.fn(),
  withdraw: vi.fn(),
  navigate: vi.fn(),
  close: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => state.navigate }));
vi.mock("sonner", () => ({ toast: { error: state.error, success: state.success } }));
vi.mock("@/components/game/LocationVenueScene", () => ({
  LocationVenueScene: () => <div>Buka interior</div>,
}));
vi.mock("@/components/game/FoodVenueServices", () => ({
  FoodVenueServices: ({ shopSlug }: { shopSlug?: string | null }) => (
    <div data-testid="food-venue-services">
      Food purchase and eating services · {shopSlug ?? "location offers"}
    </div>
  ),
}));
vi.mock("@/components/game/phone/PhoneBankApp", () => ({
  PhoneBankApp: () => <div>Bank account services</div>,
}));
vi.mock("@/routes/_authenticated/_game/market", () => ({
  MarketPage: ({ foodOnly }: { foodOnly: boolean }) => (
    <div>{foodOnly ? "Server food catalogue" : "Server shop catalogue"}</div>
  ),
}));
vi.mock("@/routes/_authenticated/_game/jobs", () => ({
  JobsPage: () => <div>Server career shifts</div>,
}));
vi.mock("@/lib/game", () => ({
  formatNaira: (n: number) => `₦${n.toLocaleString("en-NG")}`,
  rpc: {
    travelToLocation: (...a: unknown[]) => state.travel(...a),
    depositCash: (...a: unknown[]) => state.deposit(...a),
    withdrawCash: (...a: unknown[]) => state.withdraw(...a),
  },
  q: {
    character: () => ({
      queryKey: ["character"],
      queryFn: async () => {
        if (state.failArrival && state.travel.mock.calls.length) throw new Error("offline");
        return {
          id: "player",
          user_id: "account",
          current_location_id: state.location,
          inside_home_property_id: null,
        };
      },
    }),
    locations: () => ({
      queryKey: ["locations"],
      queryFn: async () => [
        {
          id: "city",
          name: "City centre",
          slug: "city-centre",
          is_active: true,
          travel_fare: 0,
          travel_minutes: 1,
          metadata: null,
        },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `destination-${i}`,
          name: `District ${i}`,
          slug: `district-${i}`,
          is_active: true,
          travel_fare: 100 * (i + 1),
          travel_minutes: 20,
          metadata: null,
        })),
      ],
    }),
    bankAccount: () => ({
      queryKey: ["bankAccount"],
      queryFn: async () => ({ id: "bank-account" }),
    }),
    wallet: () => ({
      queryKey: ["wallet"],
      queryFn: async () => ({ balance: 10000, bank_balance: 10000 }),
    }),
    transactions: () => ({ queryKey: ["transactions"], queryFn: async () => [] }),
  },
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  state.location = "city";
  state.failArrival = false;
  state.navigate.mockResolvedValue(undefined);
  state.deposit.mockResolvedValue({});
  state.withdraw.mockResolvedValue({});
  state.travel.mockImplementation(async ({ locationId }: { locationId: string }) => {
    state.location = locationId;
    return { fare: 115 };
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
});
function setup(zoneId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <NeighborhoodZoneModal
        open
        onOpenChange={state.close}
        zone={findInteractableZone(zoneId)!}
        npc={null}
        pocketBalance={10000}
        bankBalance={10000}
        needs={{ hunger: 70, energy: 70, hygiene: 70, bladder: 70, fun: 70, social: 70 }}
        currentLocationId="city"
        currentLocationSlug="city-centre"
        npcTip={null}
        onNpcTipSelect={() => {}}
      />
    </QueryClientProvider>,
  );
  return client;
}
it("opens real food services without exposing fabricated meal rewards", () => {
  setup("zone-mini-mart");
  expect(screen.queryByText(/Only confirmed bank/)).not.toBeInTheDocument();
  expect(screen.queryByText(/\+26 Hunger/)).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: /Food & drinks/ })[0]!);
  expect(screen.getByTestId("food-venue-services")).toHaveTextContent(
    "Food purchase and eating services",
  );
});

it("opens the food purchase and eating services at Mama Sikira Buka", () => {
  setup("zone-buka-stall");
  fireEvent.click(screen.getAllByRole("button", { name: /Food & drinks/ })[0]!);
  expect(screen.getByTestId("food-venue-services")).toHaveTextContent("location offers");
});
it("uses destination fares and shows routes beyond the first six", async () => {
  setup("zone-transit-stand");
  fireEvent.click(screen.getAllByRole("button", { name: /District routes/ })[0]!);
  expect(await screen.findByRole("button", { name: /District 7/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /District 0/ })).toHaveTextContent("₦115");
  fireEvent.click(screen.getByRole("button", { name: /District 0/ }));
  expect(state.travel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm trip" }));
  await waitFor(() =>
    expect(state.navigate).toHaveBeenCalledWith({
      to: "/location/$slug",
      params: { slug: "district-0" },
    }),
  );
  expect(state.travel).toHaveBeenCalledTimes(1);
});
it("retries loading an already confirmed destination without paying again", async () => {
  state.failArrival = true;
  setup("zone-transit-stand");
  fireEvent.click(screen.getAllByRole("button", { name: /District routes/ })[0]!);
  fireEvent.click(await screen.findByRole("button", { name: /District 0/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm trip" }));
  const retry = await screen.findByRole("button", { name: "Retry destination loading" });
  await waitFor(() => expect(retry).not.toBeDisabled());
  expect(state.close).not.toHaveBeenCalled();
  state.failArrival = false;
  fireEvent.click(retry);
  await waitFor(() => expect(state.navigate).toHaveBeenCalled());
  expect(state.travel).toHaveBeenCalledTimes(1);
});
it("blocks repeat bank submissions and refreshes authoritative caches", async () => {
  let resolve!: () => void;
  state.deposit.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const client = setup("zone-bank-atm"),
    invalidate = vi.spyOn(client, "invalidateQueries");
  const button = await screen.findByRole("button", { name: /Deposit ₦2,000/ });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(state.deposit).toHaveBeenCalledTimes(1));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(state.close).not.toHaveBeenCalled();
  await act(async () => resolve());
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["transactions"] }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["wallet"] });
});
it("requires a refresh after an unconfirmed bank response", async () => {
  state.deposit.mockRejectedValue(new Error("connection lost"));
  setup("zone-bank-atm");
  const button = await screen.findByRole("button", { name: /Deposit ₦2,000/ });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  await screen.findByRole("button", { name: "Refresh account" });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh account" }));
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(state.deposit).toHaveBeenCalledTimes(1);
});
