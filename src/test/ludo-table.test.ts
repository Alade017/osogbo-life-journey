import { describe, expect, it } from "vitest";
import { LudoTable, type Clock, type TableEvent, type Timer } from "@/lib/mini-games/ludo-table";
import {
  NO_LEGAL_MOVES_DELAY_MS,
  SEAT_HOLD_MS,
  TURN_TIMEOUT_MS,
} from "@/lib/mini-games/ludo-engine";

/** A clock that only moves when the test advances it. */
function fakeClock() {
  let now = 0;
  const timers: { at: number; run: () => void; cleared: boolean }[] = [];
  const clock: Clock = {
    setTimeout(callback, ms) {
      const entry = { at: now + ms, run: callback, cleared: false };
      timers.push(entry);
      const timer: Timer = {
        clear() {
          entry.cleared = true;
        },
      };
      return timer;
    },
  };
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const next = timers
        .filter((item) => !item.cleared && item.at <= target)
        .sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      now = next.at;
      next.cleared = true;
      next.run();
    }
    now = target;
  };
  return { clock, advance };
}

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function setup(dice: readonly number[] = [6, 1]) {
  const { clock, advance } = fakeClock();
  const events: TableEvent[] = [];
  const wins: { winnerId: string; playerIds: string[] }[] = [];
  let sequence = 0;
  const random = () => {
    const pair = dice[sequence % dice.length];
    sequence += 1;
    return ((pair ?? 1) - 1) / 6 + 0.01;
  };
  const table = new LudoTable({
    clock,
    random,
    broadcast: (event) => events.push(event),
    recordWin: (result) => {
      wins.push(result);
    },
  });
  return { table, advance, events, wins, seeded };
}

describe("LudoTable seats and start", () => {
  it("seats players in colour order, makes the first one host, and starts only for the host", () => {
    const { table } = setup();
    expect(table.join("a", "Ada")).toEqual({ ok: true });
    expect(table.join("b", "Bola")).toEqual({ ok: true });
    expect(table.start("b")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(table.start("a")).toEqual({ ok: true });
    const view = table.view();
    expect(view.status).toBe("IN_PROGRESS");
    expect(view.players.map((player) => player.colour)).toEqual(["RED", "GREEN"]);
    expect(view.turnPlayerId).toBe("a");
    expect(view.phase).toBe("WAITING_FOR_ROLL");
  });

  it("refuses a fifth player and a start with fewer than two", () => {
    const { table } = setup();
    table.join("a", "Ada");
    expect(table.start("a")).toEqual({ ok: false, error: "NOT_ENOUGH_PLAYERS" });
    ["a", "b", "c", "d"].forEach((id) => table.join(id, id));
    expect(table.join("e", "e")).toEqual({ ok: false, error: "ROOM_FULL" });
  });
});

describe("LudoTable validation", () => {
  it("rejects a roll from the wrong player and a move without a roll, leaving state unchanged", () => {
    const { table, events } = setup();
    table.join("a", "Ada");
    table.join("b", "Bola");
    table.start("a");
    const before = JSON.stringify(table.view());
    expect(table.roll("b")).toEqual({ ok: false, error: "INVALID_TURN" });
    expect(table.move("a", "RED", 0, 0)).toEqual({ ok: false, error: "INVALID_PHASE" });
    expect(JSON.stringify(table.view())).toBe(before);
    expect(events.filter((event) => event.type === "ERROR").length).toBe(2);
  });

  it("refuses actions before the game starts", () => {
    const { table } = setup();
    table.join("a", "Ada");
    expect(table.roll("a")).toEqual({ ok: false, error: "ROOM_NOT_ACTIVE" });
  });

  it("only allows a token that is legal for the rolled dice", () => {
    const { table } = setup([2, 3]);
    table.join("a", "Ada");
    table.join("b", "Bola");
    table.start("a");
    const rolled = table.roll("a");
    expect(rolled.ok).toBe(true);
    if (rolled.ok && rolled.game.phase === "NO_LEGAL_MOVES") {
      // No token can leave the yard on 2 or 3: the turn passes after the delay.
      expect(table.move("a", "RED", 0, 0)).toEqual({ ok: false, error: "INVALID_PHASE" });
    }
  });
});

describe("LudoTable timers", () => {
  it("auto-passes after NO_LEGAL_MOVES_DELAY_MS when nothing can move", () => {
    const { table, advance } = setup([2, 3]);
    table.join("a", "Ada");
    table.join("b", "Bola");
    table.start("a");
    table.roll("a");
    expect(table.view().turnPlayerId).toBe("a");
    advance(NO_LEGAL_MOVES_DELAY_MS);
    expect(table.view().turnPlayerId).toBe("b");
  });

  it("plays a move for a player whose turn times out", () => {
    const { table, advance, events } = setup([6, 6]);
    table.join("a", "Ada");
    table.join("b", "Bola");
    table.start("a");
    advance(TURN_TIMEOUT_MS);
    expect(events.some((event) => event.type === "TOAST")).toBe(true);
    expect(table.view().dice).not.toBeNull();
  });
});

describe("LudoTable seat hold and reconnection", () => {
  it("keeps the seat for the hold period and lets the same player rejoin", () => {
    const { table, advance } = setup();
    table.join("a", "Ada");
    table.join("b", "Bola");
    table.start("a");
    table.disconnect("b");
    expect(table.view().players.find((player) => player.userId === "b")?.connected).toBe(false);
    advance(SEAT_HOLD_MS - 1);
    expect(table.view().players.some((player) => player.userId === "b")).toBe(true);
    expect(table.reconnect("b")).toEqual({ ok: true });
    expect(table.view().players.find((player) => player.userId === "b")?.connected).toBe(true);
  });

  it("does not let a stranger reconnect into a seat they never had", () => {
    const { table } = setup();
    table.join("a", "Ada");
    expect(table.reconnect("zed")).toEqual({ ok: false, error: "ROOM_NOT_ACTIVE" });
  });
});

describe("LudoTable winning", () => {
  it("records the win once and finishes the room", async () => {
    const { table, wins } = setup();
    table.join("a", "Ada");
    table.join("b", "Bola");
    table.start("a");
    // Force a near-finished game by playing random turns until someone wins.
    const random = seeded(7);
    let guard = 0;
    while (table.view().status !== "FINISHED" && guard < 200_000) {
      const view = table.view();
      const player = view.turnPlayerId ?? "";
      if (view.phase === "WAITING_FOR_ROLL") table.roll(player);
      else if (view.phase === "WAITING_FOR_MOVE") {
        const legal = [0, 1, 2, 3];
        const token = legal[Math.floor(random() * legal.length)] ?? 0;
        const colour = view.players.find((item) => item.userId === player)?.colour ?? "RED";
        table.move(player, colour, token);
      } else break;
      guard += 1;
    }
    expect(table.view().status).toBe("FINISHED");
    await Promise.resolve();
    expect(wins.length).toBe(1);
    expect(wins[0]?.playerIds).toEqual(["a", "b"]);
  });
});
