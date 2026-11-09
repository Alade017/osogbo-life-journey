/**
 * Big features announced in Town News. Add an entry here when a feature ships and it appears
 * in the news automatically, newest first.
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

export const GAME_UPDATES: readonly GameUpdate[] = [
  {
    id: "osun-gist",
    title: "Osun Gist",
    summary: "Osun State headlines in one place, with links to read more at the source.",
    app: "Osun Gist",
    publishedOn: "2026-11-09",
  },
  {
    id: "town-map-places",
    title: "Places to explore",
    summary: "The map lists the places in town you can explore.",
    app: "Map",
    publishedOn: "2026-11-09",
  },
];

/** Updates newest first. Entries with the same date keep their order in the list above. */
export function latestGameUpdates(limit = 10): GameUpdate[] {
  return [...GAME_UPDATES]
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn))
    .slice(0, limit);
}
