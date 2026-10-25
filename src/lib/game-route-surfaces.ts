// Routes shown full screen (the bottom navigation). Every other game route opens in the phone.
export const FULL_SCREEN_ROUTES = ["/home", "/map", "/jobs"] as const;
export const DEFAULT_FULL_SCREEN_ROUTE = "/map";

export type RouteSurface = "full" | "phone";

export function normalisePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function surfaceForPath(pathname: string): RouteSurface {
  const path = normalisePath(pathname);
  return (FULL_SCREEN_ROUTES as readonly string[]).includes(path) ? "full" : "phone";
}

/** "/location/cedar-bank" -> "Location", "/create-character" -> "Create character". */
export function phoneRouteTitle(pathname: string): string {
  const first = normalisePath(pathname).split("/").filter(Boolean)[0] ?? "Phone";
  return first.charAt(0).toUpperCase() + first.slice(1).replace(/-/g, " ");
}