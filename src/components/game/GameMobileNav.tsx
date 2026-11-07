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
        <span>City</span>
      </Link>
      <Link
        to="/jobs"
        activeProps={{ className: "gbb-active" }}
        className="gbb-link"
        onClick={onNavigate}
      >
        <Briefcase className="h-4.75 w-4.75" />
        <span>Career Life</span>
      </Link>
      {children}
    </nav>
  );
}
