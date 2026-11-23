export type GateLoadingCopy = { title: string; detail: string };

const GENERIC: GateLoadingCopy = { title: "Loading your game", detail: "Preparing your world…" };

/**
 * Copy for the game layout's first load gate. It names the page being opened, so players do not
 * see the generic screen on the pages that have their own loading copy.
 */
export function gateLoadingCopy(pathname: string, visitingFriend: boolean): GateLoadingCopy {
  if (pathname === "/home" && visitingFriend) {
    return { title: "Visiting the home", detail: "Loading the friend's home…" };
  }
  switch (pathname) {
    case "/party":
      return { title: "Opening the party", detail: "Loading your character…" };
    case "/market":
      return { title: "Opening the market", detail: "Loading your stall and the shops…" };
    case "/social":
      return { title: "Opening your social life", detail: "Loading your contacts and messages…" };
    case "/home":
    case "/house":
      return { title: "Opening your home", detail: "Loading your home…" };
    case "/map":
      return { title: "Loading the map", detail: "Preparing the 3D world…" };
    default:
      return GENERIC;
  }
}
