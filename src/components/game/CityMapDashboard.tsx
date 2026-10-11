import type { ReactNode } from "react";
import { BriefcaseBusiness, Package, ShoppingBag, Users, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";

const QUICK_ACTIONS = [
  { to: "/jobs", label: "Find work", icon: BriefcaseBusiness, tone: "jobs" },
  { to: "/social", label: "Meet people", icon: Users, tone: "people" },
  { to: "/inventory", label: "Open inventory", icon: Package, tone: "inventory" },
  { to: "/market", label: "Visit market", icon: ShoppingBag, tone: "market" },
  { to: "/wallet", label: "Manage money", icon: Wallet, tone: "wallet" },
] as const;

export function CityMapDashboard({ children }: { children: ReactNode }) {
  return (
    <div className="city-map-dashboard">
      <header className="city-map-heading">
        <div>
          <p className="city-map-eyebrow">THE CITY IS YOURS</p>
          <h1>Explore Osogbo</h1>
          <p>Meet your neighbours, find work, and discover what&apos;s around you.</p>
        </div>
        <Link to="/home" search={{ visit: undefined }} className="city-map-home-link">
          Go home
        </Link>
      </header>

      <div className="city-map-layout">
        <main className="city-map-world">{children}</main>
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
