import type { WalkPoint } from "./grid-walk-path.ts";
import { MALL_STAFF } from "./osun-mall-layout.ts";
import type { MallTarget } from "./mall-reactions.ts";

/** Seconds a speech bubble stays up before it fades away. */
export const MALL_BUBBLE_SECONDS = 4;
/** Most bubbles on screen at once. The oldest is dropped first, which keeps the scene light. */
export const MALL_MAX_BUBBLES = 5;
/** The id a bubble uses when it belongs to the visitor's own character. */
export const PLAYER_BUBBLE_ID = "player";

export type MallBubble = {
  /** Unique per bubble, so a replaced bubble restarts its fade. */
  id: number;
  /** Which character the bubble hovers over: a staff id, a shopper id, or PLAYER_BUBBLE_ID. */
  targetId: string;
  text: string;
  /** Time (ms, same clock as `now`) when the bubble is removed. */
  expiresAt: number;
};

/**
 * Adds a bubble above one character. A character has at most one bubble, so a new line replaces
 * the old one. When the list is full, the oldest bubble is dropped.
 */
export function addBubble(
  bubbles: readonly MallBubble[],
  targetId: string,
  text: string,
  now: number,
  nextId: number,
): { bubbles: MallBubble[]; nextId: number } {
  const kept = bubbles.filter((bubble) => bubble.targetId !== targetId);
  const added: MallBubble = {
    id: nextId,
    targetId,
    text,
    expiresAt: now + MALL_BUBBLE_SECONDS * 1000,
  };
  const combined = [...kept, added];
  const overflow = Math.max(0, combined.length - MALL_MAX_BUBBLES);
  return { bubbles: combined.slice(overflow), nextId: nextId + 1 };
}

/**
 * Removes bubbles whose time is up. Returns the same array when nothing has expired, so React
 * does not re-render on every timer tick.
 */
export function pruneBubbles(bubbles: readonly MallBubble[], now: number): MallBubble[] {
  if (!bubbles.some((bubble) => bubble.expiresAt <= now)) return bubbles as MallBubble[];
  return bubbles.filter((bubble) => bubble.expiresAt > now);
}

/** Splits "Cashier: Next, please." into its speaker and the spoken line. */
export function splitSpeaker(text: string): { speaker: string | null; line: string } {
  const at = text.indexOf(": ");
  if (at <= 0) return { speaker: null, line: text };
  return { speaker: text.slice(0, at), line: text.slice(at + 2) };
}

/**
 * Which character a click's line is spoken over. A clicked person speaks over themselves. A till
 * line goes over the nearest cashier. Anything else (shelves, seats, displays) is said by the
 * visitor, so it goes over the visitor's own character.
 */
export function bubbleTargetFor(target: MallTarget, player: WalkPoint): string {
  if (target.kind === "staff" || target.kind === "shopper") return target.id;
  if (target.kind === "till") {
    let nearest: string | null = null;
    let best = Infinity;
    for (const member of MALL_STAFF) {
      if (member.role !== "till") continue;
      const d = Math.hypot(member.position[0] - player[0], member.position[1] - player[1]);
      if (d < best) {
        best = d;
        nearest = member.id;
      }
    }
    if (nearest) return nearest;
  }
  return PLAYER_BUBBLE_ID;
}

/**
 * Where a bubble's character stands right now, or null when that character is gone (a shopper who
 * has left, for example). Staff stand still; shoppers and the visitor move, so this reads live state.
 */
export function bubbleAnchor(
  targetId: string,
  state: {
    player: { pos: WalkPoint };
    shoppers: readonly { id: string; walker: { pos: WalkPoint } }[];
  },
): WalkPoint | null {
  if (targetId === PLAYER_BUBBLE_ID) return state.player.pos;
  const shopper = state.shoppers.find((candidate) => candidate.id === targetId);
  if (shopper) return shopper.walker.pos;
  const member = MALL_STAFF.find((candidate) => candidate.id === targetId);
  return member ? member.position : null;
}
