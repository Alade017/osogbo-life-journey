import { Link } from "@tanstack/react-router";
import { Backpack, Briefcase, House, Map } from "lucide-react";
import type { ReactNode } from "react";

export function GameMobileNav({
  hidden = false,
  onNavigate,
  onInventoryOpen,
  children,
}: {
  hidden?: boolean;
  onNavigate: () => void;
  onInventoryOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <nav
      className="gbb-nav"
      aria-label="Game navigation"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <Link
        to="/home"
        title="Home"
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
        title="Map"
        data-core-action="true"
        activeProps={{ className: "gbb-active" }}
        className="gbb-link"
        onClick={onNavigate}
      >
        <Map className="h-4.75 w-4.75" />
        <span>Map</span>
      </Link>
      <Link
        to="/jobs"
        title="Career"
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
        title="Inventory"
      >
        <Backpack className="h-4.75 w-4.75" aria-hidden="true" />
        <span>Inventory</span>
      </button>
      {children}
    </nav>
  );
}
