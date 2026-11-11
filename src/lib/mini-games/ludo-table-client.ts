import { supabase } from "@/integrations/supabase/client";
import type { LudoMode, LudoMove, LudoState } from "@/lib/mini-games/ludo";

/** What the table shows a seated player. Ludo has no hidden information, so the whole game is shared. */
export type LudoView =
  | { started: false; status: string; version: number; my_seat: number; mode: LudoMode | null }
  | {
      started: true;
      status: string;
      version: number;
      my_seat: number;
      mode: LudoMode | null;
      state: LudoState;
    };

export type LudoActionBody =
  { action: "start" } | { action: "roll" } | { action: "move"; move: LudoMove };

export async function fetchLudoView(tableId: string): Promise<LudoView> {
  const { data, error } = await supabase.rpc("mini_game_ludo_view", { p_table: tableId });
  if (error) throw new Error(error.message);
  return data as unknown as LudoView;
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to continue.");
  return token;
}

/** Sends one action to the server, which rolls the dice and applies the rules. */
export async function sendLudoAction(tableId: string, body: LudoActionBody): Promise<void> {
  const response = await fetch("/api/mini-games/ludo/", {
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
    throw new Error(ludoMessage(payload?.error?.code));
  }
}

const MESSAGES: Record<string, string> = {
  NOT_YOUR_TURN: "It is not your turn.",
  ALREADY_ROLLED: "You have already rolled. Play your dice.",
  ROLL_FIRST: "Roll the dice first.",
  MOVE_NOT_LEGAL: "That move is not allowed with these dice.",
  GAME_CHANGED: "The table changed. Your view has been refreshed.",
  GAME_OVER: "This game is over.",
  TABLE_NOT_IN_PLAY: "This table is not in play.",
  NOT_STARTED: "The game is still starting. Try again in a moment.",
  NOT_SEATED: "You are not at this table.",
};

export function ludoMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || "Something went wrong. Try again.";
}
