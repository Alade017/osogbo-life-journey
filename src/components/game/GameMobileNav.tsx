import { Link } from "@tanstack/react-router";
import { Briefcase, House, Map } from "lucide-react";
import type { ReactNode } from "react";

export function GameMobileNav({
  hidden = false,
  onNavigate,
  children,
}: {
  hidden?: boolean;
  onNavigate: () => void;
  children?: ReactNode;
}) {
  return (
    <nav
      className="game-mobile-nav game-floating-nav game-persistent-dock"
      aria-label="Game navigation"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <Link
        to="/home"
        search={{ visit: undefined }}
        activeProps={{ className: "mobile-nav-active" }}
        className="mobile-nav-link"
        onClick={onNavigate}
      >
        <House className="h-4.75 w-4.75" />
        <span>Home</span>
      </Link>
      <Link
        to="/map"
        activeProps={{ className: "mobile-nav-active" }}
        className="mobile-nav-link"
        onClick={onNavigate}
      >
        <Map className="h-4.75 w-4.75" />
        <span>City</span>
      </Link>
      <Link
        to="/jobs"
        activeProps={{ className: "mobile-nav-active" }}
        className="mobile-nav-link"
        onClick={onNavigate}
      >
        <Briefcase className="h-4.75 w-4.75" />
        <span>Career Life</span>
      </Link>
      {children}
    </nav>
  );
}
