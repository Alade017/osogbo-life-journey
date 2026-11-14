// Records a finished Ludo game through the database function record_ludo_match. This runs on the
// server only and uses SUPABASE_SECRET_KEY, which must never reach browser code or a VITE_ variable.

type LudoWin = { winnerId: string; playerIds: string[] };

function serviceSettings() {
  const url = process.env["SUPABASE_URL"];
  const secret = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !secret) throw new Error("Ludo results need SUPABASE_URL and SUPABASE_SECRET_KEY on the server.");
  return { url: url.replace(/\/$/, ""), secret };
}

export async function recordLudoWin({ winnerId, playerIds }: LudoWin): Promise<void> {
  const { url, secret } = serviceSettings();
  const response = await fetch(`${url}/rest/v1/rpc/record_ludo_match`, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_winner: winnerId, p_players: playerIds }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`The Ludo result could not be recorded (${response.status}).`);
}
