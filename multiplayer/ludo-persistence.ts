// Ludo results go through database functions with the service key. This runs on the server only: the key
// must never reach browser code or a VITE_ variable. The functions are service-role only, so the client
// cannot choose a winner, a payout or a seat.

type LudoWin = { winnerId: string; playerIds: string[] };
export type StakeSeats = {
  status: string;
  stake: number;
  mode: number;
  seats: { user_id: string; seat: number }[];
};

function serviceSettings() {
  const url = process.env["SUPABASE_URL"];
  const secret = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !secret)
    throw new Error("Ludo results need SUPABASE_URL and SUPABASE_SECRET_KEY on the server.");
  return { url: url.replace(/\/$/, ""), secret };
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { url, secret } = serviceSettings();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`The Ludo ${name} call failed (${response.status}).`);
  return (await response.json()) as T;
}

/** Records a win for a free table (no stake): the match and the winner's win count. */
export async function recordLudoWin({ winnerId, playerIds }: LudoWin): Promise<void> {
  await rpc("record_ludo_match", { p_winner: winnerId, p_players: playerIds });
}

/** The status, stake and seats of a stake table, so the room can check who may join. */
export function stakeSeats(tableId: string): Promise<StakeSeats> {
  return rpc<StakeSeats>("ludo_stake_table_for_room", { p_table: tableId });
}

/**
 * Pays a stake table's pot to the winner. The players are the seats stored in the database, not the players
 * who joined the room, so a seat that never connected cannot block the payout.
 */
export async function settleLudoStake(tableId: string, winnerId: string): Promise<void> {
  const table = await stakeSeats(tableId);
  const players = table.seats.map((seat) => seat.user_id);
  await rpc("ludo_stake_settle", { p_table: tableId, p_winner_user: winnerId, p_players: players });
}
