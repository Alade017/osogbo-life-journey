import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Backpack,
  Bell,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  GraduationCap,
  HandCoins,
  HousePlus,
  LoaderCircle,
  MapPinned,
  MessagesSquare,
  Newspaper,
  PartyPopper,
  PanelsTopLeft,
  Target,
  Trophy,
  UtensilsCrossed,
  Landmark,
  Settings,
  Store,
  Smartphone,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { q, rpc, useGameAction } from "@/lib/game";
import { useQuery } from "@tanstack/react-query";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE } from "@/lib/osogbo-weather";
import { useEffect, useRef, useState, lazy, Suspense, type ReactNode } from "react";
import { type CommunityPhoneApp } from "@/components/game/CommunityPhoneApps";
import { PhoneComingSoonApp } from "@/components/game/phone/PhoneComingSoonApp";
import "./phone.css";

// Lazy-loaded app views for performance on mobile and low-end Android
const PlayerSocial = lazy(() =>
  import("@/components/game/PlayerSocial").then((m) => ({ default: m.PlayerSocial }))
);
const PhoneMarketApp = lazy(() => import("@/components/game/phone/PhoneMarketApp"));
const PhoneHousingApp = lazy(() => import("@/components/game/phone/PhoneHousingApp"));
const PhonePartyApp = lazy(() => import("@/components/game/phone/PhonePartyApp"));
const PhoneCareerApp = lazy(() => import("@/components/game/phone/PhoneCareerApp"));
const PhoneMapApp = lazy(() => import("@/components/game/phone/PhoneMapApp"));
const PhoneBankApp = lazy(() => import("@/components/game/phone/PhoneBankApp"));
const PhoneJobsApp = lazy(() => import("@/components/game/phone/PhoneJobsApp"));
const BusinessInvestmentApp = lazy(() =>
  import("@/components/game/BusinessInvestmentApp").then((m) => ({
    default: m.BusinessInvestmentApp,
  }))
);
const BillboardAdApp = lazy(() =>
  import("@/components/game/BillboardAdApp").then((m) => ({ default: m.BillboardAdApp }))
);
const CommunityPhoneApps = lazy(() =>
  import("@/components/game/CommunityPhoneApps").then((m) => ({
    default: m.CommunityPhoneApps,
  }))
);

type PhoneAppDefinition = {
  label: string;
  icon: LucideIcon;
  tone: string;
};

const PHONE_APPS: readonly PhoneAppDefinition[] = [
  { label: "Messages", icon: MessagesSquare, tone: "phone-app-coral" },
  { label: "Market", icon: Store, tone: "phone-app-coral" },
  { label: "Housing", icon: HousePlus, tone: "phone-app-green" },
  { label: "Party Life", icon: PartyPopper, tone: "phone-app-coral" },
  { label: "Career Life", icon: GraduationCap, tone: "phone-app-blue" },
  { label: "Map", icon: MapPinned, tone: "phone-app-blue" },
  { label: "Bank", icon: Landmark, tone: "phone-app-blue" },
  { label: "Jobs", icon: BriefcaseBusiness, tone: "phone-app-gold" },
  { label: "Property", icon: HousePlus, tone: "phone-app-green" },
  { label: "Find homes", icon: Building2, tone: "phone-app-green" },
  { label: "Party", icon: PartyPopper, tone: "phone-app-coral" },
  { label: "Education", icon: GraduationCap, tone: "phone-app-blue" },
  { label: "Invest", icon: ChartNoAxesCombined, tone: "phone-app-gold" },
  { label: "Company", icon: Building2, tone: "phone-app-green" },
  { label: "Billboards", icon: PanelsTopLeft, tone: "phone-app-gold" },
  { label: "Missions", icon: Target, tone: "phone-app-gold" },
  { label: "Notifications", icon: Bell, tone: "phone-app-gold" },
  { label: "Settings", icon: Settings, tone: "phone-app-muted" },
  { label: "Calendar", icon: CalendarDays, tone: "phone-app-blue" },
  { label: "Food Delivery", icon: UtensilsCrossed, tone: "phone-app-coral" },
  { label: "Okada Rides", icon: Bike, tone: "phone-app-green" },
  { label: "Contribution", icon: HandCoins, tone: "phone-app-gold" },
  { label: "Leaderboard", icon: Trophy, tone: "phone-app-gold" },
  { label: "Town News", icon: Newspaper, tone: "phone-app-blue" },
  { label: "Courses", icon: BookOpen, tone: "phone-app-blue" },
  { label: "Market Stalls", icon: Store, tone: "phone-app-green" },
  { label: "People", icon: UsersRound, tone: "phone-app-coral" },
  { label: "Inventory", icon: Backpack, tone: "phone-app-blue" },
  { label: "Profile", icon: UserRound, tone: "phone-app-muted" },
  { label: "Businesses", icon: Building2, tone: "phone-app-green" },
] as const;

const COMMUNITY_APPS = new Set<CommunityPhoneApp>([
  "Calendar",
  "Food Delivery",
  "Okada Rides",
  "Contribution",
  "Leaderboard",
  "Town News",
]);

function PhoneAppLoadingSpinner({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <LoaderCircle className="mb-2 h-7 w-7 animate-spin text-primary" />
      <p className="text-xs font-semibold">Opening {title}...</p>
    </div>
  );
}

export function PhoneLauncher({
  className,
  compact = false,
  trigger,
  shortcutEditor,
  onOpenChange,
}: {
  className?: string;
  compact?: boolean;
  trigger?: ReactNode;
  shortcutEditor?: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [openedApps, setOpenedApps] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [messagePlayerId, setMessagePlayerId] = useState<string | undefined>();

  const { data: missions } = useQuery(q.missions());
  const claimMission = useGameAction(rpc.claimMission);
  const { data: notifications } = useQuery(q.notifications());
  const markRead = useGameAction(rpc.markRead);

  const missionCount = (missions ?? []).filter(
    (mission) => mission.status === "in_progress" || mission.status === "completed"
  ).length;
  const claimableMissionCount = (missions ?? []).filter(
    (mission) => mission.status === "completed"
  ).length;

  useEffect(() => {
    const openMessages = (event: Event) => {
      const playerId = (event as CustomEvent<{ playerId?: string }>).detail?.playerId;
      setMessagePlayerId(playerId);
      openApp("Messages");
      setDialogOpen(true);
    };
    window.addEventListener("osogbo-open-messages", openMessages);
    return () => window.removeEventListener("osogbo-open-messages", openMessages);
  }, []);

  const now = useLiveClock();
  const phoneTime = now
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: OSOGBO_TIME_ZONE,
      }).format(now)
    : "--:--";

  const openApp = (appName: string) => {
    setOpenedApps((prev) => new Set(prev).add(appName));
    setActiveApp(appName);
  };

  const returnHome = () => {
    setActiveApp(null);
  };

  // Swipe-up gesture detection on home indicator
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current !== null && e.touches[0]) {
      const deltaY = touchStartY.current - e.touches[0].clientY;
      if (deltaY > 25) {
        returnHome();
        touchStartY.current = null;
      }
    }
  };
  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  // Renders the full view for each supported app
  const renderAppContent = (appName: string) => {
    if (appName === "Shortcuts") {
      return (
        <div className="p-3">
          {shortcutEditor ?? (
            <p className="text-xs text-muted-foreground">Configure quick-access shortcuts.</p>
          )}
        </div>
      );
    }

    if (appName === "Messages") {
      return (
        <PlayerSocial
          initialTab={messagePlayerId ? "players" : "messages"}
          initialPlayerId={messagePlayerId}
          phoneMode
        />
      );
    }

    if (appName === "Market" || appName === "Market Stalls") {
      return <PhoneMarketApp />;
    }

    if (appName === "Housing" || appName === "Property" || appName === "Find homes") {
      return <PhoneHousingApp />;
    }

    if (appName === "Party Life" || appName === "Party") {
      return <PhonePartyApp />;
    }

    if (appName === "Career Life" || appName === "Education" || appName === "Courses") {
      return <PhoneCareerApp />;
    }

    if (appName === "Map") {
      return <PhoneMapApp />;
    }

    if (appName === "Bank") {
      return <PhoneBankApp />;
    }

    if (appName === "Jobs") {
      return <PhoneJobsApp />;
    }

    if (appName === "Invest" || appName === "Company" || appName === "Businesses") {
      return <BusinessInvestmentApp mode={appName === "Invest" ? "invest" : "company"} />;
    }

    if (appName === "Billboards") {
      return <BillboardAdApp />;
    }

    if (COMMUNITY_APPS.has(appName as CommunityPhoneApp)) {
      return <CommunityPhoneApps app={appName as CommunityPhoneApp} />;
    }

    if (appName === "Missions") {
      return (
        <div className="phone-sub-app p-3 space-y-3">
          <div className="phone-card p-3">
            <h4 className="font-bold text-sm mb-1">Active Missions in Osogbo</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Complete goals around town and collect in-game cash and XP.
            </p>
            {missions && missions.length > 0 ? (
              <div className="space-y-2">
                {missions.map((m) => (
                  <div key={m.id} className="p-2.5 rounded-xl border border-border bg-card space-y-1.5">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs">{m.mission?.title ?? "Town Goal"}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          m.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-600"
                            : "bg-amber-500/20 text-amber-600"
                        }`}
                      >
                        {m.status === "completed" ? "Completed" : "In Progress"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{m.mission?.description}</p>
                    {m.status === "completed" && (
                      <button
                        type="button"
                        disabled={claimMission.isPending}
                        onClick={() => claimMission.mutate(m.id)}
                        className="w-full py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 mt-1"
                      >
                        Claim Reward
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">No active missions right now.</p>
            )}
          </div>
        </div>
      );
    }

    if (appName === "Notifications") {
      return (
        <div className="phone-sub-app p-3 space-y-3">
          <div className="phone-card p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <h4 className="font-bold text-sm">Town Notifications</h4>
              <button
                type="button"
                onClick={() => markRead.mutate()}
                className="text-xs font-bold text-primary hover:underline"
              >
                Mark all read
              </button>
            </div>
            {notifications && notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="p-2 rounded-lg border border-border text-xs space-y-0.5">
                    <strong className="block font-semibold">{n.kind.replace(/_/g, " ").toUpperCase()}</strong>
                    <p className="text-muted-foreground">{n.body ?? "Notification update from Osogbo."}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">No notifications yet.</p>
            )}
          </div>
        </div>
      );
    }

    if (appName === "Settings") {
      return (
        <div className="phone-sub-app p-3 space-y-3">
          <div className="phone-card p-3 space-y-3">
            <h4 className="font-bold text-sm border-b border-border/40 pb-2">Device Preferences</h4>
            <div className="flex items-center justify-between text-xs py-1">
              <span>Haptic Feedback</span>
              <span className="font-bold text-emerald-600">Enabled</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span>Network Carrier</span>
              <span className="font-bold">OSUN WAT 4G</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span>Timezone</span>
              <span className="font-bold">Africa/Lagos (WAT)</span>
            </div>
          </div>
        </div>
      );
    }

    // Fallback coming soon for any unbuilt or auxiliary app
    const appDef = PHONE_APPS.find((a) => a.label === appName);
    const Icon = appDef?.icon ?? Smartphone;
    return <PhoneComingSoonApp title={appName} icon={Icon} onHome={returnHome} />;
  };

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        onOpenChange?.(open);
        if (!open) {
          setActiveApp(null);
          setMessagePlayerId(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={cn("phone-launcher", compact && "phone-launcher-compact", className)}
            aria-label="Open in-game phone"
          >
            <span className="phone-launcher-icon">
              <Smartphone size={19} aria-hidden="true" />
            </span>
            <span className={compact ? "phone-compact-label" : undefined}>Phone</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="phone-dialog">
        <DialogTitle className="sr-only">In-game phone</DialogTitle>
        <div className="phone-screen">
          {/* Status Bar */}
          <div className="phone-status">
            <span className="phone-status-time">{phoneTime}</span>
            <span className="phone-status-brand">OSUN WAT</span>
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

          {/* Launcher Home Grid: visible when activeApp is null */}
          <div
            className="phone-app-grid"
            style={{ display: activeApp === null ? "grid" : "none" }}
          >
            {shortcutEditor && (
              <button
                type="button"
                className="phone-app"
                onClick={() => openApp("Shortcuts")}
                aria-label="Open Shortcuts"
              >
                <span className="phone-app-icon phone-app-muted">
                  <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>Shortcuts</span>
              </button>
            )}

            {PHONE_APPS.map((app) => {
              const Icon = app.icon;
              const badge =
                app.label === "Missions" && missionCount > 0
                  ? missionCount > 9
                    ? "9+"
                    : missionCount
                  : null;

              return (
                <button
                  type="button"
                  className="phone-app"
                  key={app.label}
                  onClick={() => openApp(app.label)}
                  aria-label={`Open ${app.label}`}
                >
                  <span className={cn("phone-app-icon", app.tone)}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {badge ? (
                      <i className="phone-app-badge" aria-label={`${badge} active notifications`}>
                        {badge}
                      </i>
                    ) : null}
                  </span>
                  <span>{app.label}</span>
                </button>
              );
            })}
          </div>

          {/* Opened Apps: retain state when navigating back and forth */}
          {Array.from(openedApps).map((appName) => {
            const isVisible = activeApp === appName;
            return (
              <div
                key={appName}
                className="phone-app-view"
                style={{ display: isVisible ? "flex" : "none" }}
              >
                <div className="phone-app-toolbar">
                  <button
                    type="button"
                    onClick={returnHome}
                    className="phone-back-button"
                    aria-label="Back to apps"
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                    <span>Apps</span>
                  </button>
                  <strong>{appName}</strong>
                  <div className="w-8" aria-hidden="true" />
                </div>
                <div className="phone-app-body">
                  <Suspense fallback={<PhoneAppLoadingSpinner title={appName} />}>
                    {renderAppContent(appName)}
                  </Suspense>
                </div>
              </div>
            );
          })}

          {/* Home indicator bar button with swipe-up support */}
          <button
            type="button"
            className="phone-home-bar-button"
            onClick={returnHome}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            aria-label="Return to phone apps"
            title="Home"
          >
            <span className="phone-home-indicator" aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PhoneLauncher;
