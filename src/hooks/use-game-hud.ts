import { useCallback, useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  parseGameHudSearch,
  gameHudHref,
  phoneTargetForHud,
  hudForPhoneTarget,
  type GameHudSearch,
  type PhoneHudTarget,
} from "@/lib/game-hud-search";

/** URL is the source of truth for HUD visibility; it never changes world identity. */
export function useGameHud() {
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const raw = useRouterState({ select: (state) => state.location.search });
  const hudSearch = useMemo(() => parseGameHudSearch(raw), [raw]);
  const phoneOpen =
    hudSearch.hud === "phone" || hudSearch.hud === "jobs" || hudSearch.hud === "map";
  const inventoryOpen = hudSearch.hud === "inventory";
  const setHud = useCallback(
    (next: GameHudSearch, replace = false) => {
      const destination = gameHudHref(href, next);
      if (destination !== href) void navigate({ href: destination, replace, resetScroll: false });
    },
    [href, navigate],
  );
  const setPhoneOpen = useCallback(
    (open: boolean) => {
      if (open && !phoneOpen) setHud({ hud: "phone" });
      else if (!open && phoneOpen) setHud({}, true);
    },
    [phoneOpen, setHud],
  );
  const setInventoryOpen = useCallback(
    (open: boolean) => {
      if (open) setHud({ hud: "inventory" });
      else if (inventoryOpen) setHud({}, true);
    },
    [inventoryOpen, setHud],
  );
  const phoneRequest = useMemo(() => phoneTargetForHud(hudSearch), [hudSearch]);
  const onPhoneNavigation = useCallback(
    (target: PhoneHudTarget) => setHud(hudForPhoneTarget(target)),
    [setHud],
  );
  const openHud = useCallback(
    (hud: "jobs" | "map") => {
      if (hud === "map" && pathname === "/map") setHud({}, true);
      else setHud({ hud });
    },
    [pathname, setHud],
  );
  return {
    phoneOpen,
    inventoryOpen,
    phoneRequest,
    setPhoneOpen,
    setInventoryOpen,
    onPhoneNavigation,
    openHud,
  };
}
