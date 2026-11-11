import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/game";
import { legalMoves, type LudoMove } from "@/lib/mini-games/ludo";
import { fetchLudoView, ludoMessage, sendLudoAction } from "@/lib/mini-games/ludo-table-client";
import { LudoScene } from "@/components/game/mini-games/LudoGame";

const REFRESH_MS = 2_500;

export type LudoTableRow = {
  stake: number;
  pot: number;
  status: string;
  result: string | null;
  winner_character_id: string | null;
  fee_percent: number;
};

type Props = {
  tableId: string;
  table: LudoTableRow;
  characterId: string;
  seated: boolean;
  canClaim: boolean;
  onLeave: () => void;
  leavePending: boolean;
  onClaim: () => void;
  claimPending: boolean;
  onExit: () => void;
};

/**
 * The Ludo stake table. Both players see the same board. The server rolls the dice and checks every
 * move, so this view only sends what the player chose and shows the state that comes back.
 */
export function LudoTableView({
  tableId,
  table,
  characterId,
  seated,
  canClaim,
  onLeave,
  leavePending,
  onClaim,
  claimPending,
  onExit,
}: Props) {
  const client = useQueryClient();
  const queryKey = useMemo(() => ["miniGame", "ludo", tableId] as const, [tableId]);
  const view = useQuery({
    queryKey,
    queryFn: () => fetchLudoView(tableId),
    enabled: seated,
    refetchInterval: REFRESH_MS,
  });
  const data = view.data ?? null;
  // Narrowed to the started game; null while the table waits for its second player.
  const live = data && data.started ? data : null;
  const startRequested = useRef(false);
  const [note, setNote] = useState<string | null>(null);

  // Either seated player may trigger the start; the server starts the game once, so repeats are safe.
  const startNeeded = seated && table.status === "playing" && data !== null && live === null;
  useEffect(() => {
    if (!startNeeded || startRequested.current) return;
    startRequested.current = true;
    sendLudoAction(tableId, { action: "start" })
      .then(() => client.invalidateQueries({ queryKey }))
      .catch((error: unknown) => {
        startRequested.current = false;
        toast.error(error instanceof Error ? error.message : ludoMessage(undefined));
      });
  }, [startNeeded, tableId, client, queryKey]);

  const refreshAll = () => {
    void client.invalidateQueries({ queryKey });
  };
  const onActionError = (error: unknown) => {
    toast.error(error instanceof Error ? error.message : ludoMessage(undefined));
    void client.invalidateQueries({ queryKey });
  };
  const roll = useMutation({
    mutationFn: () => sendLudoAction(tableId, { action: "roll" }),
    onSuccess: () => {
      setNote(null);
      refreshAll();
    },
    onError: onActionError,
  });
  const move = useMutation({
    mutationFn: (choice: LudoMove) => sendLudoAction(tableId, { action: "move", move: choice }),
    onSuccess: () => {
      setNote(null);
      refreshAll();
    },
    onError: onActionError,
  });

  if (!seated) return <p className="mg-status">You are watching this table.</p>;
  if (view.isLoading) return <p className="mg-status">Setting up the board…</p>;
  if (view.isError || !data) {
    return (
      <div className="mg-stakes">
        <p className="mg-status" role="alert">
          The table could not be loaded. Try again.
        </p>
        <Button onClick={onExit}>Back to tables</Button>
      </div>
    );
  }

  const busy = roll.isPending || move.isPending;
  const finished = table.status === "finished" || table.status === "cancelled";
  const won = table.status === "finished" && table.winner_character_id === characterId;
  const payout = table.pot - Math.floor((table.pot * table.fee_percent) / 100);
  const mySide = data.my_seat - 1;
  const modeLabel = data.mode === 2 ? "Double House" : "Single House";
  const canMove =
    live !== null &&
    table.status === "playing" &&
    live.state.winner === null &&
    live.state.turn === mySide;

  const resultText = (() => {
    if (table.status === "open")
      return "Waiting for an opponent. Leave any time for a full refund.";
    if (table.status === "cancelled")
      return "This table was cancelled and your stake was refunded.";
    if (finished) {
      if (table.result === "draw") return "It's a draw. Both stakes have been refunded.";
      if (won) return `You won ${formatNaira(payout)}.`;
      if (table.result === "forfeit") return "You were forfeited after being away for 2 minutes.";
      return "Your opponent won this table.";
    }
    return "";
  })();

  return (
    <section className="mg-stakes" aria-label="Ludo stake table">
      <p className="mg-stake-meta">
        Stake {formatNaira(table.stake)} · Pot {formatNaira(table.pot)} · {modeLabel} · You are{" "}
        {mySide === 0 ? "red" : "yellow"}
      </p>

      {live ? (
        <LudoScene
          state={live.state}
          mySide={mySide}
          interactive={canMove && !busy}
          moves={canMove && !busy ? legalMoves(live.state) : []}
          youLabel="YOU"
          opponentLabel="OPPONENT"
          opponentName="Your opponent"
          waitingText="Your opponent is playing…"
          note={note}
          busy={busy}
          onRoll={() => roll.mutate()}
          onMove={(choice) => move.mutate(choice)}
          introAllowed
        />
      ) : (
        <p className="mg-status" role="status">
          {resultText || "Starting the game…"}
        </p>
      )}

      {finished && (
        <p className="mg-status" role="status">
          {resultText}
        </p>
      )}

      {canClaim && (
        <Button onClick={onClaim} disabled={claimPending}>
          Claim the pot (opponent away 2+ minutes)
        </Button>
      )}
      {table.status === "open" && (
        <Button variant="plain" onClick={onLeave} disabled={leavePending}>
          Leave and get my stake back
        </Button>
      )}
      {finished && <Button onClick={onExit}>Back to tables</Button>}
      {!finished && table.status !== "open" && (
        <small className="mg-stake-meta">
          Winner takes the pot less a {table.fee_percent}% fee.
        </small>
      )}
    </section>
  );
}
