import { Link } from "@tanstack/react-router";
import { Backpack, Briefcase, House, Map } from "lucide-react";
import type { ReactNode } from "react";

export function GameMobileNav({
  hidden = false,
  shortLabels = false,
  onNavigate,
  onInventoryOpen,
  children,
}: {
  hidden?: boolean;
  shortLabels?: boolean;
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
        activeProps={{ className: "gbb-active" }}
        className="gbb-link"
        onClick={onNavigate}
      >
        <Map className="h-4.75 w-4.75" />
        <span>Map</span>
      </Link>
      <Link
        to="/jobs"
        activeProps={{ className: "gbb-active" }}
        className="gbb-link"
        onClick={onNavigate}
      >
        <Briefcase className="h-4.75 w-4.75" />
        <span>{shortLabels ? "Career" : "Career Life"}</span>
      </Link>
      <button
        type="button"
        className="gbb-link"
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
