/**
 * Whot (Nigerian rules) for 2 to 4 players. The deck has 54 cards: 49 numbered cards and five Whot cards.
 * A card is playable when it matches the shape in force or the number of the top card, or when it is a
 * Whot card (the player picks the next shape).
 *
 * Special cards: 1 (Hold On) and 14 (General Market) let the player play again, 14 also makes every other
 * player draw one. 8 (Skip) skips the next player. 2 (Pick Two) and 5 (Pick Three) start a penalty that
 * the next player must defend with the same number, and each defence adds to the penalty. A player who
 * cannot defend draws the whole penalty and loses the turn. A Whot card chooses the next shape; the next
 * player who has no card of that shape draws one card and loses the turn.
 *
 * Source: Wikipedia "Whot!" (deck composition and special cards). Pure: no React, no network.
 */
export type Shape = "circle" | "triangle" | "cross" | "square" | "star";
export type Card = { id: string; shape: Shape | null; rank: number };
export const SHAPES: readonly Shape[] = ["circle", "triangle", "cross", "square", "star"];
export const WHOT_RANK = 20;
const HAND_SIZE = 6;

/** Ranks in each shape, from the official composition: circles and triangles 12, crosses and squares 9, stars 7. */
const RANKS_BY_SHAPE: Record<Shape, readonly number[]> = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8],
};

export type WhotState = {
  playerCount: number;
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  /** The shape in force. */
  shape: Shape;
  turn: number;
  /** Cards owed to the next player who cannot defend, 0 when no penalty is running. */
  pendingDraw: number;
  /** The number (2 or 5) that started the running penalty; only that number defends it. */
  pendingRank: number | null;
  winner: number | null;
};

/** Builds the 54-card deck, then shuffles it with the supplied random source. */
export function buildWhotDeck(random: () => number = Math.random): Card[] {
  const deck: Card[] = [];
  for (const shape of SHAPES) {
    for (const rank of RANKS_BY_SHAPE[shape]) deck.push({ id: `${shape}-${rank}`, shape, rank });
  }
  for (let i = 1; i <= 5; i += 1) deck.push({ id: `whot-${i}`, shape: null, rank: WHOT_RANK });
  shuffleInPlace(deck, random);
  return deck;
}

function shuffleInPlace<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = items[i];
    const b = items[j];
    if (a !== undefined && b !== undefined) {
      items[i] = b;
      items[j] = a;
    }
  }
}

function handOf(hands: readonly (readonly Card[])[], player: number): Card[] {
  return [...(hands[player] ?? [])];
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
  // The first discard must be a numbered card so the game starts with a shape and number in force.
  let top = stock.pop();
  while (top && top.rank === WHOT_RANK) {
    stock.unshift(top);
    top = stock.pop();
  }
  if (!top || !top.shape) throw new Error("The Whot deck has no starting card.");
  return {
    playerCount: count,
    hands,
    stock,
    discard: [top],
    shape: top.shape,
    turn: 0,
    pendingDraw: 0,
    pendingRank: null,
    winner: null,
  };
}

export function canPlayCard(state: WhotState, card: Card): boolean {
  if (state.pendingDraw > 0) return card.rank === state.pendingRank;
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

/** Draws from the stock. When it runs out, the discard pile (except the top card) is shuffled back in. */
function drawFrom(
  state: Pick<WhotState, "stock" | "discard">,
  count: number,
  random: () => number,
) {
  const stock = [...state.stock];
  let discard = [...state.discard];
  const drawn: Card[] = [];
  for (let i = 0; i < count; i += 1) {
    if (stock.length === 0) {
      if (discard.length <= 1) break;
      const top = discard.pop();
      if (!top) break;
      stock.push(...discard);
      discard = [top];
      shuffleInPlace(stock, random);
    }
    const card = stock.pop();
    if (card) drawn.push(card);
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
  const shape: Shape =
    card.rank === WHOT_RANK ? (chosenShape ?? state.shape) : (card.shape ?? state.shape);

  if (handOf(hands, state.turn).length === 0) {
    return {
      ...state,
      hands,
      discard,
      shape,
      pendingDraw: 0,
      pendingRank: null,
      winner: state.turn,
    };
  }

  let pendingDraw = state.pendingDraw;
  let pendingRank = state.pendingRank;
  let turn = advance(state, state.turn);
  let stock = state.stock;
  let finalDiscard = discard;

  if (card.rank === 2 || card.rank === 5) {
    pendingDraw = (state.pendingDraw > 0 ? state.pendingDraw : 0) + (card.rank === 2 ? 2 : 3);
    pendingRank = card.rank;
  } else if (card.rank === 1) {
    // Hold On: the same player plays again.
    turn = state.turn;
  } else if (card.rank === 8) {
    // Skip: the next player loses the turn.
    turn = advance(state, state.turn, 2);
  } else if (card.rank === 14) {
    // General Market: every other player draws one card and the player plays again.
    turn = state.turn;
    for (let other = 0; other < state.playerCount; other += 1) {
      if (other === state.turn) continue;
      const drawn = drawFrom({ stock, discard: finalDiscard }, 1, random);
      stock = drawn.stock;
      finalDiscard = drawn.discard;
      hands[other] = [...handOf(hands, other), ...drawn.drawn];
    }
  }

  return {
    ...state,
    hands,
    stock,
    discard: finalDiscard,
    shape,
    turn,
    pendingDraw,
    pendingRank,
    winner: null,
  };
}

/**
 * The current player cannot play. A running penalty is drawn in full. Otherwise one card is drawn.
 * Either way the turn passes on.
 */
export function drawWhot(state: WhotState, random: () => number = Math.random): WhotState {
  if (state.winner !== null) return state;
  const count = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const drawn = drawFrom(state, count, random);
  const hands = state.hands.map((hand) => [...hand]);
  hands[state.turn] = [...handOf(hands, state.turn), ...drawn.drawn];
  if (drawn.drawn.length === 0) {
    // Nothing is left to draw and nobody can play: the player with the fewest cards wins.
    const fewest = hands.reduce(
      (best, hand, player) => (hand.length < (hands[best]?.length ?? Infinity) ? player : best),
      0,
    );
    return {
      ...state,
      hands,
      stock: drawn.stock,
      discard: drawn.discard,
      pendingDraw: 0,
      pendingRank: null,
      winner: fewest,
    };
  }
  return {
    ...state,
    hands,
    stock: drawn.stock,
    discard: drawn.discard,
    pendingDraw: 0,
    pendingRank: null,
    turn: advance(state, state.turn),
  };
}

/** Computer choice: defend a penalty if it can, else play a numbered card, else the Whot. */
export function bestWhotCard(state: WhotState): { cardId: string; shape: Shape | null } | null {
  const options = playableCards(state);
  if (!options.length) return null;
  const card =
    options.find((item) => item.rank !== WHOT_RANK && item.rank !== 14) ??
    options.find((item) => item.rank !== WHOT_RANK) ??
    options[0];
  if (!card) return null;
  if (card.rank === WHOT_RANK) {
    const counts = new Map<Shape, number>();
    for (const item of handOf(state.hands, state.turn)) {
      if (item.shape) counts.set(item.shape, (counts.get(item.shape) ?? 0) + 1);
    }
    const shape: Shape = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "circle";
    return { cardId: card.id, shape };
  }
  return { cardId: card.id, shape: null };
}
