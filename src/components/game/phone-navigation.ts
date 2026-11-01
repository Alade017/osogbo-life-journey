import type { MouseEvent } from "react";

export type PhoneNavigationState = {
  app: string | null;
  search?: string;
  history: Array<{ app: string; search?: string }>;
};

export type PhoneNavigationAction =
  | { type: "open"; app: string; search?: string }
  | { type: "back" }
  | { type: "home" }
  | { type: "close" };

/** Internal game routes represented by apps in the phone. */
export const PHONE_APP_ROUTES: Readonly<Record<string, string>> = {
  "/home": "Home",
  "/house": "Home",
  "/rentals": "Rent homes",
  "/property": "Property",
  "/properties": "Find homes",
  "/jobs": "Jobs",
  "/education": "Education",
  "/map": "Map",
  "/wallet": "Bank",
  "/market": "Market",
  "/party": "Party",
  "/profile": "Profile",
  "/inventory": "Inventory",
  "/social": "Messages",
  "/missions": "Missions",
  "/notifications": "Notifications",
  "/settings": "Settings",
  "/businesses": "Businesses",
};

export function phoneAppForPath(pathname: string): string | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PHONE_APP_ROUTES[path] ?? (/^\/location\/[^/]+$/.test(path) ? "Map" : undefined);
}

export function reducePhoneNavigation(
  state: PhoneNavigationState,
  action: PhoneNavigationAction,
): PhoneNavigationState {
  switch (action.type) {
    case "open":
      return action.app === state.app && action.search === state.search
        ? state
        : {
            app: action.app,
            ...(action.search ? { search: action.search } : {}),
            history: state.app
              ? [
                  ...state.history,
                  { app: state.app, ...(state.search ? { search: state.search } : {}) },
                ]
              : state.history,
          };
    case "back": {
      const previousApp = state.history[state.history.length - 1];
      return previousApp
        ? {
            app: previousApp.app,
            ...(previousApp.search ? { search: previousApp.search } : {}),
            history: state.history.slice(0, -1),
          }
        : { app: null, history: [] };
    }
    case "home":
    case "close":
      return { app: null, history: [] };
  }
}

/**
 * Capture same-origin links rendered inside an app so app routes stay in the
 * phone. Unmapped internal paths open a fallback screen in the phone; external
 * links keep their normal browser behavior.
 */
export function handlePhoneLinkClick(
  event: MouseEvent<HTMLDivElement>,
  openApp: (app: string, search?: string) => void,
): void {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.origin !== window.location.origin) return;

  event.preventDefault();
  event.stopPropagation();
  const app = phoneAppForPath(anchor.pathname) ?? phoneRouteTitle(anchor.pathname);
  openApp(app, anchor.search || undefined);
}

function phoneRouteTitle(pathname: string): string {
  const route = pathname.split("/").filter(Boolean)[0] ?? "Phone";
  return route.charAt(0).toUpperCase() + route.slice(1).replace(/-/g, " ");
}
