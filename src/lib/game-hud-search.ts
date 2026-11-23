import { fullPageWorldApp } from "@/components/game/phone-navigation";

export const GAME_HUD_MODES = ["phone", "jobs", "map", "inventory"] as const;
export type GameHudMode = (typeof GAME_HUD_MODES)[number];
export type PhoneHudTarget = { app: string | null; search?: string };
export type GameHudSearch = { hud?: GameHudMode; phoneApp?: string; phoneSearch?: string };
const HUD_KEYS = ["hud", "phoneApp", "phoneSearch"] as const;

/** Unknown modes and malformed values never trigger world travel or game actions. */
export function parseGameHudSearch(search: Record<string, unknown>): GameHudSearch {
  const hud = GAME_HUD_MODES.find((mode) => mode === search["hud"]);
  if (!hud) return {};
  if (hud === "inventory") return { hud };
  const rawApp = search["phoneApp"];
  const phoneApp =
    hud === "phone" &&
    typeof rawApp === "string" &&
    /^[A-Za-z][A-Za-z0-9 &/'-]{0,63}$/.test(rawApp) &&
    !fullPageWorldApp(rawApp)
      ? rawApp
      : undefined;
  const rawSearch = search["phoneSearch"];
  const phoneSearch =
    typeof rawSearch === "string" && rawSearch.startsWith("?") && rawSearch.length <= 2048
      ? rawSearch
      : undefined;
  return { hud, ...(phoneApp ? { phoneApp } : {}), ...(phoneSearch ? { phoneSearch } : {}) };
}

export function phoneTargetForHud(search: GameHudSearch): PhoneHudTarget {
  const app =
    search.hud === "jobs"
      ? "Career Life"
      : search.hud === "map"
        ? "Map"
        : (search.phoneApp ?? null);
  return { app, ...(app && search.phoneSearch ? { search: search.phoneSearch } : {}) };
}

export function hudForPhoneTarget(target: PhoneHudTarget): GameHudSearch {
  const hud =
    target.app === "Career Life" || target.app === "Jobs"
      ? "jobs"
      : target.app === "Map"
        ? "map"
        : "phone";
  return parseGameHudSearch({ hud, phoneApp: target.app ?? undefined, phoneSearch: target.search });
}

/** Preserve the underlying route, its search and fragment; replace only HUD-owned keys. */
export function gameHudHref(href: string, hud: GameHudSearch): string {
  const url = new URL(href, "https://game.invalid");
  for (const key of HUD_KEYS) url.searchParams.delete(key);
  const parsed = parseGameHudSearch(hud);
  for (const key of HUD_KEYS) if (parsed[key]) url.searchParams.set(key, parsed[key]);
  return url.pathname + url.search + url.hash;
}

/** HUD-only history changes must not be mistaken for travel away from the current world. */
export function gameWorldHref(href: string): string {
  return gameHudHref(href, {});
}
