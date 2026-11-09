import { useMissionClaim } from "@/hooks/use-mission-claim";
import { useMissions } from "@/hooks/use-missions";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Backpack,
  Bell,
  Bike,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  ChevronLeft,
  GraduationCap,
  HandCoins,
  HousePlus,
  MapPinned,
  MessageCircleCheck,
  MessageCircle,
  Gamepad2,
  Newspaper,
  School,
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
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneAppLoader } from "@/components/game/phone/PhoneAppLoader";
import { isSlowNetwork } from "@/lib/network-hint";
import { q, rpc, useGameAction } from "@/lib/game";
import { useQuery } from "@tanstack/react-query";
import { playGameSound } from "@/lib/game-audio";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE } from "@/lib/osogbo-weather";
import {
  Component,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import { type CommunityPhoneApp } from "@/components/game/CommunityPhoneApps";
import { PhoneComingSoonApp } from "@/components/game/phone/PhoneComingSoonApp";
import { OsunGistApp } from "@/components/game/phone/OsunGistApp";
import { PhoneMapApp } from "@/components/game/phone/PhoneMapApp";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  fullPageWorldApp,
  isFullPageWorldPath,
  handlePhoneLinkClick,
  reducePhoneNavigation,
} from "@/components/game/phone-navigation";
import "./phone.css";

// Start downloading the most-used phone app chunks early, so opening them is faster.
// Skipped when the visitor asked for less data or is on a slow connection.
function prefetchPhoneApps() {
  if (isSlowNetwork()) return;
  void Promise.allSettled([
    import("@/components/game/PlayerSocial"),
    import("@/components/game/phone/PhoneMarketApp"),
    import("@/components/game/phone/PhonePartyApp"),
    import("@/components/game/phone/PhoneBankApp"),
  ]);
}

// Lazy-loaded app views for performance on mobile and low-end Android
const PlayerSocial = lazy(() =>
  import("@/components/game/PlayerSocial").then((m) => ({ default: m.PlayerSocial })),
);
const PhoneMarketApp = lazy(() => import("@/components/game/phone/PhoneMarketApp"));
const PhonePartyApp = lazy(() => import("@/components/game/phone/PhonePartyApp"));
const PhoneBankApp = lazy(() => import("@/components/game/phone/PhoneBankApp"));
const PropertyPage = lazy(() =>
  import("@/routes/_authenticated/_game/property").then((m) => ({ default: m.PropertyPage })),
);
const RealEstatePage = lazy(() =>
  import("@/routes/_authenticated/_game/real-estate").then((m) => ({
    default: m.RealEstatePage,
  })),
);
const GamesApp = lazy(() =>
  import("@/components/game/mini-games/GamesApp").then((m) => ({ default: m.GamesApp })),
);
const PhoneJobList = lazy(() =>
  import("@/routes/_authenticated/_game/jobs").then((m) => ({ default: m.PhoneJobList })),
);
const CareerLifeApp = lazy(() =>
  import("@/components/game/CareerLifeApp").then((m) => ({ default: m.CareerLifeApp })),
);
const EducationPage = lazy(() =>
  import("@/routes/_authenticated/_game/education").then((m) => ({ default: m.EducationPage })),
);
const ProfilePage = lazy(() =>
  import("@/routes/_authenticated/_game/profile").then((m) => ({ default: m.ProfilePage })),
);
const InventoryPage = lazy(() =>
  import("@/routes/_authenticated/_game/inventory").then((m) => ({ default: m.InventoryPage })),
);
const SupportApp = lazy(() =>
  import("@/components/game/phone/SupportApp").then((m) => ({ default: m.SupportApp })),
);
const SettingsPage = lazy(() =>
  import("@/routes/_authenticated/_game/settings").then((m) => ({ default: m.SettingsPage })),
);
const BusinessInvestmentApp = lazy(() =>
  import("@/components/game/BusinessInvestmentApp").then((m) => ({
    default: m.BusinessInvestmentApp,
  })),
);
const BillboardAdApp = lazy(() =>
  import("@/components/game/BillboardAdApp").then((m) => ({ default: m.BillboardAdApp })),
);
const CommunityPhoneApps = lazy(() =>
  import("@/components/game/CommunityPhoneApps").then((m) => ({
    default: m.CommunityPhoneApps,
  })),
);
const PhoneCommunityServices = lazy(() => import("@/components/game/phone/PhoneCommunityServices"));
const ActivityCatalogueApp = lazy(() =>
  import("@/components/game/ActivityCatalogueApp").then((m) => ({
    default: m.ActivityCatalogueApp,
  })),
);

type PhoneAppDefinition = {
  label: string;
  icon: LucideIcon;
  tone: string;
  /** important: bright, layered tile. utility: flat, desaturated tile. */
  emphasis?: "important" | "utility";
};

const PHONE_APPS: readonly PhoneAppDefinition[] = [
  { label: "Activities", icon: ClipboardList, tone: "phone-app-green", emphasis: "important" },
  { label: "Bank", icon: Landmark, tone: "phone-app-blue", emphasis: "important" },
  { label: "Billboards", icon: PanelsTopLeft, tone: "phone-app-gold" },
  { label: "Businesses", icon: Building2, tone: "phone-app-green" },
  { label: "Calendar", icon: CalendarDays, tone: "phone-app-blue", emphasis: "utility" },
  { label: "Career Life", icon: BriefcaseBusiness, tone: "phone-app-gold" },
  { label: "Contribution", icon: HandCoins, tone: "phone-app-gold" },
  { label: "Education", icon: GraduationCap, tone: "phone-app-blue" },
  { label: "Food Delivery", icon: UtensilsCrossed, tone: "phone-app-coral" },
  { label: "Games", icon: Gamepad2, tone: "phone-app-coral" },
  { label: "Nigerian Schools", icon: School, tone: "phone-app-blue" },
  { label: "Inventory", icon: Backpack, tone: "phone-app-blue", emphasis: "utility" },
  { label: "Invest", icon: ChartNoAxesCombined, tone: "phone-app-gold" },
  { label: "Leaderboard", icon: Trophy, tone: "phone-app-gold" },
  { label: "Map", icon: MapPinned, tone: "phone-app-blue", emphasis: "important" },
  { label: "Market", icon: Store, tone: "phone-app-coral" },
  { label: "Messages", icon: MessageCircleCheck, tone: "phone-app-green", emphasis: "important" },
  { label: "Missions", icon: Target, tone: "phone-app-gold", emphasis: "important" },
  { label: "Notifications", icon: Bell, tone: "phone-app-gold", emphasis: "utility" },
  { label: "Okada Rides", icon: Bike, tone: "phone-app-green" },
  { label: "Osun Gist", icon: Newspaper, tone: "phone-app-blue" },
  { label: "Party", icon: PartyPopper, tone: "phone-app-coral" },
  { label: "Profile", icon: UserRound, tone: "phone-app-muted", emphasis: "utility" },
  { label: "Property", icon: HousePlus, tone: "phone-app-green" },
  { label: "Real Estate", icon: Building2, tone: "phone-app-green" },
  { label: "Settings", icon: Settings, tone: "phone-app-muted", emphasis: "utility" },
  { label: "Support", icon: MessageCircle, tone: "phone-app-blue", emphasis: "utility" },
  { label: "Town News", icon: Newspaper, tone: "phone-app-blue" },
] as const;

const COMMUNITY_APPS = new Set<CommunityPhoneApp>(["Leaderboard", "Town News"]);

/** Apps restyled to the Settings design (cards, sections, rows). Others keep their current look. */
const SETTINGS_STYLE_APPS = new Set([
  "Profile",
  "Support",
  "Inventory",
  "Town News",
  "Market",
  "Education",
  "Bank",
]);

class PhoneAppBoundary extends Component<
  { appName: string; onHome: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="phone-app-recovery" role="alert">
        <strong>{this.props.appName} could not open here.</strong>
        <p>Return to the launcher and try opening the app again.</p>
        <div>
          <button type="button" onClick={this.props.onHome}>
            Back to apps
          </button>
        </div>
      </div>
    );
  }
}

export function PhoneLauncher({
  className,
  compact = false,
  trigger,
  shortcutEditor,
  dock,
  open,
  onOpenChange,
}: {
  className?: string;
  compact?: boolean;
  trigger?: ReactNode;
  shortcutEditor?: ReactNode;
  dock?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(prefetchPhoneApps, 300);
    return () => window.clearTimeout(timer);
  }, []);

  const [navigation, dispatchNavigation] = useReducer(reducePhoneNavigation, {
    app: null,
    history: [],
  });
  const navigate = useNavigate();
  const href = useLocation({ select: (location) => location.href });
  const previousHref = useRef(href);
  const [internalOpen, setInternalOpen] = useState(false);
  const [messagePlayerId, setMessagePlayerId] = useState<string | undefined>();
  const dialogOpen = open ?? internalOpen;

  const setPhoneOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
      if (!next) {
        dispatchNavigation({ type: "close" });
        setMessagePlayerId(undefined);
      }
    },
    [onOpenChange, open],
  );
  useEffect(() => {
    if (!dialogOpen) {
      dispatchNavigation({ type: "close" });
      setMessagePlayerId(undefined);
    }
  }, [dialogOpen]);

  const {
    data: missions,
    userId,
    characterId,
    isLoading: missionsLoading,
    isError: missionsError,
    refetch: refetchMissions,
  } = useMissions();
  const claimMission = useMissionClaim(userId, characterId);
  const { data: notifications } = useQuery(q.notifications());
  const markRead = useGameAction(rpc.markRead);

  const missionCount = (missions ?? []).filter(
    (mission) => mission.status === "in_progress" || mission.status === "completed",
  ).length;
  const claimableMissionCount = (missions ?? []).filter(
    (mission) => mission.status === "completed",
  ).length;

  const openWorld = useCallback(
    (href: string) => {
      setPhoneOpen(false);
      void navigate({ href });
    },
    [navigate, setPhoneOpen],
  );

  useEffect(() => {
    if (href === previousHref.current) return;
    previousHref.current = href;
    if (isFullPageWorldPath(href.split(/[?#]/)[0]!)) setPhoneOpen(false);
  }, [href, setPhoneOpen]);

  const openApp = useCallback(
    (appName: string, search?: string) => {
      playGameSound("ui");
      const worldPath = fullPageWorldApp(appName);
      if (worldPath) {
        openWorld(worldPath + (search ?? ""));
        return;
      }
      dispatchNavigation({
        type: "open",
        app: appName,
        ...(search ? { search } : {}),
      });
    },
    [openWorld],
  );

  useEffect(() => {
    const openRequestedApp = (event: Event) => {
      const detail = (event as CustomEvent<{ app?: string; search?: string }>).detail;
      if (!detail?.app) return;
      if (!fullPageWorldApp(detail.app)) setPhoneOpen(true);
      openApp(detail.app, detail.search);
    };
    window.addEventListener("osogbo-open-phone-app", openRequestedApp);
    return () => window.removeEventListener("osogbo-open-phone-app", openRequestedApp);
  }, [openApp, setPhoneOpen]);

  useEffect(() => {
    const openMessages = (event: Event) => {
      const playerId = (event as CustomEvent<{ playerId?: string }>).detail?.playerId;
      setMessagePlayerId(playerId);
      openApp("Messages");
      setPhoneOpen(true);
    };
    window.addEventListener("osogbo-open-messages", openMessages);
    return () => window.removeEventListener("osogbo-open-messages", openMessages);
  }, [openApp, setPhoneOpen]);

  const now = useLiveClock();
  const phoneTime = now
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: OSOGBO_TIME_ZONE,
      }).format(now)
    : "--:--";

  const goBack = () => {
    playGameSound("ui");
    dispatchNavigation({ type: "back" });
  };

  const returnHome = () => {
    playGameSound("ui");
    dispatchNavigation({ type: "home" });
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

  // Render each supported app within the phone dialog.
  const renderAppContent = (appName: string) => {
    if (fullPageWorldApp(appName)) return null;

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

    if (appName === "People") return <PlayerSocial initialTab="players" phoneMode />;
    if (appName === "Profile") return <ProfilePage />;
    if (appName === "Inventory") return <InventoryPage />;

    if (appName === "Market" || appName === "Market Stalls") {
      return <PhoneMarketApp />;
    }

    if (appName === "Property") return <PropertyPage />;
    if (appName === "Real Estate" || appName === "Find homes" || appName === "Housing")
      return <RealEstatePage />;

    if (appName === "Party Life" || appName === "Party") {
      return <PhonePartyApp />;
    }

    if (appName === "Education" || appName === "Courses") return <EducationPage phoneMode />;
    if (appName === "Activities") return <ActivityCatalogueApp />;

    if (appName === "Bank") {
      return <PhoneBankApp />;
    }

    if (appName === "Career Life" || appName === "Jobs")
      return <CareerLifeApp phone opportunities={<PhoneJobList />} />;

    if (appName === "Invest" || appName === "Company" || appName === "Businesses") {
      const mode = appName === "Invest" ? "invest" : "company";
      const HeroIcon = mode === "invest" ? ChartNoAxesCombined : Building2;
      return (
        <div className="phone-finance-shell">
          <section className="phone-finance-hero">
            <span className="phone-finance-hero-icon">
              <HeroIcon aria-hidden="true" />
            </span>
            <div>
              <h2>{mode === "invest" ? "Invest" : "Businesses"}</h2>
              <p>
                {mode === "invest"
                  ? "Put your simulated savings to work."
                  : "Own a company and manage what it sells."}
              </p>
            </div>
          </section>
          <BusinessInvestmentApp mode={mode} />
        </div>
      );
    }

    if (appName === "Billboards") {
      return <BillboardAdApp />;
    }

    if (COMMUNITY_APPS.has(appName as CommunityPhoneApp)) {
      return <CommunityPhoneApps app={appName as CommunityPhoneApp} />;
    }

    if (
      appName === "Calendar" ||
      appName === "Food Delivery" ||
      appName === "Okada Rides" ||
      appName === "Contribution"
    ) {
      return <PhoneCommunityServices app={appName} />;
    }

    if (appName === "Missions") {
      return (
        <div className="phone-sub-app missions-app">
          <div className="phone-card missions-panel">
            <h4 className="missions-heading">Active Missions in Osogbo</h4>
            <p className="missions-intro">
              Complete goals around town and collect in-game cash and XP.
            </p>
            {missionsLoading ? (
              <p className="missions-state" role="status">
                Loading missions...
              </p>
            ) : missionsError ? (
              <div role="alert" className="missions-state">
                <p>Could not load missions.</p>
                <button
                  type="button"
                  className="missions-retry"
                  onClick={() => void refetchMissions()}
                >
                  Try again
                </button>
              </div>
            ) : missions && missions.length > 0 ? (
              <div className="missions-list">
                {missions.map((m) => (
                  <div key={m.id} className="missions-card">
                    <div className="missions-card-top">
                      <span className="missions-title">{m.mission?.title ?? "Town Goal"}</span>
                      <span className="missions-badge" data-status={m.status}>
                        {m.status === "completed"
                          ? "Ready to claim"
                          : m.status === "claimed"
                            ? "Claimed"
                            : "In progress"}
                      </span>
                    </div>
                    <p className="missions-desc">{m.mission?.description}</p>
                    {m.status === "completed" && (
                      <button
                        type="button"
                        disabled={claimMission.isPending}
                        onClick={() => claimMission.mutate(m.id)}
                        className="missions-claim"
                      >
                        Claim Reward
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="missions-state">No active missions right now.</p>
            )}
          </div>
        </div>
      );
    }

    if (appName === "Notifications") {
      return (
        <div className="phone-sub-app notifications-app">
          <div className="phone-card notifications-panel">
            <div className="notifications-head">
              <h4 className="notifications-heading">Town Notifications</h4>
              <button
                type="button"
                onClick={() => markRead.mutate()}
                className="notifications-clear"
              >
                Mark all read
              </button>
            </div>
            {notifications && notifications.length > 0 ? (
              <div className="notifications-list">
                {notifications.map((n) => (
                  <div key={n.id} className="notifications-item">
                    <strong className="notifications-kind">
                      {n.kind.replace(/_/g, " ").toUpperCase()}
                    </strong>
                    <p className="notifications-body">
                      {n.body ?? "Notification update from Osogbo."}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="notifications-state">No notifications yet.</p>
            )}
          </div>
        </div>
      );
    }

    if (appName === "Games") return <GamesApp />;
    if (appName === "Settings") return <SettingsPage />;
    if (appName === "Osun Gist") return <OsunGistApp />;
    if (appName === "Map") return <PhoneMapApp />;
    if (appName === "Support") return <SupportApp onHome={returnHome} />;

    // Fallback coming soon for any unbuilt or auxiliary app
    const appDef = PHONE_APPS.find((a) => a.label === appName);
    const Icon = appDef?.icon ?? Smartphone;
    return <PhoneComingSoonApp title={appName} icon={Icon} onHome={returnHome} />;
  };

  const phoneContent = (
    <>
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

        {/* Launcher Home Grid: visible when no app is active */}
        <div
          className="phone-app-grid"
          style={{ display: navigation.app === null ? "grid" : "none" }}
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
                <span
                  className={cn(
                    "phone-app-icon",
                    app.tone,
                    app.emphasis && `phone-app-${app.emphasis}`,
                  )}
                >
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
        {navigation.app &&
          (() => {
            const appName = navigation.app;
            return (
              <div key={appName} className="phone-app-view">
                <div className="phone-app-toolbar">
                  <button
                    type="button"
                    onClick={goBack}
                    className="phone-back-button"
                    aria-label={navigation.history.length ? "Go back" : "Back to apps"}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                    <span>{navigation.history.length ? "Back" : "Apps"}</span>
                  </button>
                  <strong>{appName}</strong>
                  <div className="w-8" aria-hidden="true" />
                </div>
                <div
                  className={cn(
                    "phone-app-body",
                    SETTINGS_STYLE_APPS.has(appName) && "phone-app-body--sx",
                  )}
                  onClickCapture={(event) => handlePhoneLinkClick(event, openApp, openWorld)}
                >
                  <PhoneAppBoundary key={appName} appName={appName} onHome={returnHome}>
                    <Suspense
                      fallback={
                        <PhoneAppLoader title={`Opening ${appName}…`} onHome={returnHome} />
                      }
                    >
                      {renderAppContent(appName)}
                    </Suspense>
                  </PhoneAppBoundary>
                </div>
              </div>
            );
          })()}

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
      <DialogClose type="button" aria-label="Close in-game phone">
        <X size={18} aria-hidden="true" />
      </DialogClose>
    </>
  );

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(next) => {
        // Opening from the Phone button always starts on the app grid; apps opened by an event still open directly.
        if (next) dispatchNavigation({ type: "home" });
        setPhoneOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
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
        )}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={dock ? "phone-dialog-shell" : "phone-dialog phone-ui-refresh"}
          style={{ zIndex: "var(--game-dialog-layer)", pointerEvents: dock ? "none" : undefined }}
        >
          {dock ? (
            <div className="phone-dialog phone-ui-refresh phone-dock-surface">{phoneContent}</div>
          ) : (
            phoneContent
          )}
          {dock}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export default PhoneLauncher;
