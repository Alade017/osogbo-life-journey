import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WhotView } from "@/lib/mini-games/whot-table-client";

const fetchWhotView = vi.fn<(id: string) => Promise<WhotView>>();
const sendWhotAction = vi.fn<(id: string, body: unknown) => Promise<void>>();

vi.mock("@/lib/mini-games/whot-table-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mini-games/whot-table-client")>(
    "@/lib/mini-games/whot-table-client",
  );
  return {
    ...actual,
    fetchWhotView: (id: string) => fetchWhotView(id),
    sendWhotAction: (id: string, body: unknown) => sendWhotAction(id, body),
  };
});

import { WhotTableView, type WhotTableRow } from "@/components/game/mini-games/WhotTableView";

const table: WhotTableRow = {
  stake: 200,
  pot: 400,
  status: "playing",
  result: null,
  winner_character_id: null,
  fee_percent: 5,
};

function started(overrides: Partial<Extract<WhotView, { started: true }>> = {}): WhotView {
  return {
    started: true,
    status: "playing",
    version: 3,
    my_seat: 1,
    turn_seat: 1,
    shape: "circle",
    top: { id: "d", shape: "circle", rank: 5 },
    discard_count: 4,
    stock_count: 30,
    pending_draw: 0,
    pending_rank: null,
    winner_seat: null,
    my_hand: [
      { id: "m1", shape: "star", rank: 9 },
      { id: "m2", shape: "circle", rank: 3 },
      { id: "m3", shape: "cross", rank: 12 },
    ],
    opponent_count: 7,
    ...overrides,
  };
}

function renderView(view: WhotView, overrides: Partial<Parameters<typeof WhotTableView>[0]> = {}) {
  fetchWhotView.mockResolvedValue(view);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WhotTableView
        tableId="t1"
        table={table}
        characterId="me"
        seated
        canClaim={false}
        onLeave={vi.fn()}
        leavePending={false}
        onClaim={vi.fn()}
        claimPending={false}
        onExit={vi.fn()}
        {...overrides}
      />
    </QueryClientProvider>,
  );
}

describe("WhotTableView", () => {
  beforeEach(() => {
    fetchWhotView.mockReset();
    sendWhotAction.mockReset();
    sendWhotAction.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it("shows the opponent as a card count and the own hand on a table layout", async () => {
    renderView(started());
    expect(await screen.findByText("7 cards")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Whot stake table" })).toBeInTheDocument();
    const hand = screen.getByRole("list", { name: "Your cards" });
    expect(within(hand).getAllByRole("button")).toHaveLength(3);
  });

  it("only lets the player tap cards that match the discard on their turn", async () => {
    renderView(started());
    const hand = await screen.findByRole("list", { name: "Your cards" });
    const buttons = within(hand).getAllByRole("button");
    // Top is circle 5: the circle 3 matches by shape, the star 9 and cross 12 do not.
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeEnabled();
    expect(buttons[2]).toBeDisabled();
  });

  it("disables all cards when it is not the player's turn", async () => {
    renderView(started({ turn_seat: 2 }));
    const hand = await screen.findByRole("list", { name: "Your cards" });
    for (const button of within(hand).getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Your opponent is playing.");
  });

  it("sends a play action for a matching card", async () => {
    renderView(started());
    const hand = await screen.findByRole("list", { name: "Your cards" });
    fireEvent.click(within(hand).getAllByRole("button")[1]!);
    await waitFor(() =>
      expect(sendWhotAction).toHaveBeenCalledWith("t1", { action: "play", cardId: "m2" }),
    );
  });

  it("asks for a shape before playing a Whot card", async () => {
    renderView(
      started({
        my_hand: [{ id: "w", shape: null, rank: 20 }],
        top: { id: "d", shape: "circle", rank: 5 },
      }),
    );
    const hand = await screen.findByRole("list", { name: "Your cards" });
    fireEvent.click(within(hand).getByRole("button", { name: "Whot card" }));
    const sheet = screen.getByRole("dialog", { name: "Choose the next shape" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Star" }));
    await waitFor(() =>
      expect(sendWhotAction).toHaveBeenCalledWith("t1", {
        action: "play",
        cardId: "w",
        shape: "star",
      }),
    );
  });

  it("offers a draw when nothing in hand can be played", async () => {
    renderView(
      started({
        my_hand: [{ id: "m3", shape: "cross", rank: 12 }],
      }),
    );
    const draw = await screen.findByRole("button", { name: "Draw a card" });
    fireEvent.click(draw);
    await waitFor(() => expect(sendWhotAction).toHaveBeenCalledWith("t1", { action: "draw" }));
  });

  it("explains a waiting table and offers a refund-leave while open", async () => {
    const onLeave = vi.fn();
    renderView(
      { started: false, status: "open", version: 0, my_seat: 1 },
      { table: { ...table, status: "open" }, onLeave },
    );
    expect(
      await screen.findByText("Waiting for an opponent. Leave any time for a full refund."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave and get my stake back" }));
    expect(onLeave).toHaveBeenCalled();
  });
});
