import { useEffect, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatNaira, q } from "@/lib/game";
import { WhotTableView } from "@/components/game/mini-games/WhotTableView";
import { LudoTableView } from "@/components/game/mini-games/LudoTableView";

/** Stake choices in whole Naira. The server enforces the same range (100 to 5,000). */
const STAKES = [100, 250, 500, 1000, 2500, 5000] as const;
/** A player away for longer than this can be forfeited by the other player. */
const IDLE_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 20_000;
const REFRESH_MS = 3_000;
type GameKind = "tictactoe" | "whot" | "ludo";
const GAME_LABELS: Record<GameKind, string> = {
  tictactoe: "Tic-Tac-Toe",
  whot: "Whot",
  ludo: "Ludo",
};
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
  const [ludoMode, setLudoMode] = useState<1 | 2>(1);
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
          : game === "ludo"
            ? await supabase.rpc("mini_game_create_ludo_table", {
                p_stake: stake,
                p_mode: ludoMode,
              })
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
      <section className="mg-stake-create" aria-label="Open a table">
        <p className="mg-status">
          Open a table and stake cash. An opponent matches your stake. The winner takes the pot less
          a 5% house fee. Draws refund both stakes.
        </p>
        <label className="mg-stake-field">
          <span>Game</span>
          <select
            value={game}
            onChange={(event) => setGame(event.target.value as GameKind)}
            aria-label="Game"
          >
            <option value="tictactoe">Tic-Tac-Toe</option>
            <option value="whot">Whot</option>
            <option value="ludo">Ludo</option>
          </select>
        </label>
        {game === "ludo" && (
          <label className="mg-stake-field">
            <span>Setup</span>
            <select
              value={ludoMode}
              onChange={(event) => setLudoMode(Number(event.target.value) === 2 ? 2 : 1)}
              aria-label="Ludo setup"
            >
              <option value={1}>Single House (4 seeds each)</option>
              <option value={2}>Double House (8 seeds each)</option>
            </select>
          </label>
        )}
        <label className="mg-stake-field">
          <span>Stake</span>
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
        <Button
          disabled={!characterId || create.isPending || !canAfford(stake)}
          onClick={() => create.mutate()}
        >
          {canAfford(stake) ? `Open table for ${formatNaira(stake)}` : "Not enough cash"}
        </Button>
      </section>

      <section className="mg-stake-list" aria-label="Open tables">
        <h3>
          Open tables <span className="mg-live">Live</span>
        </h3>
        {tables.isLoading && <p className="mg-status">Loading tables…</p>}
        {tables.isError && <p className="mg-status">Tables are unavailable. Try again.</p>}
        {tables.data?.length === 0 && <p className="mg-status">No open tables yet.</p>}
        <ul className="mg-list">
          {tables.data?.map((table, index) => {
            const mine = table.host_character_id === characterId;
            return (
              <li key={table.id} className="mg-enter" style={{ "--i": index } as CSSProperties}>
                <div className="mg-tile">
                  <span>
                    <strong>Stake {formatNaira(table.stake)}</strong>
                    <small>
                      Pot{" "}
                      <span key={table.pot} className="mg-pot-pop">
                        {formatNaira(table.pot)}
                      </span>{" "}
                      · {gameLabel(table.game)}
                    </small>
                  </span>
                  <Button
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

  if (table.game === "ludo") {
    return (
      <LudoTableView
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
