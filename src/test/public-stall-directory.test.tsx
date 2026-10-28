import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { getPublicStalls } = vi.hoisted(() => ({ getPublicStalls: vi.fn() }));
vi.mock("@/lib/public-stall-service", () => ({
  getPublicStalls,
  publicStallKey: (id: string) => ["publicPlayerStalls", id],
}));
import { PublicStallDirectory } from "@/components/game/phone/PublicStallDirectory";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const row = { id: a, ownerName: "Bisi", name: "Bisi's beads", goods: "Handmade beads" };
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const wrap = (id = a, c = client()) => (
  <QueryClientProvider client={c}>
    <PublicStallDirectory key={id} accountId={id} />
  </QueryClientProvider>
);
beforeEach(() => {
  getPublicStalls.mockReset().mockResolvedValue({ items: [row], nextCursor: null });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  onlineManager.setOnline(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});
it("renders read-only signs and loads another page without owner actions", async () => {
  getPublicStalls
    .mockResolvedValueOnce({ items: [row], nextCursor: a })
    .mockResolvedValue({ items: [{ ...row, id: b, name: "Craft corner" }], nextCursor: null });
  render(wrap());
  expect(await screen.findByText("Bisi's beads")).toBeInTheDocument();
  expect(screen.getByText("Owner: Bisi")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /save|claim|buy|open|close/i }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load more stalls" }));
  expect(await screen.findByText("Craft corner")).toBeInTheDocument();
  expect(getPublicStalls).toHaveBeenLastCalledWith(a, a);
});
it("shows empty listings and error/retry states", async () => {
  getPublicStalls
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValue({ items: [], nextCursor: null });
  render(wrap());
  expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry stalls" }));
  expect(await screen.findByText("No other player stalls are open right now.")).toBeInTheDocument();
});
it("retains cached listings offline and disables requests", async () => {
  render(wrap());
  await screen.findByText("Bisi's beads");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  act(() => window.dispatchEvent(new Event("offline")));
  expect(screen.getByRole("status")).toHaveTextContent("cached listings");
  expect(screen.getByRole("button", { name: "Refresh stalls" })).toBeDisabled();
  expect(getPublicStalls).toHaveBeenCalledTimes(1);
});
it("does not show another account's cached page while the new query loads", async () => {
  const c = client();
  const view = render(wrap(a, c));
  await screen.findByText("Bisi's beads");
  getPublicStalls.mockImplementation(() => new Promise(() => {}));
  view.rerender(wrap(b, c));
  expect(screen.queryByText("Bisi's beads")).not.toBeInTheDocument();
  await waitFor(() => expect(getPublicStalls).toHaveBeenLastCalledWith(b, null));
});
it("does not poll while hidden and refreshes after becoming visible", async () => {
  const visible = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  render(wrap());
  expect(getPublicStalls).not.toHaveBeenCalled();
  visible.mockReturnValue("visible");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(await screen.findByText("Bisi's beads")).toBeInTheDocument();
});
