import { supabase } from "@/integrations/supabase/client";

/**
 * Big features announced in Town News, read from the game_updates table. Add a row there when a
 * feature ships and it appears in the news automatically, newest first.
 */
export type GameUpdate = {
  id: string;
  title: string;
  summary: string;
  /** The phone app the feature lives in. */
  app: string;
  /** Date the feature shipped, YYYY-MM-DD. */
  publishedOn: string;
};

export type GameUpdateRow = {
  id: string;
  title: string;
  summary: string;
  app: string;
  published_on: string;
};

export function toGameUpdate(row: GameUpdateRow): GameUpdate {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    app: row.app,
    publishedOn: row.published_on,
  };
}

/** Updates newest first. Entries with the same date keep the order the database returned them in. */
export function sortGameUpdates(updates: readonly GameUpdate[], limit = 10): GameUpdate[] {
  return [...updates].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn)).slice(0, limit);
}

export async function loadGameUpdates(): Promise<GameUpdate[]> {
  // The generated database types do not yet include the game_updates table.
  const { data, error } = await supabase
    .from("game_updates" as never)
    .select("id,title,summary,app,published_on")
    .order("published_on", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as GameUpdateRow[]).map(toGameUpdate);
}
