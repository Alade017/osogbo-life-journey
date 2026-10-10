import type { ReactNode } from "react";
import {
  Activity,
  BriefcaseBusiness,
  Package,
  ShoppingBag,
  Smile,
  Sparkles,
  Utensils,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { NeedName } from "@/lib/life-simulation";
import { NEED_NAMES, NEED_RULES, statusForNeed } from "@/lib/life-simulation";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { Link } from "@tanstack/react-router";

const NEED_ICONS = {
  hunger: Utensils,
  energy: Zap,
  hygiene: Sparkles,
  bladder: Activity,
  fun: Smile,
  social: Users,
} satisfies Record<NeedName, typeof Utensils>;

const QUICK_ACTIONS = [
  { to: "/jobs", label: "Find work", icon: BriefcaseBusiness, tone: "jobs" },
  { to: "/social", label: "Meet people", icon: Users, tone: "people" },
  { to: "/inventory", label: "Open inventory", icon: Package, tone: "inventory" },
  { to: "/market", label: "Visit market", icon: ShoppingBag, tone: "market" },
  { to: "/wallet", label: "Manage money", icon: Wallet, tone: "wallet" },
] as const;

export function CityMapDashboard({ children }: { children: ReactNode }) {
  const { simulation } = useGameTime();

  return (
    <div className="city-map-dashboard">
      <header className="city-map-heading">
        <div>
          <p className="city-map-eyebrow">THE CITY IS YOURS</p>
          <h1>Explore Osogbo</h1>
          <p>Meet your neighbours, find work, and discover what’s around you.</p>
        </div>
        <Link to="/home" search={{ visit: undefined }} className="city-map-home-link">
          Go home
        </Link>
      </header>

      <div className="city-map-layout">
        <main className="city-map-world">{children}</main>
        <aside className="city-map-sidebar" aria-label="Player overview and quick actions">
          <section className="city-map-status game-panel" aria-labelledby="city-status-heading">
            <div className="city-map-card-heading">
              <span className="city-map-card-icon" aria-hidden="true">
                <Sparkles size={17} />
              </span>
              <div>
                <p>HOW YOU’RE DOING</p>
                <h2 id="city-status-heading">Your status</h2>
              </div>
            </div>
            <ul className="city-map-needs">
              {NEED_NAMES.map((name) => {
                const Icon = NEED_ICONS[name];
                const value = Math.round(simulation.needs[name]);
                const status = statusForNeed(name, value);
                return (
                  <li className={`city-map-need is-${status}`} key={name}>
                    <div>
                      <span>
                        <Icon size={15} aria-hidden="true" />
                        {NEED_RULES[name].label}
                      </span>
                      <strong>{value}%</strong>
                    </div>
                    <span
                      className="city-map-need-track"
                      role="meter"
                      aria-label={NEED_RULES[name].label}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={value}
                    >
                      <i style={{ width: `${value}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

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
