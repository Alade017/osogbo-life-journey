import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Backpack,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  House,
  HousePlus,
  MapPinned,
  MessagesSquare,
  PanelsTopLeft,
  Target,
  Landmark,
  Settings,
  Store,
  Smartphone,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE } from "@/lib/osogbo-weather";
import { useState } from "react";
import { PlayerSocial } from "@/components/game/PlayerSocial";
import { BusinessInvestmentApp } from "@/components/game/BusinessInvestmentApp";
import { BillboardAdApp } from "@/components/game/BillboardAdApp";
import "./phone.css";

const PHONE_APPS = [
  { label: "Home", to: "/home", icon: House, tone: "phone-app-green", active: true },
  { label: "Property", to: "/house", icon: HousePlus, tone: "phone-app-green", active: true },
  { label: "Jobs", to: "/jobs", icon: BriefcaseBusiness, tone: "phone-app-gold", active: true },
  { label: "Bank", to: "/wallet", icon: Landmark, tone: "phone-app-blue", active: true },
  { label: "Market", to: "/market", icon: Store, tone: "phone-app-coral", active: true },
  { label: "Map", to: "/map", icon: MapPinned, tone: "phone-app-blue", active: true },
  { label: "Social", to: "/social", icon: UsersRound, tone: "phone-app-coral", active: true },
  { label: "Inventory", to: "/inventory", icon: Backpack, tone: "phone-app-blue", active: true },
  { label: "Profile", to: "/profile", icon: UserRound, tone: "phone-app-muted", active: true },
  { label: "Messages", to: "/social", icon: MessagesSquare, tone: "phone-app-coral", active: true },
  {
    label: "Invest",
    to: "/wallet",
    icon: ChartNoAxesCombined,
    tone: "phone-app-gold",
    active: true,
  },
  { label: "Company", to: "/wallet", icon: Building2, tone: "phone-app-green", active: true },
  { label: "Billboards", to: null, icon: PanelsTopLeft, tone: "phone-app-gold", active: true },
  { label: "Missions", to: "/missions", icon: Target, tone: "phone-app-gold", active: true },
  {
    label: "Notifications",
    to: "/notifications",
    icon: Bell,
    tone: "phone-app-gold",
    active: true,
  },
  { label: "Settings", to: "/settings", icon: Settings, tone: "phone-app-muted", active: true },
] as const;

export function PhoneLauncher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const now = useLiveClock();
  const phoneTime = now
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: OSOGBO_TIME_ZONE,
      }).format(now)
    : "--:--";

  return (
    <Dialog onOpenChange={(open) => !open && setActiveApp(null)}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn("phone-launcher", compact && "phone-launcher-compact", className)}
          aria-label="Open in-game phone"
        >
          <span className="phone-launcher-icon">
            <Smartphone size={19} aria-hidden="true" />
          </span>
          <span className={compact ? "phone-compact-label" : undefined}>Phone</span>
        </button>
      </DialogTrigger>
      <DialogContent className="phone-dialog">
        <DialogTitle className="sr-only">In-game phone</DialogTitle>
        <div className="phone-screen">
          <div className="phone-status">
            <span className="phone-status-time">{phoneTime}</span>
            <span className="phone-status-brand">OSOGBO · WAT</span>
            <span className="phone-status-indicators" aria-label="Game phone status">
              <span className="phone-signal" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="phone-battery" aria-hidden="true">
                <i />
              </span>
            </span>
          </div>
          {activeApp === "Messages" ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  ‹ <span>Apps</span>
                </button>
                <strong>Messages</strong>
                <span aria-hidden="true" />
              </div>
              <PlayerSocial initialTab="messages" phoneMode />
            </div>
          ) : activeApp === "Invest" || activeApp === "Company" ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  ‹ <span>Apps</span>
                </button>
                <strong>{activeApp}</strong>
                <span aria-hidden="true" />
              </div>
              <BusinessInvestmentApp mode={activeApp === "Invest" ? "invest" : "company"} />
            </div>
          ) : activeApp === "Billboards" ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  ‹ <span>Apps</span>
                </button>
                <strong>Billboards</strong>
                <span aria-hidden="true" />
              </div>
              <BillboardAdApp />
            </div>
          ) : (
            <>
              <div className="phone-app-grid">
                {PHONE_APPS.map((app) => {
                  const Icon = app.icon;
                  if (
                    app.label === "Messages" ||
                    app.label === "Invest" ||
                    app.label === "Company" ||
                    app.label === "Billboards"
                  ) {
                    return (
                      <button
                        type="button"
                        className="phone-app"
                        key={app.label}
                        onClick={() => setActiveApp(app.label)}
                      >
                        <span className={cn("phone-app-icon", app.tone)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>{app.label}</span>
                      </button>
                    );
                  }
                  return app.active && app.to ? (
                    <DialogClose asChild key={app.label}>
                      <Link to={app.to} className="phone-app">
                        <span className={cn("phone-app-icon", app.tone)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>{app.label}</span>
                      </Link>
                    </DialogClose>
                  ) : (
                    <div
                      className="phone-app phone-app-disabled"
                      key={app.label}
                      aria-disabled="true"
                      title="Not available yet"
                    >
                      <span className={cn("phone-app-icon", app.tone)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>{app.label}</span>
                      <small>Later</small>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="phone-home-indicator" aria-hidden="true" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
