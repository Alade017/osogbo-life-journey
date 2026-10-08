import { Link } from "@tanstack/react-router";
import { BarChart3, Briefcase, House, Map, Package, ShoppingBag, Users } from "lucide-react";
import { PhoneLauncher } from "@/components/game/PhoneLauncher";

const ACTIONS = [
  { label: "City", to: "/map", icon: Map, tone: "action-map" },
  { label: "Jobs", to: "/jobs", icon: Briefcase, tone: "action-jobs" },
  { label: "Inventory", to: "/inventory", icon: Package, tone: "action-inventory" },
  { label: "Home", to: "/home", icon: House, tone: "action-home" },
  { label: "Stats", to: "/profile", icon: BarChart3, tone: "action-stats" },
] as const;

export function GameQuickActions() {
  return (
    <section className="quick-actions" aria-label="Quick actions">
      <div className="quick-actions-heading">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
          On your phone
        </p>
        <h2 className="font-display text-base font-bold text-white">Quick actions</h2>
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
        <span
          className="quick-action quick-action-disabled"
          aria-disabled="true"
          title="Shop is not available yet"
        >
          <span className="quick-action-icon action-shop">
            <ShoppingBag className="h-4.5 w-4.5" />
          </span>
          <span>Shop</span>
          <small>Later</small>
        </span>
        <span
          className="quick-action quick-action-disabled"
          aria-disabled="true"
          title="Social features are not available yet"
        >
          <span className="quick-action-icon action-social">
            <Users className="h-4.5 w-4.5" />
          </span>
          <span>Social</span>
          <small>Later</small>
        </span>
      </div>
    </section>
  );
}
