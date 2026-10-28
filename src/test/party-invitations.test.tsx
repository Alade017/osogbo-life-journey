import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { list, perform, search, success } = vi.hoisted(() => ({
  list: vi.fn(),
  perform: vi.fn(),
  search: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/lib/party-invitation-service", () => ({
  listPartyInvitations: list,
  performInvitation: perform,
  invitationKey: (id: string, event?: string) => ["partyInvitations", id, event ?? "inbox"],
}));
vi.mock("@/lib/player-social-service", () => ({ searchPlayerProfiles: search }));
vi.mock("sonner", () => ({ toast: { success } }));
import { HostPartyInvitations, PartyInvitations } from "@/components/game/PartyInvitations";
const user = "11111111-1111-4111-8111-111111111111",
  event = "22222222-2222-4222-8222-222222222222",
  target = "33333333-3333-4333-8333-333333333333",
  invite = "44444444-4444-4444-8444-444444444444";
const row = {
  id: invite,
  eventId: event,
  title: "Gathering",
  hostName: "Ade",
  recipientName: "Bisi",
  recipientCharacterId: target,
  venue: "Lantern Hall",
  startsAt: "2026-10-28T12:00:00Z",
  endsAt: "2026-10-28T15:00:00Z",
  status: "pending",
  phase: "live",
  isGuest: false,
  canRespond: true,
};
const page = (items = [row]) => ({ serverTime: "2026-10-28T12:00:00Z", items, nextCursor: null });
const wrap = (
  child: React.ReactNode,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  }),
) => <QueryClientProvider client={client}>{child}</QueryClientProvider>;
beforeEach(() => {
  list.mockReset().mockResolvedValue(page());
  perform.mockReset();
  search.mockReset().mockResolvedValue([{ character_id: target, player_name: "Bisi" }]);
  success.mockReset();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  onlineManager.setOnline(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});
it("opens host controls lazily, searches existing profiles, and sends once after confirmation", async () => {
  list.mockResolvedValue(page([]));
  let confirm!: (value: unknown) => void;
  perform.mockImplementation(
    () =>
      new Promise((resolve) => {
        confirm = resolve;
      }),
  );
  render(wrap(<HostPartyInvitations accountId={user} eventId={event} />));
  expect(list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Invite players and view guests" }));
  fireEvent.change(screen.getByLabelText("Find a player"), { target: { value: "Bisi" } });
  fireEvent.click(screen.getByRole("button", { name: "Find players" }));
  const inviteButton = await screen.findByRole("button", { name: "Invite Bisi" });
  act(() => {
    fireEvent.click(inviteButton);
    fireEvent.click(inviteButton);
  });
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
  expect(success).not.toHaveBeenCalled();
  expect(screen.getByText("Confirming invitation…")).toBeInTheDocument();
  list.mockResolvedValue(page([{ ...row, canRespond: false }]));
  await act(async () => confirm({ status: "pending", duplicate: false, isNew: true }));
  expect(await screen.findByText("Player: Bisi")).toBeInTheDocument();
  expect(success).toHaveBeenCalledWith("Invitation sent.");
});
it("retries the same player search after a lookup error", async () => {
  list.mockResolvedValue(page([]));
  search
    .mockRejectedValueOnce(new Error("Lookup failed"))
    .mockResolvedValueOnce([{ character_id: target, player_name: "Bisi" }]);
  render(wrap(<PartyInvitations accountId={user} eventId={event} />));
  fireEvent.change(screen.getByLabelText("Find a player"), { target: { value: "Bisi" } });
  fireEvent.click(screen.getByRole("button", { name: "Find players" }));
  expect(
    await screen.findByText("Players could not load. Search again to retry."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Find players" }));
  expect(await screen.findByRole("button", { name: "Invite Bisi" })).toBeInTheDocument();
  expect(search).toHaveBeenCalledTimes(2);
});
it("loads another bounded invitation page without replacing the first", async () => {
  list.mockResolvedValueOnce({ ...page(), nextCursor: invite }).mockResolvedValue({
    ...page([{ ...row, id: "77777777-7777-4777-8777-777777777777", title: "Second gathering" }]),
  });
  render(wrap(<PartyInvitations accountId={user} />));
  fireEvent.click(await screen.findByRole("button", { name: "Load more invitations" }));
  expect(await screen.findByText("Second gathering")).toBeInTheDocument();
  expect(screen.getByText("Gathering")).toBeInTheDocument();
  expect(list).toHaveBeenLastCalledWith(user, undefined, invite);
});
it("retains the UUID on uncertain delivery and retries the exact recipient decision", async () => {
  perform.mockRejectedValueOnce(new Error("Unconfirmed")).mockImplementation(async () => {
    list.mockResolvedValue(
      page([{ ...row, status: "accepted", isGuest: true, canRespond: false }]),
    );
    return { status: "accepted", duplicate: true };
  });
  render(wrap(<PartyInvitations accountId={user} />));
  fireEvent.click(await screen.findByRole("button", { name: "Accept Gathering" }));
  const retry = await screen.findByRole("button", { name: "Retry confirmation" });
  fireEvent.click(retry);
  expect(await screen.findByText("Confirmed guest · live")).toBeInTheDocument();
  expect(perform).toHaveBeenCalledTimes(2);
  expect(perform.mock.calls[0]).toEqual(perform.mock.calls[1]);
  expect(success).not.toHaveBeenCalled();
});
it("keeps a confirmed acceptance visible when the subsequent list refresh fails", async () => {
  perform.mockImplementation(async () => {
    list.mockRejectedValue(new Error("List refresh unavailable"));
    return {
      invitationId: invite,
      eventId: event,
      status: "accepted",
      duplicate: false,
      isNew: false,
    };
  });
  render(wrap(<PartyInvitations accountId={user} />));
  fireEvent.click(await screen.findByRole("button", { name: "Accept Gathering" }));
  expect(await screen.findByText("Confirmed guest · live")).toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("List refresh unavailable");
  expect(screen.queryByRole("button", { name: "Decline Gathering" })).not.toBeInTheDocument();
});
it("recovers committed acceptance from the server snapshot without duplicate success or stale error", async () => {
  perform.mockImplementation(async () => {
    list.mockResolvedValue(
      page([{ ...row, status: "accepted", isGuest: true, canRespond: false }]),
    );
    throw new Error("Response lost");
  });
  render(wrap(<PartyInvitations accountId={user} />));
  fireEvent.click(await screen.findByRole("button", { name: "Accept Gathering" }));
  expect(await screen.findByText("Confirmed guest · live")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(success).not.toHaveBeenCalled();
});
it("disables decisions offline and does not enqueue them", async () => {
  render(wrap(<PartyInvitations accountId={user} />));
  const accept = await screen.findByRole("button", { name: "Accept Gathering" });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  act(() => window.dispatchEvent(new Event("offline")));
  expect(accept).toBeDisabled();
  fireEvent.click(accept);
  expect(perform).not.toHaveBeenCalled();
  expect(screen.getByText(/nothing will be queued/i)).toBeInTheDocument();
});
it("shows expired/cancelled state without accepting and isolates migration errors", async () => {
  list.mockResolvedValueOnce(page([{ ...row, phase: "cancelled", canRespond: false }]));
  const view = render(wrap(<PartyInvitations accountId={user} />));
  expect(await screen.findByText("pending · cancelled")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept Gathering" })).not.toBeInTheDocument();
  view.unmount();
  list.mockRejectedValue(new Error("Invitations unavailable; party activities remain usable"));
  render(wrap(<PartyInvitations accountId={user} />));
  expect(await screen.findByRole("alert")).toHaveTextContent("party activities remain usable");
});
it("suppresses late success after unmount and clears previous account rows on a new mount", async () => {
  let resolve!: (value: unknown) => void;
  perform.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = render(wrap(<PartyInvitations accountId={user} />));
  fireEvent.click(await screen.findByRole("button", { name: "Accept Gathering" }));
  await waitFor(() => expect(perform).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => resolve({ status: "accepted", duplicate: false }));
  expect(success).not.toHaveBeenCalled();
  list.mockImplementation(() => new Promise(() => {}));
  render(wrap(<PartyInvitations key={target} accountId={target} />));
  expect(screen.queryByText("Host: Ade")).not.toBeInTheDocument();
});
