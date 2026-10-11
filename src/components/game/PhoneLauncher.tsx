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
  Briefcase,
  Building2,
  House,
  Map,
  MessageCircle,
  Settings,
  ShoppingBag,
  UserRound,
  Wallet,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE } from "@/lib/osogbo-weather";

const PHONE_APPS = [
  { label: "Home", to: "/home", icon: House, tone: "phone-app-green", active: true },
  { label: "Property", to: "/house", icon: Building2, tone: "phone-app-green", active: true },
  { label: "Jobs", to: "/jobs", icon: Briefcase, tone: "phone-app-green", active: true },
  { label: "Bank", to: "/wallet", icon: Wallet, tone: "phone-app-gold", active: true },
  { label: "Market", to: "/market", icon: ShoppingBag, tone: "phone-app-green", active: true },
  { label: "Map", to: "/map", icon: Map, tone: "phone-app-blue", active: true },
  { label: "Social", to: "/social", icon: MessageCircle, tone: "phone-app-coral", active: true },
  { label: "Inventory", to: "/inventory", icon: Backpack, tone: "phone-app-blue", active: true },
  { label: "Profile", to: "/profile", icon: UserRound, tone: "phone-app-muted", active: true },
  { label: "Messages", to: "/social", icon: MessageCircle, tone: "phone-app-coral", active: true },
  { label: "Missions", to: "/missions", icon: Bell, tone: "phone-app-gold", active: true },
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
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn("phone-launcher", compact && "phone-launcher-compact", className)}
          aria-label="Open in-game phone"
        >
          <span className="phone-launcher-icon">
            <span />
          </span>
          <span className={compact ? "phone-compact-label" : undefined}>Phone</span>
        </button>
      </DialogTrigger>
      <DialogContent className="phone-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Your phone</DialogTitle>
          <DialogDescription>
            Tools for your day around Osogbo. Select an app to open it.
          </DialogDescription>
        </DialogHeader>
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
          <div className="phone-app-grid">
            {PHONE_APPS.map((app) => {
              const Icon = app.icon;
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
