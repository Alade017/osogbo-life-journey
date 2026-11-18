import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NeighborhoodPersonalService } from "@/components/game/NeighborhoodPersonalService";
const api = vi.hoisted(() => ({
  catalogue: vi.fn(),
  submit: vi.fn(),
  refresh: vi.fn(),
  busy: vi.fn(),
}));
vi.mock("@/lib/neighborhood-personal-services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/neighborhood-personal-services")>()),
  fetchPersonalServices: api.catalogue,
  submitPersonalService: api.submit,
}));
vi.mock("@/lib/equipment-service", () => ({ announceEquipmentRefresh: api.refresh }));
vi.mock("@/lib/game", () => ({
  formatNaira: (n: number) => `₦${n.toLocaleString("en-NG")}`,
  q: {
    character: () => ({
      queryKey: ["character"],
      queryFn: async () => ({
        id: "player",
        gender: "male",
        appearance: { hair: 1, hairColor: 0, skin: 3, outfit: 4 },
      }),
    }),
    wallet: () => ({
      queryKey: ["wallet"],
      queryFn: async () => ({ balance: 10000, bank_balance: 10000 }),
    }),
  },
}));
const barber = {
  id: "barber-style",
  kind: "barber",
  label: "Hair styling",
  cash_price: 1500,
  cash_payout: 0,
  bank_fee: 0,
  hair_styles: ["Low fade", "Short afro", "Cornrows"],
  hair_colors: ["#1b1410", "#3b2416"],
  available: true,
};
const pos = {
  ...barber,
  id: "pos-cashout",
  kind: "pos",
  label: "POS cash withdrawal",
  cash_price: 0,
  cash_payout: 2000,
  bank_fee: 100,
  hair_styles: [],
  hair_colors: [],
};
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.catalogue.mockImplementation(async () => [barber, pos]);
  api.submit.mockResolvedValue({ ok: true, service_id: "barber-style", cash: 8500, bank: 10000 });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  vi.restoreAllMocks();
});
function setup(kind: "barber" | "pos" = "barber") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const view = render(
    <QueryClientProvider client={client}>
      <NeighborhoodPersonalService
        zoneId={kind === "barber" ? "zone-shop-barber" : "zone-shop-pos"}
        kind={kind}
        onBusyChange={api.busy}
      />
    </QueryClientProvider>,
  );
  return { client, ...view };
}
it("charges only after an explicit hair choice and refreshes the saved character", async () => {
  const { client } = setup(),
    invalidate = vi.spyOn(client, "invalidateQueries");
  const style = await screen.findByLabelText("Hair style");
  await waitFor(() => expect(style).toHaveValue("1"));
  expect(screen.getByRole("button", { name: "Pay and save hairstyle" })).toBeDisabled();
  fireEvent.change(style, { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Hair colour"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Pay and save hairstyle" }));
  await screen.findByText("Your new hairstyle is saved.");
  expect(api.submit).toHaveBeenCalledWith(
    expect.objectContaining({
      serviceId: "barber-style",
      hair: 2,
      hairColor: 1,
      quote: { cash_price: 1500, cash_payout: 0, bank_fee: 0 },
    }),
    expect.anything(),
  );
  expect(api.refresh).toHaveBeenCalled();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["character"] }, { throwOnError: true });
  expect(localStorage.length).toBe(0);
});
it("shows both POS payout and fee before confirmation", async () => {
  setup("pos");
  expect(await screen.findByText("₦2,100")).toBeInTheDocument();
  expect(screen.getByText("₦100")).toBeInTheDocument();
  expect(api.submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm POS withdrawal" }));
  await waitFor(() => expect(api.submit).toHaveBeenCalled());
  expect(api.submit.mock.calls[0]![0]).toMatchObject({
    serviceId: "pos-cashout",
    hair: null,
    hairColor: null,
    quote: { cash_price: 0, cash_payout: 2000, bank_fee: 100 },
  });
});
it("keeps the exact request across an unknown response and page remount", async () => {
  api.submit.mockRejectedValueOnce(new Error("offline"));
  const view = setup("pos");
  fireEvent.click(await screen.findByRole("button", { name: "Confirm POS withdrawal" }));
  const retry = await screen.findByRole("button", { name: "Retry service confirmation" });
  await waitFor(() => expect(retry).not.toBeDisabled());
  const first = api.submit.mock.calls[0]![0];
  view.unmount();
  setup("pos");
  fireEvent.click(await screen.findByRole("button", { name: "Retry service confirmation" }));
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(2));
  expect(api.submit.mock.calls[1]![0]).toEqual(first);
});
it("retains a pending request when the catalogue becomes unavailable", async () => {
  api.submit.mockRejectedValueOnce(new Error("offline"));
  const view = setup("pos");
  fireEvent.click(await screen.findByRole("button", { name: "Confirm POS withdrawal" }));
  await screen.findByRole("button", { name: "Retry service confirmation" });
  const first = api.submit.mock.calls[0]![0];
  view.unmount();
  api.catalogue.mockRejectedValue(new Error("unavailable"));
  setup("pos");
  fireEvent.click(await screen.findByRole("button", { name: "Retry service confirmation" }));
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(2));
  expect(api.submit.mock.calls[1]![0]).toEqual(first);
});
it("does not submit if a recovery receipt cannot be saved locally", async () => {
  setup("pos");
  const button = await screen.findByRole("button", { name: "Confirm POS withdrawal" });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage disabled");
  });
  fireEvent.click(button);
  await screen.findByText(/No service was submitted/);
  expect(api.submit).not.toHaveBeenCalled();
});

it("replays the original receipt if refreshing saved state fails after payment", async () => {
  const { client } = setup("pos"),
    invalidate = vi.spyOn(client, "invalidateQueries").mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm POS withdrawal" }));
  const retry = await screen.findByRole("button", { name: "Retry service confirmation" });
  await waitFor(() => expect(retry).not.toBeDisabled());
  expect(screen.getByText(/Your service is confirmed/)).toBeInTheDocument();
  const original = api.submit.mock.calls[0]![0];
  invalidate.mockRestore();
  fireEvent.click(retry);
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(2));
  expect(api.submit.mock.calls[1]![0]).toEqual(original);
});
