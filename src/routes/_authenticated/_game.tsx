import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Backpack,
  Bell,
  Briefcase,
  Home,
  Map,
  Settings,
  Target,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { q, rpc, formatNaira } from "@/lib/game";
import { Logo } from "@/components/game/Logo";
import { GameDataUnavailable, LoadingBricks } from "@/components/game/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_game")({
  component: GameLayout,
});

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/map", label: "Map", icon: Map },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/inventory", label: "Items", icon: Backpack },
  { to: "/missions", label: "Missions", icon: Target },
  { to: "/profile", label: "Profile", icon: User },
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
  const unread = notes?.filter((n) => !n.read_at).length ?? 0;

  useEffect(() => {
    if (!isLoading && !isError && !character) navigate({ to: "/create-character" });
  }, [isLoading, isError, character, navigate]);

  // Server recalculates passive energy regeneration.
  useEffect(() => {
    if (!character?.id) return;
    const tick = () =>
      rpc
        .refreshEnergy()
        .then(() => qc.invalidateQueries({ queryKey: ["character"] }))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 120_000);
    return () => clearInterval(id);
  }, [character?.id, qc]);

  if (isError)
    return (
      <GameDataUnavailable error={error} onRetry={() => void refetch()} isRetrying={isRefetching} />
    );
  if (isLoading || !character)
    return (
      <div className="game-shell min-h-screen">
        <LoadingBricks />
      </div>
    );

  return (
    <div
      className={cn(
        "game-shell min-h-screen pb-24 md:pb-8",
        profile?.reduced_motion && "reduce-motion",
      )}
    >
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5">
          <Link to="/home" aria-label="Home">
            <span className="md:hidden">
              <Logo small />
            </span>
            <span className="hidden md:inline">
              <Logo />
            </span>
          </Link>
          <nav className="ml-4 hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-bold"
              title="Energy"
            >
              <Zap className="h-3.5 w-3.5" />
              {character.energy}
            </span>
            <span
              className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"
              title="In-game balance"
            >
              {formatNaira(wallet?.balance)}
            </span>
            <Link
              to="/notifications"
              className="relative rounded-lg border border-border bg-card p-2 transition-colors hover:bg-muted"
              aria-label={`Notifications (${unread} unread)`}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-clay-foreground">
                  {unread}
                </span>
              )}
            </Link>
            <Link
              to="/settings"
              className="rounded-lg border border-border bg-card p-2 transition-colors hover:bg-muted"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-5 md:px-4 md:py-8">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 shadow-[0_-4px_18px_rgba(20,30,30,0.08)] backdrop-blur md:hidden"
        aria-label="Game navigation"
      >
        <div className="mobile-nav-scrollbar flex overflow-x-auto px-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex min-w-12 flex-1 flex-col items-center gap-0.5 py-2 text-[9px] font-semibold text-muted-foreground"
              activeProps={{ className: "!text-primary [&>span]:bg-secondary" }}
            >
              <span className="rounded-lg p-1">
                <n.icon className="h-5 w-5" />
              </span>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
