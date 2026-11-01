import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RentalsPage } from "@/routes/_authenticated/_game/rentals";

const fixture = vi.hoisted(() => ({ wallet: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "fixture" } } }) },
  },
}));
vi.mock("@/lib/game", () => ({
  formatNaira: (amount: number) => `₦${amount}`,
  q: {
    character: () => ({ queryKey: ["character"], queryFn: async () => ({ id: "character" }) }),
    wallet: () => ({ queryKey: ["wallet"], queryFn: fixture.wallet }),
  },
}));
afterEach(() => vi.unstubAllGlobals());

function mount() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => ({
      ok: true,
      json: async () =>
        path.endsWith("/properties")
          ? [
              {
                propertyId: "property",
                houseTypeId: "shared-room",
                label: "Shared room",
                description: "Starter home",
                weeklyRentMinor: 100,
                depositWeeks: 1,
                upfrontTotalMinor: 200,
                slotCount: 4,
                available: true,
                isCurrentHome: false,
              },
            ]
          : { houses: [{ id: "shared-room", eligible: true }] },
    })),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RentalsPage />
    </QueryClientProvider>,
  );
  return client;
}

it("keeps rental homes visible when wallet loading fails", async () => {
  fixture.wallet.mockRejectedValue(new Error("Wallet unavailable"));
  const client = mount();
  expect(await screen.findByRole("heading", { name: "Shared room" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry wallet" })).toBeInTheDocument();
  client.clear();
});

it("loads the housing catalogue without waiting for the wallet", async () => {
  fixture.wallet.mockImplementation(() => new Promise(() => {}));
  const client = mount();
  expect(await screen.findByRole("heading", { name: "Shared room" })).toBeInTheDocument();
  client.clear();
});

it("submits an eligible rental with an idempotency key and server-owned property ID", async () => {
  fixture.wallet.mockResolvedValue({ balance: 1000 });
  const client = mount();
  fireEvent.click(await screen.findByRole("button", { name: "View Shared room" }));
  const rent = await screen.findByRole("button", { name: "Rent this" });
  await waitFor(() => expect(rent).toBeEnabled());
  fireEvent.click(rent);
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/housing/rent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ property_id: "property" }),
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
          Authorization: "Bearer fixture",
        }),
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Rent this" })).not.toBeInTheDocument(),
  );
  client.clear();
});
