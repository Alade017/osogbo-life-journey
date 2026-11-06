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
  "/rentals": "Rent homes",
  "/property": "Property",
  "/properties": "Find homes",
  "/jobs": "Career Life",
  "/education": "Education",
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
  return PHONE_APP_ROUTES[path];
}

/** Full-page 3D scenes must never mount inside a phone app, including friend homes. */
export function isFullPageWorldPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    ["/map", "/neighborhood", "/house", "/home"].includes(path) ||
    /^\/bank\/[^/]+$/.test(path) ||
    /^\/location\/[^/]+$/.test(path)
  );
}

export function fullPageWorldApp(app: string): string | undefined {
  return (
    {
      Home: "/home",
      House: "/house",
      Map: "/map",
      Neighborhood: "/neighborhood",
      Neighbourhood: "/neighborhood",
    } as Record<string, string>
  )[app];
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
  openWorld?: (href: string) => void,
): void {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.origin !== window.location.origin) return;
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    anchor.hasAttribute("download") ||
    (anchor.target && anchor.target !== "_self")
  )
    return;
  if (isFullPageWorldPath(anchor.pathname)) {
    if (openWorld) {
      event.preventDefault();
      event.stopPropagation();
      openWorld(anchor.pathname + anchor.search + anchor.hash);
    }
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const app = phoneAppForPath(anchor.pathname) ?? phoneRouteTitle(anchor.pathname);
  openApp(app, anchor.search || undefined);
}

/** Game content links open phone apps; the bottom navigation owns full-page travel. */
export function handleGamePageLinkClick(event: MouseEvent<HTMLDivElement>): void {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (
    !(anchor instanceof HTMLAnchorElement) ||
    anchor.closest('[aria-label="Game navigation"], .phone-dialog') ||
    anchor.origin !== window.location.origin ||
    anchor.hasAttribute("download") ||
    (anchor.target && anchor.target !== "_self") ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const app = phoneAppForPath(anchor.pathname);
  if (!app) return;
  event.preventDefault();
  event.stopPropagation();
  window.dispatchEvent(
    new CustomEvent("osogbo-open-phone-app", {
      detail: { app, search: anchor.search || undefined },
    }),
  );
}

function phoneRouteTitle(pathname: string): string {
  const route = pathname.split("/").filter(Boolean)[0] ?? "Phone";
  return route.charAt(0).toUpperCase() + route.slice(1).replace(/-/g, " ");
}
