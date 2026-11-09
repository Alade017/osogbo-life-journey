/**
 * Whot-style card game for 2 to 4 players. A card is playable when it matches the top card's shape
 * or number, or when it is a Whot wildcard (the player picks the next shape). Special cards: 2 makes
 * the next player draw two, 14 makes the next player draw one, 8 skips the next player, and 1 lets
 * the player play again. The first player to empty their hand wins. Pure: no React, no network.
 */
export type Shape = "circle" | "triangle" | "cross" | "square" | "star";
export type Card = { id: string; shape: Shape | null; rank: number };
export const SHAPES: readonly Shape[] = ["circle", "triangle", "cross", "square", "star"];
export const WHOT_RANK = 20;
const RANKS = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
const HAND_SIZE = 5;

export type WhotState = {
  playerCount: number;
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  /** The shape in force. Matters after a Whot is played. */
  shape: Shape;
  turn: number;
  pendingDraw: number;
  skipNext: boolean;
  winner: number | null;
};

/** Builds the 61-card deck, then shuffles it with the supplied random source. */
export function buildWhotDeck(random: () => number = Math.random): Card[] {
  const deck: Card[] = [];
  for (const shape of SHAPES) {
    for (const rank of RANKS) deck.push({ id: `${shape}-${rank}`, shape, rank });
  }
  deck.push({ id: "whot", shape: null, rank: WHOT_RANK });
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = deck[i];
    const b = deck[j];
    if (a && b) {
      deck[i] = b;
      deck[j] = a;
    }
  }
  return deck;
}

export function newWhot(playerCount: number, random: () => number = Math.random): WhotState {
  const count = Math.min(4, Math.max(2, playerCount));
  const stock = buildWhotDeck(random);
  const hands: Card[][] = Array.from({ length: count }, () => []);
  for (let round = 0; round < HAND_SIZE; round += 1) {
    for (let player = 0; player < count; player += 1) {
      const card = stock.pop();
      const hand = hands[player];
      if (card && hand) hand.push(card);
    }
  }
  let top = stock.pop();
  while (top && top.rank === WHOT_RANK) {
    stock.unshift(top);
    top = stock.pop();
  }
  if (!top) throw new Error("The Whot deck is empty.");
  return {
    playerCount: count,
    hands,
    stock,
    discard: [top],
    shape: top.shape ?? SHAPES[0] ?? "circle",
    turn: 0,
    pendingDraw: 0,
    skipNext: false,
    winner: null,
  };
}

function handOf(hands: readonly (readonly Card[])[], player: number): Card[] {
  return [...(hands[player] ?? [])];
}

export function canPlayCard(state: WhotState, card: Card): boolean {
  if (state.pendingDraw > 0) return card.rank === 2 || card.rank === 14;
  if (card.rank === WHOT_RANK) return true;
  const top = state.discard[state.discard.length - 1];
  return card.shape === state.shape || (top !== undefined && card.rank === top.rank);
}

export function playableCards(state: WhotState): Card[] {
  if (state.winner !== null) return [];
  return handOf(state.hands, state.turn).filter((card) => canPlayCard(state, card));
}

function advance(state: WhotState, from: number, steps = 1): number {
  let next = from;
  for (let i = 0; i < steps; i += 1) next = (next + 1) % state.playerCount;
  return next;
}

/** Draws from the stock, reshuffling the discard pile (except the top card) when it runs out. */
function drawFrom(state: WhotState, count: number, random: () => number) {
  let stock = [...state.stock];
  let discard = [...state.discard];
  const drawn: Card[] = [];
  for (let i = 0; i < count; i += 1) {
    if (stock.length === 0) {
      if (discard.length <= 1) break;
      const top = discard.pop()!;
      stock = discard;
      discard = [top];
      for (let k = stock.length - 1; k > 0; k -= 1) {
        const j = Math.floor(random() * (k + 1));
        const a = stock[k];
        const b = stock[j];
        if (a && b) {
          stock[k] = b;
          stock[j] = a;
        }
      }
    }
    drawn.push(stock.pop()!);
  }
  return { stock, discard, drawn };
}

export function playWhot(
  state: WhotState,
  cardId: string,
  chosenShape?: Shape,
  random: () => number = Math.random,
): WhotState {
  if (state.winner !== null) return state;
  const card = handOf(state.hands, state.turn).find((item) => item.id === cardId);
  if (!card || !canPlayCard(state, card)) return state;
  if (card.rank === WHOT_RANK && !chosenShape) return state;

  const hands = state.hands.map((hand) => [...hand]);
  hands[state.turn] = handOf(hands, state.turn).filter((item) => item.id !== cardId);
  const discard = [...state.discard, card];
  const shape = card.rank === WHOT_RANK ? chosenShape! : (card.shape ?? state.shape);
  let pendingDraw = state.pendingDraw;
  let skipNext = false;
  let stock = state.stock;
  let finalDiscard = discard;

  if (handOf(hands, state.turn).length === 0) {
    return { ...state, hands, discard, shape, pendingDraw, skipNext, stock, winner: state.turn };
  }

  if (card.rank === 2) pendingDraw += 2;
  if (card.rank === 14) pendingDraw += 1;
  if (card.rank === 8) skipNext = true;
  const holdOn = card.rank === 1;

  let nextTurn = holdOn ? state.turn : advance(state, state.turn, skipNext ? 2 : 1);
  if (pendingDraw > 0 && !holdOn) {
    const target = advance(state, state.turn);
    const drawn = drawFrom({ ...state, stock, discard: finalDiscard }, pendingDraw, random);
    hands[target] = [...handOf(hands, target), ...drawn.drawn];
    stock = drawn.stock;
    finalDiscard = drawn.discard;
    pendingDraw = 0;
    nextTurn = advance(state, state.turn, 2);
  }
  const turn = nextTurn;
  return {
    ...state,
    hands,
    stock,
    discard: finalDiscard,
    shape,
    turn,
    pendingDraw,
    skipNext: false,
    winner: null,
  };
}

/** Draws the cards owed (or one card) and passes the turn when nothing can be played. */
export function drawWhot(state: WhotState, random: () => number = Math.random): WhotState {
  if (state.winner !== null) return state;
  const count = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const drawn = drawFrom(state, count, random);
  const hands = state.hands.map((hand) => [...hand]);
  hands[state.turn] = [...handOf(hands, state.turn), ...drawn.drawn];
  return {
    ...state,
    hands,
    stock: drawn.stock,
    discard: drawn.discard,
    pendingDraw: 0,
    turn: advance(state, state.turn),
  };
}

/** Computer choice: a card that does not win the shape, prefers draw cards, then the largest hand. */
export function bestWhotCard(state: WhotState): { cardId: string; shape: Shape | null } | null {
  const options = playableCards(state);
  if (!options.length) return null;
  const card =
    options.find((item) => item.rank === 2 || item.rank === 14) ??
    options.find((item) => item.rank !== WHOT_RANK) ??
    options[0];
  if (!card) return null;
  if (card.rank === WHOT_RANK) {
    const counts = new Map<Shape, number>();
    for (const item of handOf(state.hands, state.turn)) {
      if (item.shape) counts.set(item.shape, (counts.get(item.shape) ?? 0) + 1);
    }
    const shape: Shape =
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? SHAPES[0] ?? "circle";
    return { cardId: card.id, shape };
  }
  return { cardId: card.id, shape: null };
}
