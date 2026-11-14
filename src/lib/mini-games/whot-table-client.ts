import { supabase } from "@/integrations/supabase/client";
import type { Card, Shape } from "@/lib/mini-games/whot";

/** What the table shows a seated player. The opponent's hand never leaves the server. */
export type WhotView =
  | { started: false; status: string; version: number; my_seat: number }
  | {
      started: true;
      status: string;
      version: number;
      my_seat: number;
      turn_seat: number;
      shape: Shape;
      top: Card;
      discard_count: number;
      stock_count: number;
      pending_draw: number;
      pending_rank: number | null;
      winner_seat: number | null;
      my_hand: Card[];
      opponent_count: number;
    };

export type WhotActionBody =
  { action: "start" } | { action: "play"; cardId: string; shape?: Shape } | { action: "draw" };

export async function fetchWhotView(tableId: string): Promise<WhotView> {
  const { data, error } = await supabase.rpc("mini_game_whot_view", { p_table: tableId });
  if (error) throw new Error(error.message);
  return data as unknown as WhotView;
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to continue.");
  return token;
}

/** Sends one action to the server, which applies the rules. Failures carry the server's code. */
export async function sendWhotAction(tableId: string, body: WhotActionBody): Promise<void> {
  const response = await fetch("/api/mini-games/whot/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify({ tableId, ...body }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    throw new Error(whotMessage(payload?.error?.code));
  }
}

const MESSAGES: Record<string, string> = {
  NOT_YOUR_TURN: "It is not your turn.",
  CARD_NOT_PLAYABLE: "That card cannot be played now.",
  SHAPE_REQUIRED: "Choose a shape for the Whot card.",
  SHAPE_INVALID: "That shape is not in the deck.",
  CAN_STILL_PLAY: "You have a card you can play.",
  GAME_CHANGED: "The table changed. Your view has been refreshed.",
  GAME_OVER: "This game is over.",
  TABLE_NOT_IN_PLAY: "This table is not in play.",
  NOT_STARTED: "The game is still starting. Try again in a moment.",
  NOT_SEATED: "You are not at this table.",
};

export function whotMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || "Something went wrong. Try again.";
}
