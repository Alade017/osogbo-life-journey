import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Headphones,
  House,
  LogOut,
  MapPin,
  Music2,
  Sparkles,
  UsersRound,
  VolumeX,
  WalletCards,
} from "lucide-react";
import { EntryTownPreview } from "@/components/game/EntryTownPreview";
import { Logo } from "@/components/game/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  configureGameMusic,
  disableGameAudio,
  enableGameAudio,
  getMusicState,
  getServerMusicState,
  readGameAudioLevels,
  setGameAudioLevels,
  subscribeMusic,
} from "@/lib/game-audio";
import { formatNaira, q } from "@/lib/game";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import type { Appearance } from "@/game/avatar-appearance";
import { LandingBackdrop } from "@/components/game/LandingBackdrop";
import "@/components/game/landing.css";

// The 3D character loads after the photo and headline are painted, so WebGL never blocks the first view.
const CharacterPreview = lazy(() =>
  import("@/components/3d/CharacterPreview").then((module) => ({
    default: module.CharacterPreview,
  })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OSUN LIFE — A Nigerian life simulation game" },
      {
        name: "description",
        content:
          "Create your character, find work, make a home, and build a life across a fictional Osun-inspired world.",
      },
      { property: "og:title", content: "OSUN LIFE — A Nigerian life simulation game" },
      {
        property: "og:description",
        content: "Start a new story or return to your saved life in OSUN LIFE.",
      },
      { name: "twitter:title", content: "OSUN LIFE — A Nigerian life simulation game" },
      {
        name: "twitter:description",
        content: "Find work, make a home, meet people, and shape your virtual life.",
      },
      { name: "robots", content: "index, follow" },
    ],
    links: import.meta.env["VITE_SITE_URL"]
      ? [{ rel: "canonical", href: import.meta.env["VITE_SITE_URL"].replace(/\/$/, "") + "/" }]
      : [],
  }),
  component: Landing,
});

export type SessionState = "checking" | "signed-out" | "signed-in" | "error";
export type LandingExperience = {
  mode: "checking" | "error" | "new" | "returning";
  primaryLink: "/signup" | "/create-character" | "/enter";
  primaryLabel: string;
};

export function resolveLandingExperience(
  sessionState: SessionState,
  hasCharacter: boolean,
  characterError = false,
): LandingExperience {
  if (sessionState === "checking")
    return {
      mode: "checking",
      primaryLink: "/signup",
      primaryLabel: "Checking your save…",
    };
  if (sessionState === "error" || characterError)
    return { mode: "error", primaryLink: "/signup", primaryLabel: "Retry account check" };
  if (hasCharacter)
    return { mode: "returning", primaryLink: "/enter", primaryLabel: "Continue your life" };
  return {
    mode: "new",
    primaryLink: sessionState === "signed-in" ? "/create-character" : "/signup",
    primaryLabel: "Start a new life",
  };
}

async function readSessionState(): Promise<SessionState> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return "error";
    return data.session ? "signed-in" : "signed-out";
  } catch {
    return "error";
  }
}

const LIFE_LOOP = [
  { title: "Create", body: "Shape your look in 3D and name your story." },
  { title: "Settle in", body: "Pick a home and a district that suits you." },
  { title: "Work", body: "Take jobs and grow your income." },
  { title: "Build", body: "Furnish your home and make it yours." },
  { title: "Connect", body: "Meet people and build real friendships." },
];

function LandingAudio({ identity }: { identity: string }) {
  const music = useSyncExternalStore(subscribeMusic, getMusicState, getServerMusicState);
  const [changing, setChanging] = useState(false);
  const musicEnabled = music.soundEnabled && readGameAudioLevels().music > 0;

  useEffect(() => {
    configureGameMusic(identity);
    return () => {
      configureGameMusic(null);
      void disableGameAudio();
    };
  }, [identity]);

  async function toggleAudio() {
    setChanging(true);
    const current = readGameAudioLevels();
    if (musicEnabled) {
      setGameAudioLevels({ ...current, music: 0 });
    } else if (!(await enableGameAudio({ ...current, music: current.music || 0.4 }))) {
      setGameAudioLevels(current);
    }
    setChanging(false);
  }

  return (
    <button
      type="button"
      className="cin-audio"
      role="switch"
      aria-checked={musicEnabled}
      aria-label={musicEnabled ? "Turn town music off" : "Turn town music on"}
      disabled={changing}
      onClick={() => void toggleAudio()}
    >
      {musicEnabled ? <Music2 aria-hidden="true" /> : <Headphones aria-hidden="true" />}
      <span>{musicEnabled ? "Mute music" : "Town music"}</span>
    </button>
  );
}

function Landing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionState(session ? "signed-in" : "signed-out");
    });
    void readSessionState().then((state) => {
      if (active) setSessionState(state);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const characterQuery = useQuery({
    ...q.character(),
    enabled: sessionState === "signed-in",
    staleTime: 30_000,
  });
  const character = characterQuery.data;
  const walletQuery = useQuery({ ...q.wallet(), enabled: !!character, staleTime: 30_000 });
  const locationsQuery = useQuery({
    ...q.locations(),
    enabled: !!character,
    staleTime: 5 * 60_000,
  });
  const equipmentQuery = useQuery({
    ...q.equipment(),
    enabled: !!character,
    staleTime: 30_000,
  });
  const location = locationsQuery.data?.find(
    (place) => place.id === character?.current_location_id,
  );
  const wornEquipment = normalizeEquippedItems(equipmentQuery.data).map((entry) => ({
    slot: entry.slot,
    item: entry.item,
  }));
  const waitingForCharacter = sessionState === "signed-in" && characterQuery.isLoading;
  const experience = resolveLandingExperience(
    waitingForCharacter ? "checking" : sessionState,
    Boolean(character),
    sessionState === "signed-in" && characterQuery.isError,
  );

  async function retrySessionCheck() {
    setSessionState("checking");
    const state = await readSessionState();
    setSessionState(state);
    if (state === "signed-in") await characterQuery.refetch();
  }

  async function signOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (!error) {
      queryClient.clear();
      setSessionState("signed-out");
      await navigate({ to: "/" });
    }
    setSigningOut(false);
  }

  const returning = experience.mode === "returning" && character;

  return (
    <main className="cin">
      <header className="cin-header">
        <Link to="/" aria-label="OSUN LIFE home" className="cin-logo">
          <Logo />
        </Link>
        <LandingAudio identity={character?.id ?? "public-landing"} />
      </header>

      <section className="cin-hero" aria-labelledby="landing-title">
        <LandingBackdrop />
        <div className="cin-shade" aria-hidden="true" />

        <div className="cin-grid">
          <div className="cin-main">
            <p className="cin-eyebrow">
              <Sparkles aria-hidden="true" /> An original Nigerian life simulation
            </p>
            <h1 id="landing-title" className="cin-title">
              Make your life <em>your own.</em>
            </h1>
            <p className="cin-lede">
              Create your character, find your place, and grow a life in a fictional Osun-inspired
              social world.
            </p>
            <div className="cin-tags" aria-label="Game highlights">
              <span>
                <House aria-hidden="true" /> Make a home
              </span>
              <span>
                <BriefcaseBusiness aria-hidden="true" /> Build a career
              </span>
              <span>
                <UsersRound aria-hidden="true" /> Meet people
              </span>
            </div>

            <section className="cin-card" aria-live="polite">
              {experience.mode === "checking" ? (
                <div className="cin-state" role="status">
                  <span className="cin-loader" aria-hidden="true" />
                  <strong>Finding your saved life</strong>
                  <small>This will only take a moment.</small>
                </div>
              ) : experience.mode === "error" ? (
                <div className="cin-state" role="alert">
                  <VolumeX aria-hidden="true" />
                  <strong>Your account could not be checked.</strong>
                  <small>Your existing progress is safe. Try loading it again.</small>
                  <Button onClick={() => void retrySessionCheck()}>Retry account check</Button>
                </div>
              ) : returning ? (
                <>
                  <p className="cin-card-kicker">Your saved life</p>
                  <div className="cin-player">
                    <div className="cin-player-copy">
                      <strong>{returning.name}</strong>
                      <small>
                        Level {returning.level} · {location?.name ?? "Saved in Osun"}
                      </small>
                    </div>
                    <span className="cin-balance">
                      <WalletCards aria-hidden="true" />
                      {walletQuery.isLoading
                        ? "Loading wallet"
                        : walletQuery.data
                          ? formatNaira(walletQuery.data.balance)
                          : "Wallet unavailable"}
                    </span>
                  </div>
                  <Button asChild size="lg" className="cin-primary">
                    <Link to="/enter">
                      Continue your life <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                  <div className="cin-account">
                    <Link to="/profile">Account and profile</Link>
                    <button type="button" disabled={signingOut} onClick={() => void signOut()}>
                      <LogOut aria-hidden="true" /> {signingOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="cin-card-kicker">Start your story</p>
                  <h2>Begin with a life that grows with you.</h2>
                  <p className="cin-card-copy">
                    A few quick choices and your first day in Osogbo begins.
                  </p>
                  <Button asChild size="lg" className="cin-primary">
                    <Link to={experience.primaryLink}>
                      {experience.primaryLabel} <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                  {sessionState === "signed-out" ? (
                    <Link to="/login" className="cin-secondary">
                      I already have an account
                    </Link>
                  ) : (
                    <button type="button" className="cin-secondary" onClick={() => void signOut()}>
                      Sign out
                    </button>
                  )}
                  <small className="cin-money">
                    Free to play. All naira amounts are fictional game values.
                  </small>
                </>
              )}
            </section>
          </div>

          <div className="cin-stage" aria-label="Your character">
            <span className="cin-stage-tag">
              <MapPin aria-hidden="true" /> Osogbo
            </span>
            <Suspense fallback={<span className="cin-loader" aria-hidden="true" />}>
              <CharacterPreview
                appearance={(character?.appearance ?? {}) as unknown as Appearance}
                gender={character?.gender ?? "female"}
                equipment={wornEquipment}
                label={character ? `${character.name}, your character` : "Your character preview"}
              />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="cin-loop-wrap" aria-labelledby="loop-title">
        <p className="cin-eyebrow" id="loop-title">
          How a life unfolds
        </p>
        <ol className="cin-loop">
          {LIFE_LOOP.map((step, index) => (
            <li key={step.title}>
              <span aria-hidden="true">{index + 1}</span>
              <strong>{step.title}</strong>
              <small>{step.body}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="cin-town" aria-labelledby="town-title">
        <h2 id="town-title" className="cin-town-title">
          Walk the streets of a fictional Osun.
        </h2>
        <div className="cin-town-frame">
          <EntryTownPreview />
        </div>
      </section>
    </main>
  );
}
