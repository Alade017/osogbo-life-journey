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
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { q } from "@/lib/game";
import { useQuery } from "@tanstack/react-query";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE } from "@/lib/osogbo-weather";
import { useEffect, useState, type ReactNode } from "react";
import { PlayerSocial } from "@/components/game/PlayerSocial";
import { BusinessInvestmentApp } from "@/components/game/BusinessInvestmentApp";
import { BillboardAdApp } from "@/components/game/BillboardAdApp";
import { CommunityPhoneApps, type CommunityPhoneApp } from "@/components/game/CommunityPhoneApps";
import { CourseAndStallApps, type CourseAndStallApp } from "@/components/game/CourseAndStallApps";
import {
  PhoneContentPreview,
  type PhoneContentPreviewApp,
} from "@/components/game/PhoneContentPreview";
import "./phone.css";

// Some apps open a specific section of their page.
function phoneAppLinkProps(to: string) {
  if (to === "/social") return { search: { playerId: undefined } };
  // Party opens on Events so players can organize a party from the phone.
  if (to === "/party") return { search: { tab: "events" as const } };
  return {};
}

const PHONE_APPS = [
  { label: "Property", to: "/property", icon: HousePlus, tone: "phone-app-green", active: true },
  {
    label: "Find homes",
    to: "/properties",
    icon: Building2,
    tone: "phone-app-green",
    active: true,
  },
  { label: "Jobs", to: "/jobs", icon: BriefcaseBusiness, tone: "phone-app-gold", active: true },
  { label: "Party", to: "/party", icon: PartyPopper, tone: "phone-app-coral", active: true },
  { label: "Bank", to: null, icon: Landmark, tone: "phone-app-blue", active: true },
  { label: "Market", to: null, icon: Store, tone: "phone-app-coral", active: true },
  {
    label: "Education",
    to: null,
    icon: GraduationCap,
    tone: "phone-app-blue",
    active: true,
  },
  { label: "Map", to: null, icon: MapPinned, tone: "phone-app-blue", active: true },
  { label: "People", to: null, icon: UsersRound, tone: "phone-app-coral", active: true },
  { label: "Inventory", to: null, icon: Backpack, tone: "phone-app-blue", active: true },
  { label: "Profile", to: null, icon: UserRound, tone: "phone-app-muted", active: true },
  { label: "Messages", to: "/social", icon: MessagesSquare, tone: "phone-app-coral", active: true },
  {
    label: "Invest",
    to: "/wallet",
    icon: ChartNoAxesCombined,
    tone: "phone-app-gold",
    active: true,
  },
  { label: "Company", to: "/wallet", icon: Building2, tone: "phone-app-green", active: true },
  {
    label: "Businesses",
    to: null,
    icon: Building2,
    tone: "phone-app-green",
    active: true,
  },
  { label: "Billboards", to: null, icon: PanelsTopLeft, tone: "phone-app-gold", active: true },
  { label: "Missions", to: null, icon: Target, tone: "phone-app-gold", active: true },
  {
    label: "Notifications",
    to: null,
    icon: Bell,
    tone: "phone-app-gold",
    active: true,
  },
  { label: "Settings", to: null, icon: Settings, tone: "phone-app-muted", active: true },
  { label: "Calendar", to: null, icon: CalendarDays, tone: "phone-app-blue", active: true },
  {
    label: "Food Delivery",
    to: null,
    icon: UtensilsCrossed,
    tone: "phone-app-coral",
    active: true,
  },
  { label: "Okada Rides", to: null, icon: Bike, tone: "phone-app-green", active: true },
  { label: "Contribution", to: null, icon: HandCoins, tone: "phone-app-gold", active: true },
  { label: "Leaderboard", to: null, icon: Trophy, tone: "phone-app-gold", active: true },
  { label: "Town News", to: null, icon: Newspaper, tone: "phone-app-blue", active: true },
  { label: "Courses", to: null, icon: BookOpen, tone: "phone-app-blue", active: true },
  { label: "Market Stalls", to: null, icon: Store, tone: "phone-app-green", active: true },
] as const;

const COMMUNITY_APPS = new Set<CommunityPhoneApp>([
  "Calendar",
  "Food Delivery",
  "Okada Rides",
  "Contribution",
  "Leaderboard",
  "Town News",
]);
const COURSE_AND_STALL_APPS = new Set<CourseAndStallApp>(["Courses", "Market Stalls"]);
const PREVIEW_APPS = new Set<PhoneContentPreviewApp>([
  "Bank",
  "Market",
  "Education",
  "Map",
  "People",
  "Inventory",
  "Profile",
  "Businesses",
  "Missions",
  "Notifications",
  "Settings",
]);

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [messagePlayerId, setMessagePlayerId] = useState<string | undefined>();
  const { data: missions } = useQuery(q.missions());
  const missionCount = (missions ?? []).filter(
    (mission) => mission.status === "in_progress" || mission.status === "completed",
  ).length;
  const claimableMissionCount = (missions ?? []).filter(
    (mission) => mission.status === "completed",
  ).length;
  useEffect(() => {
    const openMessages = (event: Event) => {
      const playerId = (event as CustomEvent<{ playerId?: string }>).detail?.playerId;
      setMessagePlayerId(playerId);
      setActiveApp("Messages");
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
          {activeApp === "Shortcuts" ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  <ChevronLeft size={16} aria-hidden="true" /> <span>Apps</span>
                </button>
                <strong>Shortcuts</strong>
                <span aria-hidden="true" />
              </div>
              {shortcutEditor}
            </div>
          ) : activeApp === "Messages" ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  <ChevronLeft size={16} aria-hidden="true" /> <span>Apps</span>
                </button>
                <strong>Messages</strong>
                <span aria-hidden="true" />
              </div>
              <PlayerSocial
                initialTab={messagePlayerId ? "players" : "messages"}
                initialPlayerId={messagePlayerId}
                phoneMode
              />
            </div>
          ) : activeApp === "Invest" || activeApp === "Company" ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  <ChevronLeft size={16} aria-hidden="true" /> <span>Apps</span>
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
                  <ChevronLeft size={16} aria-hidden="true" /> <span>Apps</span>
                </button>
                <strong>Billboards</strong>
                <span aria-hidden="true" />
              </div>
              <BillboardAdApp />
            </div>
          ) : activeApp && COMMUNITY_APPS.has(activeApp as CommunityPhoneApp) ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  <ChevronLeft size={16} aria-hidden="true" /> <span>Apps</span>
                </button>
                <strong>{activeApp}</strong>
                <span aria-hidden="true" />
              </div>
              <CommunityPhoneApps app={activeApp as CommunityPhoneApp} />
            </div>
          ) : activeApp && COURSE_AND_STALL_APPS.has(activeApp as CourseAndStallApp) ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  <ChevronLeft size={16} aria-hidden="true" /> <span>Apps</span>
                </button>
                <strong>{activeApp}</strong>
                <span aria-hidden="true" />
              </div>
              <CourseAndStallApps app={activeApp as CourseAndStallApp} />
            </div>
          ) : activeApp && PREVIEW_APPS.has(activeApp as PhoneContentPreviewApp) ? (
            <div className="phone-app-view">
              <div className="phone-app-toolbar">
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  aria-label="Back to phone apps"
                >
                  <ChevronLeft size={16} aria-hidden="true" /> <span>Apps</span>
                </button>
                <strong>{activeApp}</strong>
                <span aria-hidden="true" />
              </div>
              <PhoneContentPreview app={activeApp as PhoneContentPreviewApp} />
            </div>
          ) : (
            <>
              {missionCount > 0 && (
                <DialogClose asChild>
                  <Link to="/missions" className="phone-mission-summary">
                    <span className="phone-app-icon phone-app-gold">
                      <Target className="h-5 w-5" />
                    </span>
                    <span>
                      <strong>Missions</strong>
                      <small>
                        {claimableMissionCount
                          ? `${claimableMissionCount} reward${claimableMissionCount === 1 ? "" : "s"} ready to claim`
                          : `${missionCount} active mission${missionCount === 1 ? "" : "s"}`}
                      </small>
                    </span>
                  </Link>
                </DialogClose>
              )}
              <div className="phone-app-grid">
                {shortcutEditor && (
                  <button
                    type="button"
                    className="phone-app"
                    onClick={() => setActiveApp("Shortcuts")}
                  >
                    <span className="phone-app-icon phone-app-muted">
                      <SlidersHorizontal className="h-5 w-5" />
                    </span>
                    <span>Shortcuts</span>
                  </button>
                )}
                {PHONE_APPS.map((app) => {
                  const Icon = app.icon;
                  if (
                    app.label === "Messages" ||
                    app.label === "Invest" ||
                    app.label === "Company" ||
                    app.label === "Billboards" ||
                    COMMUNITY_APPS.has(app.label as CommunityPhoneApp) ||
                    COURSE_AND_STALL_APPS.has(app.label as CourseAndStallApp) ||
                    PREVIEW_APPS.has(app.label as PhoneContentPreviewApp)
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
                          {app.label === "Missions" && missionCount > 0 ? (
                            <i
                              className="phone-app-badge"
                              aria-label={`${missionCount} active missions`}
                            >
                              {missionCount > 9 ? "9+" : missionCount}
                            </i>
                          ) : null}
                        </span>
                        <span>{app.label}</span>
                      </button>
                    );
                  }
                  return app.active && app.to ? (
                    <DialogClose asChild key={app.label}>
                      <Link to={app.to} {...phoneAppLinkProps(app.to)} className="phone-app">
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
