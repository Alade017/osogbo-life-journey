import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/game";
import { canPlayCard, SHAPES, WHOT_RANK, type Card, type Shape } from "@/lib/mini-games/whot";
import { fetchWhotView, sendWhotAction, whotMessage } from "@/lib/mini-games/whot-table-client";
import { CardBack, CardFace, ShapeGlyph } from "@/components/game/mini-games/game-art";
import { SHAPE_LABELS } from "@/components/game/mini-games/game-art-data";
import "@/components/game/mini-games/whot-table.css";

const REFRESH_MS = 2_500;
/** Card backs drawn in the opponent's fan; more cards than this show as a count only. */
const FAN_LIMIT = 6;

export type WhotTableRow = {
  stake: number;
  pot: number;
  status: string;
  result: string | null;
  winner_character_id: string | null;
  fee_percent: number;
};

type Props = {
  tableId: string;
  table: WhotTableRow;
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
 * The Whot stake table. It is laid out as a card table: the opponent's fan across the top, the
 * piles in the felt centre, a turn banner, and the player's own hand fanned along the bottom.
 * Solo play has no table at all, so this layout is not shared with it.
 */
export function WhotTableView({
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
  const queryKey = useMemo(() => ["miniGame", "whot", tableId] as const, [tableId]);
  const view = useQuery({
    queryKey,
    queryFn: () => fetchWhotView(tableId),
    enabled: seated,
    refetchInterval: REFRESH_MS,
  });
  const data = view.data ?? null;
  // Narrowed to the started game; null while the table waits for its second player.
  const live = data && data.started ? data : null;
  const startRequested = useRef(false);
  const [choosing, setChoosing] = useState<Card | null>(null);

  // Either seated player may trigger the start; the server starts the game once, so repeats are safe.
  const startNeeded = seated && table.status === "playing" && data !== null && live === null;
  useEffect(() => {
    if (!startNeeded || startRequested.current) return;
    startRequested.current = true;
    sendWhotAction(tableId, { action: "start" })
      .then(() => client.invalidateQueries({ queryKey }))
      .catch((error: unknown) => {
        startRequested.current = false;
        toast.error(error instanceof Error ? error.message : whotMessage(undefined));
      });
  }, [startNeeded, tableId, client, queryKey]);

  const refreshAll = () => {
    void client.invalidateQueries({ queryKey });
  };
  const onActionError = (error: unknown) => {
    toast.error(error instanceof Error ? error.message : whotMessage(undefined));
    void client.invalidateQueries({ queryKey });
  };
  const play = useMutation({
    mutationFn: (input: { cardId: string; shape?: Shape }) =>
      sendWhotAction(tableId, { action: "play", ...input }),
    onSuccess: refreshAll,
    onError: onActionError,
  });
  const draw = useMutation({
    mutationFn: () => sendWhotAction(tableId, { action: "draw" }),
    onSuccess: refreshAll,
    onError: onActionError,
  });

  if (!seated) return <p className="mg-status">You are watching this table.</p>;
  if (view.isLoading) return <p className="mg-status">Dealing the table…</p>;
  if (view.isError || !data) {
    return (
      <div className="wt-table">
        <p className="mg-status" role="alert">
          The table could not be loaded. Try again.
        </p>
        <Button onClick={onExit}>Back to tables</Button>
      </div>
    );
  }

  const finished = table.status === "finished" || table.status === "cancelled";
  const won = table.status === "finished" && table.winner_character_id === characterId;
  const payout = table.pot - Math.floor((table.pot * table.fee_percent) / 100);
  const myTurn = live !== null && live.turn_seat === data.my_seat && live.winner_seat === null;
  const playable = live
    ? live.my_hand.filter((card) =>
        canPlayCard(
          {
            pendingDraw: live.pending_draw,
            pendingRank: live.pending_rank,
            shape: live.shape,
            discard: [live.top],
          },
          card,
        ),
      )
    : [];
  const busy = play.isPending || draw.isPending;

  const turnText = (() => {
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
    if (!live) return "Dealing the cards…";
    if (myTurn && live.pending_draw > 0)
      return `Defend with a ${live.pending_rank} or draw ${live.pending_draw}.`;
    if (myTurn)
      return playable.length ? "Your turn. Play a card." : "Your turn. Nothing matches, so draw.";
    return "Your opponent is playing.";
  })();

  const choosePlay = (card: Card) => {
    if (card.rank === WHOT_RANK) {
      setChoosing(card);
      return;
    }
    play.mutate({ cardId: card.id });
  };

  return (
    <section className="wt-table" aria-label="Whot stake table">
      <header className="wt-strip">
        <span className="wt-pill">Stake {formatNaira(table.stake)}</span>
        <span className="wt-pill is-pot">Pot {formatNaira(table.pot)}</span>
        <span className="wt-pill">{table.fee_percent}% fee</span>
      </header>

      {live && (
        <div className="wt-seat wt-seat-opponent" aria-label="Opponent">
          <span className="wt-seat-name">Opponent</span>
          <div className="wt-fan">
            {Array.from({ length: Math.min(FAN_LIMIT, live.opponent_count) }, (_, index) => (
              <CardBack key={index} size="sm" />
            ))}
          </div>
          <small>{live.opponent_count} cards</small>
        </div>
      )}

      <div className="wt-felt">
        <div className="wt-pile">
          <CardBack />
          <small>{live ? `${live.stock_count} to draw` : "—"}</small>
        </div>
        <div className="wt-centre">
          {live && (
            <span className="wt-shape">
              <ShapeGlyph shape={live.shape} size={18} />
              {SHAPE_LABELS[live.shape]}
            </span>
          )}
          {live && live.pending_draw > 0 && (
            <span className="wt-penalty">
              Pick {live.pending_draw} · defend with {live.pending_rank}
            </span>
          )}
        </div>
        <div className="wt-pile">
          {live && <CardFace rank={live.top.rank} shape={live.top.shape} size="md" />}
          <small>{live ? `${live.discard_count} played` : ""}</small>
        </div>
      </div>

      <p className="wt-turn" role="status">
        {turnText}
      </p>

      {live && (
        <div className="wt-hand-wrap">
          <h3 className="wt-hand-title">Your hand · {live.my_hand.length}</h3>
          <ul className="wt-hand" aria-label="Your cards">
            {live.my_hand.map((card) => {
              const canPlay = myTurn && playable.some((item) => item.id === card.id);
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    className={canPlay ? "wt-card is-playable" : "wt-card"}
                    disabled={!canPlay || busy}
                    aria-label={
                      card.rank === WHOT_RANK
                        ? "Whot card"
                        : `${card.rank} of ${card.shape ? SHAPE_LABELS[card.shape] : "shape"}`
                    }
                    onClick={() => choosePlay(card)}
                  >
                    <CardFace rank={card.rank} shape={card.shape} size="md" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {choosing && (
        <div className="wt-shape-sheet" role="dialog" aria-label="Choose the next shape">
          <p>Choose the next shape</p>
          <div className="wt-shape-options">
            {SHAPES.map((shape) => (
              <button
                key={shape}
                type="button"
                aria-label={SHAPE_LABELS[shape]}
                onClick={() => {
                  const card = choosing;
                  setChoosing(null);
                  play.mutate({ cardId: card.id, shape });
                }}
              >
                <ShapeGlyph shape={shape} size={28} />
                <span>{SHAPE_LABELS[shape]}</span>
              </button>
            ))}
          </div>
          <Button variant="plain" onClick={() => setChoosing(null)}>
            Cancel
          </Button>
        </div>
      )}

      <div className="wt-actions">
        {myTurn && playable.length === 0 && live && (
          <Button onClick={() => draw.mutate()} disabled={busy}>
            {live.pending_draw > 0 ? `Draw ${live.pending_draw}` : "Draw a card"}
          </Button>
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
      </div>
    </section>
  );
}
