import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useComputerTurn } from "@/components/game/mini-games/computer-turn";
import { CardBack, CardFace, ShapeGlyph } from "@/components/game/mini-games/game-art";
import { SHAPE_LABELS } from "@/components/game/mini-games/game-art-data";
import {
  SHAPES,
  bestWhotCard,
  drawWhot,
  newWhot,
  playWhot,
  playableCards,
  type Shape,
  type WhotState,
} from "@/lib/mini-games/whot";

/** How long the deck shuffles when the game loads, before the cards are dealt to the screen. */
export const SHUFFLE_MS = 1400;
const SHUFFLE_CARDS = 5;

type WhotSetupChoice = { whotBlocksPenalty: boolean };

export function WhotGame() {
  const [choice, setChoice] = useState<WhotSetupChoice | null>(null);
  if (choice === null) return <WhotSetup onStart={setChoice} />;
  return <WhotTable key={String(choice.whotBlocksPenalty)} config={choice} />;
}

function WhotSetup({ onStart }: { onStart: (choice: WhotSetupChoice) => void }) {
  const [whotBlocksPenalty, setWhotBlocksPenalty] = useState(false);
  return (
    <section className="mg-game mg-setup" aria-label="Whot setup">
      <h3 className="mg-setup-title">Before you start</h3>
      <ul className="mg-setup-rules">
        <li>Defend a Pick Two with another 2, or a Pick Three with another 5.</li>
        <li>Defences stack. The next player draws the whole penalty unless they can defend it.</li>
        <li>A 5 never defends a 2, and a 2 never defends a 5.</li>
      </ul>
      <label className="mg-setup-check">
        <input
          type="checkbox"
          checked={whotBlocksPenalty}
          onChange={(event) => setWhotBlocksPenalty(event.target.checked)}
        />
        <span>
          <strong>House rule: a Whot (20) can cancel a penalty</strong>
          <small>Only if everyone agrees before the game starts.</small>
        </span>
      </label>
      <Button onClick={() => onStart({ whotBlocksPenalty })}>Start the game</Button>
    </section>
  );
}

function WhotTable({ config }: { config: WhotSetupChoice }) {
  const [state, setState] = useState<WhotState>(() =>
    newWhot(2, Math.random, { whotBlocksPenalty: config.whotBlocksPenalty }),
  );
  const [pendingWhot, setPendingWhot] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShuffling(false), SHUFFLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!pendingWhot) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingWhot(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingWhot]);

  const humanTurn = state.turn === 0 && state.winner === null;
  useComputerTurn(!humanTurn && state.winner === null && !shuffling, [state], () => {
    setState((current) => {
      const choice = bestWhotCard(current);
      if (!choice) return drawWhot(current);
      return playWhot(current, choice.cardId, choice.shape ?? undefined);
    });
  });

  const hand = state.hands[0] ?? [];
  const rival = state.hands[1] ?? [];
  const playable = humanTurn
    ? new Set(playableCards(state).map((card) => card.id))
    : new Set<string>();
  const mustDraw = humanTurn && !shuffling && playable.size === 0;
  const top = state.discard[state.discard.length - 1];
  const drawCount = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const status =
    state.winner === 0
      ? "You won!"
      : state.winner !== null
        ? "The computer won."
        : shuffling
          ? "Shuffling the deck…"
          : humanTurn
            ? state.pendingDraw > 0
              ? `Penalty: defend with a ${state.pendingRank} or pick ${state.pendingDraw}.`
              : `Your turn. Play shape ${SHAPE_LABELS[state.shape].toLowerCase()} or a matching number.`
            : "The computer is playing…";

  const drawFromDeck = () => setState((current) => drawWhot(current));

  return (
    <section className="mg-game mg-whot" aria-label="Whot">
      <p className={`mg-status ${state.winner === 0 ? "is-win" : ""}`} role="status">
        {status}
      </p>
      {shuffling ? (
        <div className="mg-shuffle" aria-hidden="true">
          {Array.from({ length: SHUFFLE_CARDS }, (_, index) => (
            <span key={index} className="mg-shuffle-card" style={{ "--i": index } as CSSProperties}>
              <CardBack />
            </span>
          ))}
        </div>
      ) : (
        <>
          <div className="mg-whot-table">
            <div className="mg-pile">
              <CardBack />
              <small>{state.stock.length} left</small>
            </div>
            <div className="mg-discard">
              {top && (
                <span key={top.id} className="mg-deal">
                  <CardFace rank={top.rank} shape={top.shape} size="lg" />
                </span>
              )}
              <small className="mg-shape-now">
                <ShapeGlyph shape={state.shape} size={14} /> {SHAPE_LABELS[state.shape]}
              </small>
            </div>
          </div>
          <div className="mg-opponent" aria-label={`Computer holds ${rival.length} cards`}>
            {rival.slice(0, 8).map((card, index) => (
              <span key={card.id} className="mg-opp-card" style={{ "--i": index } as CSSProperties}>
                <CardBack size="sm" />
              </span>
            ))}
            <small>Computer · {rival.length} cards</small>
          </div>
          {state.pendingDraw > 0 && (
            <p className="mg-penalty">Penalty running: {state.pendingDraw}</p>
          )}
          <div className="mg-hand" role="group" aria-label="Your hand">
            {hand.map((card, index) => {
              const canPlay = playable.has(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`mg-hand-card ${canPlay ? "is-playable" : ""}`}
                  style={{ "--i": index } as CSSProperties}
                  disabled={!canPlay}
                  aria-label={
                    card.rank === 20
                      ? "Whot card" + (canPlay ? "" : ", not playable")
                      : `${card.rank} ${card.shape}${canPlay ? "" : ", not playable"}`
                  }
                  onClick={() => {
                    if (card.rank === 20) setPendingWhot(card.id);
                    else setState((current) => playWhot(current, card.id));
                  }}
                >
                  <CardFace rank={card.rank} shape={card.shape} size="md" />
                </button>
              );
            })}
          </div>
        </>
      )}
      {mustDraw &&
        state.winner === null &&
        createPortal(
          <div className="mg-shape-overlay" role="presentation">
            <div
              className="mg-shape-pick mg-draw-pick"
              role="dialog"
              aria-modal="true"
              aria-label="Pick a card"
            >
              <p>
                {state.pendingDraw > 0
                  ? `You have no ${state.pendingRank} to defend. Pick ${drawCount} cards.`
                  : "No card matches. Pick a new card."}
              </p>
              <button
                type="button"
                className="mg-draw-deck"
                onClick={drawFromDeck}
                aria-label={`Pick ${drawCount} card${drawCount > 1 ? "s" : ""} from the deck`}
              >
                <CardBack />
                <small>Tap the deck</small>
              </button>
            </div>
          </div>,
          document.body,
        )}
      {pendingWhot &&
        createPortal(
          <div className="mg-shape-overlay" onClick={() => setPendingWhot(null)}>
            <div
              className="mg-shape-pick"
              role="dialog"
              aria-modal="true"
              aria-label="Choose a shape"
              onClick={(event) => event.stopPropagation()}
            >
              <p>Choose the shape to call:</p>
              <div className="mg-shape-options">
                {SHAPES.map((shape: Shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => {
                      setState((current) => playWhot(current, pendingWhot, shape));
                      setPendingWhot(null);
                    }}
                  >
                    <ShapeGlyph shape={shape} size={26} />
                    <span>{SHAPE_LABELS[shape]}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mg-shape-cancel"
                onClick={() => setPendingWhot(null)}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body,
        )}
      {state.winner !== null && (
        <Button
          onClick={() =>
            setState(newWhot(2, Math.random, { whotBlocksPenalty: config.whotBlocksPenalty }))
          }
        >
          Play again
        </Button>
      )}
    </section>
  );
}
