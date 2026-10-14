import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  House,
  Map,
  Package,
  Settings,
  ShoppingBag,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { q, rpc } from "@/lib/game";
import { Logo } from "@/components/game/Logo";
import { GameDataUnavailable, LoadingState } from "@/components/game/ui";
import { cn } from "@/lib/utils";
import { GameHUD } from "@/components/game/GameHUD";
import { PhoneLauncher } from "@/components/game/PhoneLauncher";
import { HousingChooser } from "@/components/game/housing/HousingChooser";
import { GameTimeProvider } from "@/components/game/GameTimeProvider";
import { WorldEnvironment } from "@/components/game/WorldEnvironment";
import { gameTimeFromCharacter } from "@/lib/game-time";
import { playerStateFromRows } from "@/lib/player-state";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { configureGameMusic, disableGameAudio, startGameAudioSession } from "@/lib/game-audio";
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
      { to: "/social", label: "People", icon: Users },
    ],
  },
  {
    label: "DAILY LIFE",
    items: [
      { to: "/house", label: "Property", icon: House },
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
  const [housingRequested, setHousingRequested] = useState(false);
  const housingHandledThisSession = useRef(false);
  const onboardingStep = (
    character as (typeof character & { onboarding_step?: string }) | undefined
  )?.onboarding_step;
  const housingPending = onboardingStep === "housing";
  const unread = notes?.filter((n) => !n.read_at).length ?? 0;
  useEffect(() => {
    configureGameMusic(character?.id ?? null);
    if (character?.id) startGameAudioSession();
    return () => {
      configureGameMusic(null);
      void disableGameAudio();
    };
  }, [character?.id]);
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
    const reopen = () => {
      housingHandledThisSession.current = false;
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
        )}
      >
        <WorldEnvironment />
        <div className="city-game-frame">
          <aside className="game-desktop-nav game-hover-sidebar" aria-label="Main navigation">
            <Link
              to="/home"
              search={{ visit: undefined }}
              className="game-side-logo"
              aria-label="OSOGBO LIFE home"
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
                          {...(item.to === "/social" ? { search: { playerId: undefined } } : {})}
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
              <PhoneLauncher compact className="game-side-phone" />
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
            <GameHUD
              player={player}
              location={currentLocation?.name ?? "Osogbo"}
              unread={unread}
              showNeeds={pathname !== "/settings"}
            />
            <main className="city-game-main">
              <Outlet />
            </main>
          </div>
        </div>

        <nav className="game-mobile-nav game-curved-dock" aria-label="Game navigation">
          <svg
            className="game-dock-surface"
            viewBox="0 0 500 90"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M44 20H195C212 20 210 62 250 62S288 20 305 20H456C481 20 500 34 500 55S481 90 456 90H44C19 90 0 76 0 55S19 20 44 20Z" />
          </svg>
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
          <PhoneLauncher compact className="mobile-nav-phone" />
          <Link
            to="/jobs"
            activeProps={{ className: "mobile-nav-active" }}
            className="mobile-nav-link"
          >
            <Briefcase className="h-4.75 w-4.75" />
            <span>Jobs</span>
          </Link>
          <Link
            to="/social"
            search={{ playerId: undefined }}
            activeProps={{ className: "mobile-nav-active" }}
            className="mobile-nav-link"
          >
            <Users className="h-4.75 w-4.75" />
            <span>People</span>
          </Link>
        </nav>
        <HousingChooser
          open={housingOpen}
          pending={housingPending || housingRequested}
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
