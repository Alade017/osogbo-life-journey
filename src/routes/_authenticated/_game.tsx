import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Briefcase, House, Map } from "lucide-react";
import { q, rpc } from "@/lib/game";
import { GameDataUnavailable, LoadingState } from "@/components/game/ui";
import { cn } from "@/lib/utils";
import { HomeDashboard } from "@/components/game/HomeDashboard";
import { GameNeedsRail } from "@/components/game/GameNeedsRail";
import { PhoneLauncher } from "@/components/game/PhoneLauncher";
import { HousingChooser } from "@/components/game/housing/HousingChooser";
import { HousingRepossessionNotice } from "@/components/game/housing/HousingRepossessionNotice";
import { GameTimeProvider } from "@/components/game/GameTimeProvider";
import { WorldEnvironment } from "@/components/game/WorldEnvironment";
import { LoginStreakProvider } from "@/components/game/LoginStreakProvider";
import { gameTimeFromCharacter } from "@/lib/game-time";
import { supabase } from "@/integrations/supabase/client";
import { playerStateFromRows } from "@/lib/player-state";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import {
  configureGameMusic,
  disableGameAudio,
  readGameAudioLevels,
  setGameAudioLevels,
  startGameAudioSession,
  playGameSound,
} from "@/lib/game-audio";
import "@/components/game/game-navigation.css";
import "@/components/game/game-cards.css";

export const Route = createFileRoute("/_authenticated/_game")({
  component: GameLayout,
});

function GameLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const visitingFriend = useRouterState({
    select: (state) =>
      typeof (state.location.search as Record<string, unknown>)["visit"] === "string",
  });
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
    const musicEnabled = profile?.music_enabled ?? profile?.sound_enabled ?? false;
    const effectsEnabled = profile?.effects_enabled ?? profile?.sound_enabled ?? false;
    const saved = readGameAudioLevels();
    setGameAudioLevels({
      ...saved,
      music: musicEnabled ? saved.music || 0.4 : 0,
      effects: effectsEnabled ? saved.effects || 0.65 : 0,
    });
    if (character?.id && (musicEnabled || effectsEnabled)) {
      startGameAudioSession();
      return;
    }
    void disableGameAudio();
  }, [character?.id, profile?.music_enabled, profile?.effects_enabled, profile?.sound_enabled]);
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
      <LoginStreakProvider userId={character.user_id} characterId={character.id}>
        <div
          className={cn(
            "game-shell city-game navigation-redesign card-refresh min-h-screen pb-20 md:pb-0",
            profile?.reduced_motion && "reduce-motion",
            phoneOpen && "phone-open",
          )}
        >
          <WorldEnvironment />
          <div className="city-game-frame">
            <div className="city-game-content">
              <main className="city-game-main">
                {pathname === "/home" && !visitingFriend ? (
                  <HomeDashboard
                    player={player}
                    location={currentLocation?.name ?? "Osogbo"}
                    unread={unread}
                  >
                    <Outlet />
                  </HomeDashboard>
                ) : (
                  <Outlet />
                )}
              </main>
            </div>
          </div>

          {pathname !== "/settings" && <GameNeedsRail player={player} />}

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
          <HousingRepossessionNotice characterId={character.id} />
        </div>
      </LoginStreakProvider>
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
