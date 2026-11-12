/** How phone app tiles are drawn. Saved on the account (profiles.app_tile_style). */
export const APP_TILE_STYLES = ["rounded", "circle"] as const;
export type AppTileStyle = (typeof APP_TILE_STYLES)[number];

export const DEFAULT_APP_TILE_STYLE: AppTileStyle = "rounded";

/** Reads the saved value, falling back to the rounded tiles for anything unexpected. */
export function parseAppTileStyle(value: unknown): AppTileStyle {
  return typeof value === "string" && (APP_TILE_STYLES as readonly string[]).includes(value)
    ? (value as AppTileStyle)
    : DEFAULT_APP_TILE_STYLE;
}
