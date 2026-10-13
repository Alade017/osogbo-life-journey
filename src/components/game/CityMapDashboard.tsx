import { useState, type ReactNode } from "react";
import { BriefcaseBusiness, Package, ShoppingBag, Users, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { OsogboMap } from "@/components/game/OsogboMap";

const QUICK_ACTIONS = [
  { to: "/jobs", label: "Find work", icon: BriefcaseBusiness, tone: "jobs" },
  { to: "/social", label: "Meet people", icon: Users, tone: "people" },
  { to: "/inventory", label: "Open inventory", icon: Package, tone: "inventory" },
  { to: "/market", label: "Visit market", icon: ShoppingBag, tone: "market" },
  { to: "/wallet", label: "Manage money", icon: Wallet, tone: "wallet" },
] as const;

export function CityMapDashboard({ children }: { children: ReactNode }) {
  const [view, setView] = useState<"atlas" | "neighborhood">("atlas");
  return (
    <div className="city-map-dashboard">
      <header className="city-map-heading">
        <div>
          <p className="city-map-eyebrow">THE CITY IS YOURS</p>
          <h1>Explore Osogbo</h1>
          <p>Choose a place, see what&apos;s available, then go explore.</p>
        </div>
        <Link to="/home" search={{ visit: undefined }} className="city-map-home-link">
          Go home
        </Link>
      </header>

      <div className="city-map-view-switch" role="group" aria-label="Map view">
        <button type="button" aria-pressed={view === "atlas"} onClick={() => setView("atlas")}>
          City atlas
        </button>
        <button
          type="button"
          aria-pressed={view === "neighborhood"}
          onClick={() => setView("neighborhood")}
        >
          3D neighborhood
        </button>
      </div>
      <p className="city-map-hint">
        {view === "atlas" ? (
          "Explore mapped places, filter by type or neighborhood, and open a location for details."
        ) : (
          <>
            Tap a building or neighbour for details. Choose <strong>Go</strong> when you&apos;re
            ready to walk over.
          </>
        )}
      </p>

      <div className={`city-map-layout is-${view}`}>
        <main className={`city-map-world is-${view}`}>
          {view === "atlas" ? <OsogboMap /> : children}
        </main>
        <aside className="city-map-sidebar" aria-label="Quick actions">
          <section
            className="city-map-quick-actions game-panel"
            aria-labelledby="city-actions-heading"
          >
            <h2 id="city-actions-heading">Quick actions</h2>
            <div>
              {QUICK_ACTIONS.map(({ to, label, icon: Icon, tone }) => (
                <Link className={`city-quick-action is-${tone}`} key={to} to={to}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
