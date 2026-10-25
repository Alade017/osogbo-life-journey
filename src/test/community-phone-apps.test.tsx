import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommunityPhoneApps } from "@/components/game/CommunityPhoneApps";
import { PhoneCommunityServices } from "@/components/game/phone/PhoneCommunityServices";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: "player-1" } }, error: null })),
    },
    rpc: db.rpc,
    from: (table: string) => {
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: db.rows[table]?.[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: db.rows[table] ?? [], error: null }).then(resolve),
      };
      return query;
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const clients: QueryClient[] = [];
function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
beforeEach(() => {
  db.rows = { wallets: [{ balance: 10000 }] };
  db.rpc.mockReset().mockResolvedValue({ data: null, error: null });
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

it("submits the selected food quantities to the server instead of awarding local food", async () => {
  db.rows["food_vendors"] = [{ id: "kitchen-1", name: "Town kitchen" }];
  db.rows["food_menu_items"] = [
    { id: "meal-1", name: "Rice", price_minor: 500, vendor_id: "kitchen-1" },
  ];
  renderWithQuery(<PhoneCommunityServices app="Food Delivery" />);
  const quantity = await screen.findByLabelText("Rice quantity");
  expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
  fireEvent.change(quantity, { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Place order" }));
  await waitFor(() =>
    expect(db.rpc).toHaveBeenCalledWith("request_food_delivery", {
      p_vendor_id: "kitchen-1",
      p_items: [{ menu_item_id: "meal-1", quantity: 2 }],
      p_request_id: expect.any(String),
    }),
  );
  await waitFor(() => expect(quantity).toHaveValue(0));
});

it("requests a ride and displays the returned server ride history", async () => {
  db.rows["town_service_prices"] = [{ service: "okada_ride", amount_minor: 300 }];
  db.rpc.mockImplementation(async () => {
    db.rows["okada_ride_requests"] = [
      {
        id: "ride-1",
        destination: "Town market",
        fare_minor: 300,
        status: "requested",
        created_at: "2026-10-23T10:00:00Z",
      },
    ];
    return { data: null, error: null };
  });
  renderWithQuery(<PhoneCommunityServices app="Okada Rides" />);
  fireEvent.change(await screen.findByPlaceholderText("Where are you going?"), {
    target: { value: "Town market" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Request ride" }));
  expect(await screen.findByText("requested")).toBeInTheDocument();
  expect(db.rpc).toHaveBeenCalledWith("request_okada_ride", {
    p_destination: "Town market",
    p_request_id: expect.any(String),
  });
});

it("keeps contribution amounts subject to the loaded cash balance", async () => {
  db.rows["community_funds"] = [{ id: "fund-1", title: "Town garden", goal_minor: 20000 }];
  db.rows["wallets"] = [{ balance: 100 }];
  renderWithQuery(<PhoneCommunityServices app="Contribution" />);
  expect(await screen.findByRole("button", { name: "Insufficient cash" })).toBeDisabled();
  expect(db.rpc).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Contribution amount"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: /Contribute/ }));
  await waitFor(() =>
    expect(db.rpc).toHaveBeenCalledWith("contribute_to_community_fund", {
      p_fund_id: "fund-1",
      p_amount_minor: 100,
      p_request_id: expect.any(String),
    }),
  );
});

it("updates a town reaction from the server refetch", async () => {
  db.rows["town_news_posts"] = [
    {
      id: "post-1",
      category: "Community",
      title: "Garden day",
      body: "Join us",
      created_at: "2026-10-23T10:00:00Z",
    },
  ];
  db.rpc.mockImplementation(async () => {
    db.rows["town_news_reactions"] = [{ post_id: "post-1", user_id: "player-1" }];
    return { data: null, error: null };
  });
  renderWithQuery(<CommunityPhoneApps app="Town News" />);
  const like = await screen.findByRole("button", { name: "Like · 0" });
  await waitFor(() => expect(like).toBeEnabled());
  fireEvent.click(like);
  expect(
    await screen.findByRole("button", { name: "Like · 1", pressed: true }),
  ).toBeInTheDocument();
  expect(db.rpc).toHaveBeenCalledWith("toggle_town_news_reaction", {
    p_post_id: "post-1",
    p_reacted: true,
  });
});

it("keeps a rejected reaction unclaimed", async () => {
  db.rows["town_news_posts"] = [
    {
      id: "post-1",
      category: "Community",
      title: "Garden day",
      body: "Join us",
      created_at: "2026-10-23T10:00:00Z",
    },
  ];
  db.rpc.mockResolvedValue({ data: null, error: { message: "Permission denied" } });
  renderWithQuery(<CommunityPhoneApps app="Town News" />);
  const like = await screen.findByRole("button", { name: "Like · 0" });
  await waitFor(() => expect(like).toBeEnabled());
  fireEvent.click(like);
  await waitFor(() => expect(db.rpc).toHaveBeenCalledOnce());
  await waitFor(() => expect(like).toBeEnabled());
  expect(like).toHaveAttribute("aria-pressed", "false");
});
