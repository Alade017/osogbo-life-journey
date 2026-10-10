import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
import { GameTimeProvider } from "@/components/game/GameTimeProvider";
import { WorldEnvironment } from "@/components/game/WorldEnvironment";
import { gameTimeFromCharacter } from "@/lib/game-time";
import { playerStateFromRows } from "@/lib/player-state";

export const Route = createFileRoute("/_authenticated/_game")({
  component: GameLayout,
});

const NAV = [
  { to: "/home", label: "Home", icon: House },
  { to: "/house", label: "Property", icon: House },
  { to: "/map", label: "City", icon: Map },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/social", label: "People", icon: Users },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/market", label: "Market", icon: ShoppingBag },
  { to: "/wallet", label: "Bank", icon: Wallet },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

function GameLayout() {
  const navigate = useNavigate();
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
  const unread = notes?.filter((n) => !n.read_at).length ?? 0;
  const currentLocation = locations?.find(
    (location) => location.id === character?.current_location_id,
  );

  useEffect(() => {
    if (!isLoading && !isError && !character) navigate({ to: "/create-character" });
  }, [isLoading, isError, character, navigate]);

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

  const player = playerStateFromRows({ character, wallet, location: currentLocation });

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
          "game-shell city-game min-h-screen pb-20 md:pb-0",
          profile?.reduced_motion && "reduce-motion",
        )}
      >
        <WorldEnvironment />
        <div className="city-game-frame">
          <aside className="game-desktop-nav" aria-label="Main navigation">
            <Link
              to="/home"
              search={{ visit: undefined }}
              className="game-side-logo"
              aria-label="OSOGBO LIFE home"
            >
              <Logo />
            </Link>
            <p className="game-side-label">YOUR CITY</p>
            <nav className="game-side-links">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    {...(item.to === "/social" ? { search: { playerId: undefined } } : {})}
                    activeProps={{ className: "game-side-link-active" }}
                    className="game-side-link"
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto grid gap-2">
              <PhoneLauncher compact className="game-side-phone" />
              <Link to="/settings" className="game-side-link">
                <Settings className="h-4.5 w-4.5" />
                <span>Settings</span>
              </Link>
            </div>
          </aside>
          <div className="city-game-content">
            <GameHUD player={player} location={currentLocation?.name ?? "Osogbo"} unread={unread} />
            <main className="city-game-main">
              <Outlet />
            </main>
          </div>
        </div>

        <nav className="game-mobile-nav" aria-label="Game navigation">
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
          <Link
            to="/social"
            search={{ playerId: undefined }}
            activeProps={{ className: "mobile-nav-active" }}
            className="mobile-nav-link"
          >
            <Users className="h-4.75 w-4.75" />
            <span>People</span>
          </Link>
          <PhoneLauncher compact className="mobile-nav-phone" />
        </nav>
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
