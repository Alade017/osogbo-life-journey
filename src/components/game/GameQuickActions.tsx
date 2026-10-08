import { Link } from "@tanstack/react-router";
import { BarChart3, Briefcase, Map, Package } from "lucide-react";
import { PhoneLauncher } from "@/components/game/PhoneLauncher";

const ACTIONS = [
  { label: "City", to: "/map", icon: Map, tone: "action-map" },
  { label: "Jobs", to: "/jobs", icon: Briefcase, tone: "action-jobs" },
  { label: "Inventory", to: "/inventory", icon: Package, tone: "action-inventory" },
  { label: "Stats", to: "/profile", icon: BarChart3, tone: "action-stats" },
] as const;

export function GameQuickActions() {
  return (
    <section className="quick-actions" aria-label="Quick actions">
      <div className="quick-actions-heading">
        <h2 className="font-display text-base font-bold text-ink">Quick actions</h2>
      </div>
      <div className="quick-action-grid">
        {ACTIONS.map(({ label, to, icon: Icon, tone }) => (
          <Link key={label} to={to} className="quick-action">
            <span className={`quick-action-icon ${tone}`}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span>{label}</span>
          </Link>
        ))}
        <PhoneLauncher className="quick-action phone-action" />
      </div>
    </section>
  );
}
