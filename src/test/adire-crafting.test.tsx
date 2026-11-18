import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdireCraftingPanel } from "@/components/game/AdireCraftingPanel";
import { craftingStateSchema, craftSecondsLeft } from "@/lib/adire-crafting";
const api = vi.hoisted(() => ({
  fetch: vi.fn(),
  start: vi.fn(),
  collect: vi.fn(),
  busy: vi.fn(),
  shop: vi.fn(),
}));
vi.mock("@/lib/adire-crafting", async (original) => ({
  ...(await original<typeof import("@/lib/adire-crafting")>()),
  fetchCrafting: api.fetch,
  startCrafting: api.start,
  collectCrafting: api.collect,
}));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({ queryKey: ["character"], queryFn: async () => ({ id: "player" }) }),
    inventory: () => ({ queryKey: ["inventory"] }),
  },
}));
const jobId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";
const quote = {
  duration_seconds: 90,
  output_item_id: itemId,
  output_quantity: 1,
  materials: [{ item_id: itemId, quantity: 2 }],
};
const recipe = {
  id: "adire-wrapper",
  name: "Dye an Adire wrapper",
  zone_id: "zone-adire-vats",
  station_name: "Indigo dye vats",
  duration_seconds: 90,
  output_name: "Indigo Adire wrapper",
  output_quantity: 1,
  quote,
  available: true,
  materials: [{ name: "Plain cotton", quantity: 2, owned: 4 }],
};
const now = "2026-11-18T12:00:00.000Z";
const state = { server_now: now, recipes: [recipe], jobs: [] };
const job = {
  id: jobId,
  request_id: requestId,
  name: recipe.name,
  zone_id: recipe.zone_id,
  station_name: recipe.station_name,
  started_at: "2026-11-18T11:58:00Z",
  ready_at: now,
  claimed_at: null,
  output_name: recipe.output_name,
  output_quantity: 1,
};
const clients: QueryClient[] = [];
function setup(zone = "zone-adire-vats") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <AdireCraftingPanel zoneId={zone} onBusyChange={api.busy} onBuyMaterials={api.shop} />
      </QueryClientProvider>,
    ),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.fetch.mockResolvedValue(state);
  api.start.mockResolvedValue({ ok: true, job_id: jobId });
  api.collect.mockResolvedValue({ ok: true, job_id: jobId });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  vi.restoreAllMocks();
});
it("shows ingredient requirements and prevents starting with missing materials", async () => {
  api.fetch.mockResolvedValue({
    ...state,
    recipes: [{ ...recipe, materials: [{ name: "Plain cotton", quantity: 2, owned: 1 }] }],
  });
  setup();
  expect(await screen.findByText("Plain cotton: 2 required · 1 owned")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start Dye/ })).toBeDisabled();
  expect(api.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Buy materials / sell finished pieces" }));
  expect(api.shop).toHaveBeenCalledOnce();
});
it("persists the quoted request before submitting and blocks overlapping clicks", async () => {
  let resolve!: (value: unknown) => void;
  api.start.mockImplementation((intent) => {
    expect(JSON.parse(localStorage.getItem("osun:adire-start:player")!)).toEqual(intent);
    return new Promise((r) => {
      resolve = r;
    });
  });
  const { client } = setup(),
    invalidate = vi.spyOn(client, "invalidateQueries");
  const button = await screen.findByRole("button", { name: /Start Dye/ });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(api.start).toHaveBeenCalledOnce();
  expect(api.start.mock.calls[0]![0]).toMatchObject({
    recipeId: recipe.id,
    quote,
    requestId: expect.any(String),
  });
  resolve({ ok: true, job_id: jobId });
  await screen.findByText(/Craft started/);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["inventory"] }, { throwOnError: true });
  expect(localStorage.length).toBe(0);
});
it("keeps the same request after a lost response and recovers it across remount with an unavailable catalogue", async () => {
  api.start.mockRejectedValueOnce(new Error("offline"));
  const view = setup();
  fireEvent.click(await screen.findByRole("button", { name: /Start Dye/ }));
  const retry = await screen.findByRole("button", { name: "Retry craft confirmation" });
  await waitFor(() => expect(retry).not.toBeDisabled());
  const first = api.start.mock.calls[0]![0];
  view.unmount();
  api.fetch.mockRejectedValue(new Error("offline"));
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Retry craft confirmation" }));
  await waitFor(() => expect(api.start).toHaveBeenCalledTimes(2));
  expect(api.start.mock.calls[1]![0]).toEqual(first);
});
it("does not submit when durable browser storage is unavailable", async () => {
  setup();
  const button = await screen.findByRole("button", { name: /Start Dye/ });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("unavailable");
  });
  fireEvent.click(button);
  await screen.findByText(/No materials were consumed/);
  expect(api.start).not.toHaveBeenCalled();
});
it("waits for the server timestamp and requires returning to the original station", async () => {
  api.fetch.mockResolvedValue({ ...state, jobs: [{ ...job, ready_at: "2026-11-18T12:01:30Z" }] });
  const view = setup();
  expect(
    await screen.findByRole("button", { name: "Collect Indigo Adire wrapper" }),
  ).toBeDisabled();
  expect(api.collect).not.toHaveBeenCalled();
  view.unmount();
  api.fetch.mockResolvedValue({ ...state, jobs: [job] });
  setup("zone-adire-racks");
  await screen.findByText("Return to Indigo dye vats to collect.");
  expect(screen.queryByRole("button", { name: /Collect Indigo/ })).not.toBeInTheDocument();
});
it("retries collection using the same saved job after an uncertain response", async () => {
  api.fetch.mockResolvedValue({ ...state, jobs: [job] });
  api.collect.mockRejectedValueOnce(new Error("offline"));
  setup();
  fireEvent.click(await screen.findByRole("button", { name: /Collect Indigo/ }));
  await screen.findByText(/Retry the same request/);
  const button = screen.getByRole("button", { name: /Collect Indigo/ });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  await screen.findByText(/Finished item collected/);
  expect(api.collect.mock.calls).toEqual([
    [jobId, "zone-adire-vats"],
    [jobId, "zone-adire-vats"],
  ]);
});
it("clears a recovered start request when the catalogue contains its saved receipt", async () => {
  localStorage.setItem(
    "osun:adire-start:player",
    JSON.stringify({ recipeId: recipe.id, requestId, quote }),
  );
  api.fetch.mockResolvedValue({ ...state, jobs: [job] });
  setup();
  await screen.findByRole("button", { name: /Collect Indigo/ });
  await waitFor(() => expect(localStorage.length).toBe(0));
  expect(api.start).not.toHaveBeenCalled();
});
it("rejects malformed authoritative data and estimates time relative to the server sample", () => {
  expect(craftingStateSchema.safeParse({ ...state, server_now: "bad" }).success).toBe(false);
  expect(craftSecondsLeft("2026-11-18T12:01:30Z", now, 2000)).toBe(88);
  expect(craftSecondsLeft(now, now, 4000)).toBe(0);
});
