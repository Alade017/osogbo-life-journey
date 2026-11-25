import { Link } from "@tanstack/react-router";
import { Backpack, Briefcase, House, Map } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

export function GameMobileNav({
  hidden = false,
  onNavigate,
  onInventoryOpen,
  onHudOpen,
  children,
}: {
  hidden?: boolean;
  onNavigate: () => void;
  onInventoryOpen: () => void;
  onHudOpen?: (hud: "jobs" | "map") => void;
  children?: ReactNode;
}) {
  const navigateHud = (event: MouseEvent<HTMLAnchorElement>, hud: "jobs" | "map") => {
    if (
      onHudOpen &&
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      onHudOpen(hud);
    } else onNavigate();
  };
  return (
    <nav
      className="gbb-nav"
      aria-label="Game navigation"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <Link
        to="/home"
        search={{ visit: undefined }}
        activeProps={{ className: "gbb-active" }}
        className="gbb-link"
        onClick={onNavigate}
      >
        <House className="h-4.75 w-4.75" />
        <span>Home</span>
      </Link>
      <Link
        to="/map"
        data-core-action="true"
        activeProps={{ className: "gbb-active" }}
        className="gbb-link"
        onClick={(event) => navigateHud(event, "map")}
      >
        <Map className="h-4.75 w-4.75" />
        <span>Map</span>
      </Link>
      <Link
        to="/jobs"
        aria-label="Career Life"
        data-core-action="true"
        activeProps={{ className: "gbb-active" }}
        className="gbb-link"
        onClick={onNavigate}
      >
        <Briefcase className="h-4.75 w-4.75" />
        <span>Career</span>
      </Link>
      <button
        type="button"
        className="gbb-link"
        data-core-action="true"
        onClick={onInventoryOpen}
        aria-label="Open inventory"
      >
        <Backpack className="h-4.75 w-4.75" aria-hidden="true" />
        <span>Inventory</span>
      </button>
      {children}
    </nav>
  );
}
