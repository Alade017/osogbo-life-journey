import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Coins, Gamepad2, Users } from "lucide-react";
import { formatNaira, q } from "@/lib/game";
import { WhotTableView } from "@/components/game/mini-games/WhotTableView";

/** Stake choices in whole Naira. The server enforces the same range (100 to 5,000). */
const STAKES = [100, 250, 500, 1000, 2500, 5000] as const;
/** A player away for longer than this can be forfeited by the other player. */
const IDLE_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 20_000;
const REFRESH_MS = 3_000;
type GameKind = "tictactoe" | "whot";
const GAME_LABELS: Record<GameKind, string> = { tictactoe: "Tic-Tac-Toe", whot: "Whot" };
const gameLabel = (game: string) => GAME_LABELS[game as GameKind] ?? "Stake game";

type OpenTable = {
  id: string;
  game: string;
  stake: number;
  pot: number;
  created_at: string;
  host_character_id: string;
};
type TableRow = {
  id: string;
  game: string;
  stake: number;
  pot: number;
  status: string;
  result: string | null;
  winner_character_id: string | null;
  host_character_id: string;
  fee_percent: number;
};
type SeatRow = { character_id: string; seat: number; paid: number; last_active_at: string };
type BoardRow = { cells: string; turn: number; version: number };

function messageOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Something went wrong. Try again.";
}

/** Two players stake cash on a table. The lobby lists open tables; a table opens when a second player joins. */
export function StakeTables() {
  const wallet = useQuery(q.wallet());
  const [tableId, setTableId] = useState<string | null>(null);
  const characterId = wallet.data?.character_id ?? null;
  const balance = wallet.data?.balance ?? 0;
  if (tableId && characterId) {
    return (
      <StakeTableView tableId={tableId} characterId={characterId} onExit={() => setTableId(null)} />
    );
  }
  return <StakeLobby characterId={characterId} balance={balance} onOpen={setTableId} />;
}

function StakeLobby({
  characterId,
  balance,
  onOpen,
}: {
  characterId: string | null;
  balance: number;
  onOpen: (tableId: string) => void;
}) {
  const client = useQueryClient();
  const [stake, setStake] = useState<number>(STAKES[0]);
  const [game, setGame] = useState<GameKind>("tictactoe");
  const tables = useQuery({
    queryKey: ["miniGame", "open"],
    queryFn: async (): Promise<OpenTable[]> => {
      const { data, error } = await supabase
        .from("mini_game_tables")
        .select("id,game,stake,pot,created_at,host_character_id")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: REFRESH_MS,
  });
  const refreshAfterChange = () => {
    void client.invalidateQueries({ queryKey: ["miniGame"] });
    void client.invalidateQueries({ queryKey: q.wallet().queryKey });
    void client.invalidateQueries({ queryKey: q.transactions().queryKey });
  };
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } =
        game === "whot"
          ? await supabase.rpc("mini_game_create_whot_table", { p_stake: stake })
          : await supabase.rpc("mini_game_create_table", { p_stake: stake });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      refreshAfterChange();
      toast.success("Table opened. Waiting for an opponent.");
      onOpen(id);
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });
  const join = useMutation({
    mutationFn: async (table: string) => {
      const { data, error } = await supabase.rpc("mini_game_join_table", { p_table: table });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      refreshAfterChange();
      onOpen(id);
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });
  const canAfford = (amount: number) => balance >= amount;

  return (
    <div className="mg-stakes">
      <div className="mg-stake-intro">
        <span className="mg-stake-intro-icon" aria-hidden="true">
          <Coins size={20} />
        </span>
        <div>
          <h2>Play for stakes</h2>
          <p>Choose a game, set your stake, and challenge another player.</p>
        </div>
      </div>
      <section className="mg-stake-create" aria-labelledby="mg-stake-create-title">
        <div className="mg-stake-section-head">
          <div>
            <span className="mg-stake-eyebrow">New match</span>
            <h3 id="mg-stake-create-title">Open a table</h3>
          </div>
          <span className="mg-stake-balance">Cash {formatNaira(balance)}</span>
        </div>
        <div className="mg-stake-fields">
          <label className="mg-stake-field">
            <span>
              <Gamepad2 size={15} aria-hidden="true" /> Game
            </span>
            <select
              value={game}
              onChange={(event) => setGame(event.target.value as GameKind)}
              aria-label="Game"
            >
              {(Object.entries(GAME_LABELS) as [GameKind, string][]).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="mg-stake-field">
            <span>
              <Coins size={15} aria-hidden="true" /> Your stake
            </span>
            <select
              value={stake}
              onChange={(event) => setStake(Number(event.target.value))}
              aria-label="Stake amount"
            >
              {STAKES.map((amount) => (
                <option key={amount} value={amount}>
                  {formatNaira(amount)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button
          className="mg-stake-create-button"
          disabled={!characterId || create.isPending || !canAfford(stake)}
          onClick={() => create.mutate()}
        >
          {canAfford(stake) ? (
            <>
              Open table for {formatNaira(stake)} <ArrowRight size={16} aria-hidden="true" />
            </>
          ) : (
            "Not enough cash"
          )}
        </Button>
        <p className="mg-stake-rules">
          Your opponent matches your stake. Draws refund both players; wins pay out after the table
          fee.
        </p>
      </section>

      <section className="mg-stake-list" aria-labelledby="mg-stake-list-title">
        <div className="mg-stake-section-head">
          <div>
            <span className="mg-stake-eyebrow">Join a match</span>
            <h3 id="mg-stake-list-title">Open tables</h3>
          </div>
          {tables.data && (
            <span className="mg-stake-count" aria-label={`${tables.data.length} open tables`}>
              {tables.data.length}
            </span>
          )}
        </div>
        {tables.isLoading && (
          <p className="mg-stake-empty" role="status">
            Loading open tables…
          </p>
        )}
        {tables.isError && (
          <p className="mg-stake-empty" role="alert">
            Tables are unavailable. Try again.
          </p>
        )}
        {tables.data?.length === 0 && (
          <div className="mg-stake-empty">
            <Users size={22} aria-hidden="true" />
            <strong>No open tables yet</strong>
            <span>Open a table above and wait for another player to join.</span>
          </div>
        )}
        <ul className="mg-list mg-stake-table-list">
          {tables.data?.map((table) => {
            const mine = table.host_character_id === characterId;
            return (
              <li key={table.id}>
                <div className="mg-stake-table-card">
                  <div className="mg-stake-table-info">
                    <span className="mg-stake-game">{gameLabel(table.game)}</span>
                    <strong>
                      {formatNaira(table.stake)} <span>stake</span>
                    </strong>
                    <small>Pot {formatNaira(table.pot)}</small>
                  </div>
                  <Button
                    className="mg-stake-join-button"
                    disabled={mine || join.isPending || !canAfford(table.stake)}
                    onClick={() => join.mutate(table.id)}
                  >
                    {mine ? "Your table" : canAfford(table.stake) ? "Join" : "Not enough cash"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function StakeTableView({
  tableId,
  characterId,
  onExit,
}: {
  tableId: string;
  characterId: string;
  onExit: () => void;
}) {
  const client = useQueryClient();
  const state = useQuery({
    queryKey: ["miniGame", "table", tableId],
    queryFn: async () => {
      const [table, seats, board] = await Promise.all([
        supabase
          .from("mini_game_tables")
          .select(
            "id,game,stake,pot,status,result,winner_character_id,host_character_id,fee_percent",
          )
          .eq("id", tableId)
          .maybeSingle(),
        supabase
          .from("mini_game_seats")
          .select("character_id,seat,paid,last_active_at")
          .eq("table_id", tableId),
        supabase
          .from("mini_game_boards")
          .select("cells,turn,version")
          .eq("table_id", tableId)
          .maybeSingle(),
      ]);
      if (table.error) throw table.error;
      if (seats.error) throw seats.error;
      if (board.error) throw board.error;
      if (!table.data) throw new Error("This table no longer exists.");
      return {
        table: table.data as TableRow,
        seats: (seats.data ?? []) as SeatRow[],
        board: (board.data ?? null) as BoardRow | null,
      };
    },
    refetchInterval: REFRESH_MS,
  });

  const data = state.data;
  const tableStatus = data?.table.status ?? null;
  const me = data?.seats.find((seat) => seat.character_id === characterId) ?? null;
  const opponent = data?.seats.find((seat) => seat.character_id !== characterId) ?? null;
  const seated = me !== null;

  // Seated players keep their presence fresh so the other player cannot forfeit them by mistake.
  useEffect(() => {
    if (!seated || (tableStatus !== "open" && tableStatus !== "playing")) return;
    const beat = () => void supabase.rpc("mini_game_heartbeat", { p_table: tableId });
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [seated, tableStatus, tableId]);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["miniGame"] });
    void client.invalidateQueries({ queryKey: q.wallet().queryKey });
    void client.invalidateQueries({ queryKey: q.transactions().queryKey });
  };
  const move = useMutation({
    mutationFn: async (cell: number) => {
      const { error } = await supabase.rpc("mini_game_play_move", {
        p_table: tableId,
        p_cell: cell,
      });
      if (error) throw error;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ["miniGame", "table", tableId] }),
    onError: (error: unknown) => toast.error(messageOf(error)),
  });
  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mini_game_leave_table", { p_table: tableId });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("You left the table. Your stake is back in your cash.");
      onExit();
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });
  const claim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mini_game_claim_forfeit", { p_table: tableId });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("You claimed the pot. Your opponent was away too long.");
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });

  if (state.isLoading) return <p className="mg-status">Loading table…</p>;
  if (state.isError || !data) {
    return (
      <div className="mg-stakes">
        <p className="mg-status" role="alert">
          {messageOf(state.error)}
        </p>
        <Button onClick={onExit}>Back to tables</Button>
      </div>
    );
  }

  const { table, board } = data;
  const finished = table.status === "finished" || table.status === "cancelled";
  const payout = table.pot - Math.floor((table.pot * table.fee_percent) / 100);
  const myTurn = table.status === "playing" && !!board && !!me && board.turn === me.seat;
  const opponentIdle =
    !!opponent && Date.now() - new Date(opponent.last_active_at).getTime() > IDLE_MS;
  const canClaim = seated && table.status === "playing" && !!opponent && opponentIdle;

  if (table.game === "whot") {
    return (
      <WhotTableView
        tableId={tableId}
        table={table}
        characterId={characterId}
        seated={seated}
        canClaim={canClaim}
        onLeave={() => leave.mutate()}
        leavePending={leave.isPending}
        onClaim={() => claim.mutate()}
        claimPending={claim.isPending}
        onExit={onExit}
      />
    );
  }

  const status = (() => {
    if (table.status === "cancelled")
      return "This table was cancelled and your stake was refunded.";
    if (table.status === "finished") {
      if (table.result === "draw") return "It's a draw. Both stakes have been refunded.";
      if (table.winner_character_id === characterId) return `You won ${formatNaira(payout)}.`;
      if (table.result === "forfeit") return "You were forfeited after being away for 2 minutes.";
      return "Your opponent won this table.";
    }
    if (table.status === "open")
      return "Waiting for an opponent. Leave any time for a full refund.";
    if (!seated) return "You are watching this table.";
    return myTurn ? "Your turn." : "Waiting for your opponent to move.";
  })();

  return (
    <div className="mg-stakes">
      <p className="mg-status" role="status">
        {status}
      </p>
      <p className="mg-stake-meta">
        Stake {formatNaira(table.stake)} · Pot {formatNaira(table.pot)}
        {me ? ` · You are ${me.seat === 1 ? "X" : "O"}` : ""}
      </p>
      <div className="mg-ttt" role="grid" aria-label="Tic-Tac-Toe table board">
        {Array.from({ length: 9 }, (_, index) => {
          const mark = board?.cells[index] ?? "-";
          const cell = mark === "-" ? "" : mark;
          return (
            <button
              key={index}
              type="button"
              className="mg-ttt-cell"
              disabled={!myTurn || !!cell || move.isPending}
              aria-label={cell ? `Square ${index + 1}, ${cell}` : `Square ${index + 1}, empty`}
              onClick={() => move.mutate(index)}
            >
              {cell}
            </button>
          );
        })}
      </div>
      {canClaim && (
        <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
          Claim the pot (opponent away 2+ minutes)
        </Button>
      )}
      {seated && table.status === "open" && (
        <Button variant="plain" onClick={() => leave.mutate()} disabled={leave.isPending}>
          Leave and get my stake back
        </Button>
      )}
      {finished && <Button onClick={onExit}>Back to tables</Button>}
      {!finished && table.status !== "open" && (
        <small className="mg-stake-meta">
          Winner takes the pot less a {table.fee_percent}% fee.
        </small>
      )}
    </div>
  );
}
