import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessInvestmentApp } from "@/components/game/BusinessInvestmentApp";
const mock = vi.hoisted(() => ({ action: vi.fn(), market: vi.fn() }));
vi.mock("@/lib/game", () => ({
  formatNaira: (value: number) => `₦${value}`,
  q: {
    businessMarket: () => ({
      queryKey: ["businessInvestmentMarket"],
      queryFn: mock.market,
      retry: false,
    }),
  },
  rpc: { businessAction: mock.action },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const empty = {
  businesses: [],
  companies: [],
  products: [],
  myCompanies: [],
  myInvestments: [],
  myCompanyInvestments: [],
};
function mount(mode: "company" | "invest") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BusinessInvestmentApp mode={mode} />
    </QueryClientProvider>,
  );
}
describe("business and investment interface", () => {
  beforeEach(() => {
    mock.action.mockReset();
    mock.market.mockReset();
  });
  it("purchases through the service and retries with the identical command", async () => {
    mock.market.mockResolvedValue({
      ...empty,
      businesses: [
        {
          slug: "studio",
          name: "Studio",
          description: "Creative work",
          location: "oke-fia",
          price: 500000,
          dailyCustomers: 28,
          services: [],
        },
      ],
    });
    mock.action.mockRejectedValueOnce(new Error("Response lost")).mockResolvedValue({ ok: true });
    mount("company");
    fireEvent.click(await screen.findByRole("button", { name: "Buy company" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry last action" }));
    await waitFor(() => expect(mock.action).toHaveBeenCalledTimes(2));
    expect(mock.action.mock.calls[0]![0]).toEqual(mock.action.mock.calls[1]![0]);
    expect(mock.action.mock.calls[0]![0]).toMatchObject({ kind: "buy", slug: "studio" });
  });
  it("disables invalid fixed-term amounts and hides own-company share offers", async () => {
    mock.market.mockResolvedValue({
      ...empty,
      products: [
        {
          slug: "susu",
          name: "Susu",
          description: "Savings",
          termDays: 7,
          yieldBps: 200,
          minAmount: 10000,
          maxAmount: 1000000,
        },
      ],
      companies: [
        {
          id: "mine",
          name: "My studio",
          owner: "Me",
          location: "oke-fia",
          sharesForSale: 1000,
          pricePerShare: 50,
          isOwner: true,
        },
      ],
    });
    mount("invest");
    const invest = await screen.findByRole("button", { name: "Invest" });
    expect(invest).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Investment amount in Naira"), {
      target: { value: "1" },
    });
    expect(invest).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Buy shares" })).not.toBeInTheDocument();
  });
  it("shows loading failures with a retry control", async () => {
    mock.market.mockRejectedValue(new Error("Finance market unavailable"));
    mount("company");
    expect(await screen.findByRole("alert")).toHaveTextContent("Finance market unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
