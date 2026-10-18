import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  House,
  HousePlus,
  Map,
  Package,
  Settings,
  ShoppingBag,
  UserRound,
  Wallet,
} from "lucide-react";
import { q, rpc } from "@/lib/game";
import { Logo } from "@/components/game/Logo";
import { GameDataUnavailable, LoadingState } from "@/components/game/ui";
import { cn } from "@/lib/utils";
import { GameHUD } from "@/components/game/GameHUD";
import { GameNeedsRail } from "@/components/game/GameNeedsRail";
import { PhoneLauncher } from "@/components/game/PhoneLauncher";
import { HousingChooser } from "@/components/game/housing/HousingChooser";
import { GameTimeProvider } from "@/components/game/GameTimeProvider";
import { WorldEnvironment } from "@/components/game/WorldEnvironment";
import { gameTimeFromCharacter } from "@/lib/game-time";
import { supabase } from "@/integrations/supabase/client";
import { playerStateFromRows } from "@/lib/player-state";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import {
  configureGameMusic,
  disableGameAudio,
  startGameAudioSession,
  playGameSound,
} from "@/lib/game-audio";
import "@/components/game/game-navigation.css";
import "@/components/game/game-cards.css";

export const Route = createFileRoute("/_authenticated/_game")({
  component: GameLayout,
});

const NAV_GROUPS = [
  {
    label: "YOUR CITY",
    items: [
      { to: "/home", label: "Home", icon: House },
      { to: "/map", label: "City", icon: Map },
    ],
  },
  {
    label: "DAILY LIFE",
    items: [
      { to: "/house", label: "Property", icon: House },
      { to: "/properties", label: "Find homes", icon: HousePlus },
      { to: "/jobs", label: "Jobs", icon: Briefcase },
      { to: "/inventory", label: "Inventory", icon: Package },
      { to: "/market", label: "Market", icon: ShoppingBag },
      { to: "/wallet", label: "Bank", icon: Wallet },
    ],
  },
  {
    label: "PLAYER",
    items: [{ to: "/profile", label: "Profile", icon: UserRound }],
  },
] as const;

function GameLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const qc = useQueryClient();
  const {
    data: character,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery(q.character());
  const { data: wallet } = useQuery({ ...q.wallet(), enabled: !!character });
  const { data: notes } = useQuery({ ...q.notifications(), enabled: !!character });
  const { data: profile } = useQuery(q.profile());
  const { data: locations } = useQuery({ ...q.locations(), enabled: !!character });
  const { data: equipment } = useQuery({ ...q.equipment(), enabled: !!character });
  const [housingOpen, setHousingOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [housingRequested, setHousingRequested] = useState(false);
  const [housingSource, setHousingSource] = useState<"home" | "profile">("home");
  const housingHandledThisSession = useRef(false);
  const onboardingStep = (
    character as (typeof character & { onboarding_step?: string }) | undefined
  )?.onboarding_step;
  const housingPending = onboardingStep === "housing";
  const unread = notes?.filter((n) => !n.read_at).length ?? 0;
  useEffect(() => {
    configureGameMusic(character?.id ?? null);
    return () => {
      configureGameMusic(null);
      void disableGameAudio();
    };
  }, [character?.id]);
  useEffect(() => {
    if (character?.id && profile?.sound_enabled) {
      startGameAudioSession();
      return;
    }
    void disableGameAudio();
  }, [character?.id, profile?.sound_enabled]);
  useEffect(() => {
    if (!character?.id || !character.current_location_id) return;
    const channel = supabase.channel(`people-area:${character.current_location_id}`, {
      config: { presence: { key: character.id }, broadcast: { self: false } },
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED")
        void channel.track({ characterId: character.id, name: character.name });
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [character?.id, character?.current_location_id, character?.name]);

  useEffect(() => {
    if (!character?.id) return;
    const touch = () => {
      if (!document.hidden && navigator.onLine) void supabase.rpc("touch_player_presence");
    };
    touch();
    const timer = window.setInterval(touch, 25000);
    window.addEventListener("focus", touch);
    window.addEventListener("online", touch);
    document.addEventListener("visibilitychange", touch);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", touch);
      window.removeEventListener("online", touch);
      document.removeEventListener("visibilitychange", touch);
    };
  }, [character?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`player-notifications:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          playGameSound("notification");
          void qc.invalidateQueries({ queryKey: q.notifications().queryKey });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, qc]);
  const currentLocation = locations?.find(
    (location) => location.id === character?.current_location_id,
  );

  useEffect(() => {
    if (!isLoading && !isError && !character) navigate({ to: "/create-character" });
  }, [isLoading, isError, character, navigate]);

  useEffect(() => {
    if (housingPending && !housingHandledThisSession.current) setHousingOpen(true);
  }, [housingPending]);

  useEffect(() => {
    const reopen = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      housingHandledThisSession.current = false;
      setHousingSource(source === "profile" ? "profile" : "home");
      setHousingRequested(true);
      setHousingOpen(true);
    };
    window.addEventListener("osogbo-open-housing", reopen);
    return () => window.removeEventListener("osogbo-open-housing", reopen);
  }, []);

  useEffect(() => {
    if (!character?.id) return;
    void rpc
      .processPropertyRent()
      .then(() =>
        Promise.all([
          qc.invalidateQueries({ queryKey: ["wallet"] }),
          qc.invalidateQueries({ queryKey: ["transactions"] }),
          qc.invalidateQueries({ queryKey: ["rentStatus"] }),
        ]),
      )
      .catch(() => {});
  }, [character?.id, qc]);

  if (isError)
    return (
      <GameDataUnavailable error={error} onRetry={() => void refetch()} isRetrying={isRefetching} />
    );
  if (isLoading || !character)
    return (
      <div className="game-shell min-h-screen">
        <LoadingState />
      </div>
    );

  const player = playerStateFromRows({
    character,
    wallet,
    location: currentLocation,
    equipment: normalizeEquippedItems(equipment),
  });

  return (
    <GameTimeProvider
      key={character.id}
      gameTime={gameTimeFromCharacter(character)}
      character={character}
      wallet={Number(wallet?.balance ?? 0)}
      locationId={character.current_location_id}
      locationType={simulationLocationType(currentLocation?.type)}
    >
      <div
        className={cn(
          "game-shell city-game navigation-redesign card-refresh min-h-screen pb-20 md:pb-0",
          profile?.reduced_motion && "reduce-motion",
          phoneOpen && "phone-open",
        )}
      >
        <WorldEnvironment />
        <div className="city-game-frame">
          <aside
            className="game-desktop-nav game-hover-sidebar"
            aria-label="Main navigation"
            aria-hidden={phoneOpen || undefined}
            inert={phoneOpen || undefined}
          >
            <Link
              to="/home"
              search={{ visit: undefined }}
              className="game-side-logo"
              aria-label="OSUN LIFE home"
            >
              <Logo />
            </Link>
            <nav className="game-side-navigation" aria-label="City and player pages">
              {NAV_GROUPS.map((group) => (
                <div className="game-side-group" key={group.label}>
                  <p className="game-side-label">{group.label}</p>
                  <div className="game-side-links">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          activeProps={{ className: "game-side-link-active" }}
                          className="game-side-link"
                          aria-label={item.label}
                          title={item.label}
                        >
                          <Icon className="h-4.5 w-4.5" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-auto grid gap-2">
              <Link
                to="/settings"
                className="game-side-link"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="h-4.5 w-4.5" />
                <span>Settings</span>
              </Link>
            </div>
          </aside>
          <div className="city-game-content">
            {pathname === "/home" && (
              <GameHUD
                player={player}
                location={currentLocation?.name ?? "Osogbo"}
                unread={unread}
              />
            )}
            {pathname !== "/settings" && <GameNeedsRail />}
            <main className="city-game-main">
              <Outlet />
            </main>
          </div>
        </div>

        <nav
          className="game-mobile-nav game-floating-nav"
          aria-label="Game navigation"
          aria-hidden={phoneOpen || undefined}
          inert={phoneOpen || undefined}
        >
          <Link
            to="/home"
            search={{ visit: undefined }}
            activeProps={{ className: "mobile-nav-active" }}
            className="mobile-nav-link"
          >
            <House className="h-4.75 w-4.75" />
            <span>Home</span>
          </Link>
          <Link
            to="/map"
            activeProps={{ className: "mobile-nav-active" }}
            className="mobile-nav-link"
          >
            <Map className="h-4.75 w-4.75" />
            <span>City</span>
          </Link>
          <Link
            to="/jobs"
            activeProps={{ className: "mobile-nav-active" }}
            className="mobile-nav-link"
          >
            <Briefcase className="h-4.75 w-4.75" />
            <span>Jobs</span>
          </Link>
        </nav>
        <div className="game-phone-fab">
          <PhoneLauncher compact className="game-phone-fab-trigger" onOpenChange={setPhoneOpen} />
        </div>
        <HousingChooser
          open={housingOpen}
          pending={housingPending || (housingRequested && housingSource === "profile")}
          allowSkip={housingPending}
          onClose={() => {
            housingHandledThisSession.current = true;
            setHousingRequested(false);
            setHousingOpen(false);
          }}
        />
      </div>
    </GameTimeProvider>
  );
}

function simulationLocationType(
  value: string | undefined,
): "any" | "home" | "workplace" | "school" {
  if (value === "residential" || value === "home") return "home";
  if (value === "workplace" || value === "government" || value === "market" || value === "shop")
    return "workplace";
  if (value === "school" || value === "university") return "school";
  return "any";
}
