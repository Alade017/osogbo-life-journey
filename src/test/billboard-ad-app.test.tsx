import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillboardAdApp } from "@/components/game/BillboardAdApp";

const mock = vi.hoisted(() => ({ market: vi.fn(), purchase: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/game", () => ({
  formatNaira: (value: number) => `₦${value}`,
  q: {
    advertisingMarket: () => ({ queryKey: ["advertisingMarket"], queryFn: mock.market }),
  },
}));
vi.mock("@/lib/advertising-service", () => ({
  billboardCampaignPrice: (daily: number, days: number) => daily * days,
  getAdvertisingMarket: mock.market,
  purchasePlayerAd: mock.purchase,
  updatePlayerAd: mock.update,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const data = {
  billboards: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Oke-Fia Junction Board",
      placement: "Facing the city route",
      sizeType: "large" as const,
      location: "Oke-Fia",
      locationId: "22222222-2222-4222-8222-222222222222",
      dailyPrice: 5000,
    },
  ],
  myAds: [],
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BillboardAdApp />
    </QueryClientProvider>,
  );
}

describe("player billboard campaign app", () => {
  beforeEach(() => {
    mock.market.mockReset().mockResolvedValue(data);
    mock.purchase.mockReset();
    mock.update.mockReset();
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });
  });

  it("edits an owned live campaign through the server service", async () => {
    mock.market.mockResolvedValue({
      ...data,
      myAds: [{
        id: "44444444-4444-4444-8444-444444444444",
        billboardId: data.billboards[0]!.id,
        billboardName: data.billboards[0]!.name,
        advertiserName: "Ade Studios",
        title: "Old headline",
        description: "Old description",
        creativeTheme: "green",
        durationDays: 7,
        amountPaid: 35000,
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: "2099-01-01T00:00:00Z",
        status: "active",
      }],
    });
    mock.update.mockResolvedValue({ ok: true });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Edit creative" }));
    const headline = screen.getAllByLabelText("Headline").at(-1)!;
    fireEvent.change(headline, { target: { value: "Fresh headline" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({
      advertisementId: "44444444-4444-4444-8444-444444444444",
      title: "Fresh headline",
    })));
  });

  it("prices and submits the selected virtual ad through the purchase service", async () => {
    mock.purchase.mockResolvedValue({ ok: true });
    mount();
    fireEvent.change(await screen.findByLabelText("Advertiser name"), {
      target: { value: "Ade Studios" },
    });
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "New collection" } });
    fireEvent.change(screen.getByLabelText("Ad description"), {
      target: { value: "Fresh designs in Osogbo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Purchase ad · ₦35000" }));
    await waitFor(() => expect(mock.purchase).toHaveBeenCalledOnce());
    expect(mock.purchase.mock.calls[0]![0]).toMatchObject({
      billboardId: data.billboards[0]!.id,
      advertiserName: "Ade Studios",
      title: "New collection",
      description: "Fresh designs in Osogbo",
      durationDays: 7,
      requestId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("retries a failed purchase with the same request ID and inputs", async () => {
    mock.purchase.mockRejectedValueOnce(new Error("Temporary network failure"));
    mount();
    fireEvent.change(await screen.findByLabelText("Advertiser name"), {
      target: { value: "Ade Studios" },
    });
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "New collection" } });
    fireEvent.change(screen.getByLabelText("Ad description"), {
      target: { value: "Fresh designs in Osogbo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Purchase ad · ₦35000" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry purchase" }));
    await waitFor(() => expect(mock.purchase).toHaveBeenCalledTimes(2));
    expect(mock.purchase.mock.calls[0]![0]).toEqual(mock.purchase.mock.calls[1]![0]);
  });
});
