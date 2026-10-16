import { useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Compass,
  Headphones,
  House,
  LogOut,
  MapPin,
  Music2,
  Sparkles,
  VolumeX,
  WalletCards,
} from "lucide-react";
import { Avatar, type Appearance } from "@/components/game/Avatar";
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
  subscribeMusic,
} from "@/lib/game-audio";
import { formatNaira, q } from "@/lib/game";
import "@/components/game/landing.css";

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

function LandingAudio({ identity }: { identity: string }) {
  const music = useSyncExternalStore(subscribeMusic, getMusicState, getServerMusicState);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    configureGameMusic(identity);
    return () => {
      configureGameMusic(null);
      void disableGameAudio();
    };
  }, [identity]);

  async function toggleAudio() {
    setChanging(true);
    if (music.soundEnabled) await disableGameAudio();
    else await enableGameAudio();
    setChanging(false);
  }

  return (
    <button
      type="button"
      className="landing-v2-audio"
      role="switch"
      aria-checked={music.soundEnabled}
      aria-label={music.soundEnabled ? "Turn town music off" : "Turn town music on"}
      disabled={changing}
      onClick={() => void toggleAudio()}
    >
      <span className="landing-v2-audio-active">
        {music.soundEnabled ? <Music2 aria-hidden="true" /> : <Headphones aria-hidden="true" />}
        Town music
      </span>
      <span>{music.soundEnabled ? "Mute" : "Play"}</span>
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
  const location = locationsQuery.data?.find(
    (place) => place.id === character?.current_location_id,
  );
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
    <main className="landing-v2">
      <header className="landing-v2-header">
        <Link to="/" aria-label="OSUN LIFE home">
          <Logo />
        </Link>
        <LandingAudio identity={character?.id ?? "public-landing"} />
      </header>

      <section className="landing-v2-hero" aria-labelledby="landing-title">
        <div className="landing-v2-intro">
          <p className="landing-v2-eyebrow">
            <Sparkles aria-hidden="true" /> A Nigerian life simulation
          </p>
          <h1 id="landing-title">
            Build a life that <em>feels like yours.</em>
          </h1>
          <p>
            Work, make a home, meet people, and find your place in a fictional world inspired by
            everyday life across Osun State.
          </p>
        </div>

        <div className="landing-v2-world" aria-label="A preview of the OSUN LIFE world">
          <EntryTownPreview />
          <div className="landing-v2-world-avatar" aria-hidden="true">
            <Avatar
              appearance={(character?.appearance as Appearance | null | undefined) ?? {}}
              gender={character?.gender ?? "female"}
              size={154}
            />
          </div>
          <span className="landing-v2-world-label">
            <MapPin aria-hidden="true" /> Your story starts here
          </span>
        </div>

        <section className="landing-v2-start-card" aria-live="polite">
          {experience.mode === "checking" ? (
            <div className="landing-v2-state" role="status">
              <span className="landing-v2-loader" aria-hidden="true" />
              <strong>Finding your saved life</strong>
              <small>This will only take a moment.</small>
            </div>
          ) : experience.mode === "error" ? (
            <div className="landing-v2-state" role="alert">
              <VolumeX aria-hidden="true" />
              <strong>Your account could not be checked.</strong>
              <small>Your existing progress is safe. Try loading it again.</small>
              <Button onClick={() => void retrySessionCheck()}>Retry account check</Button>
            </div>
          ) : returning ? (
            <>
              <p className="landing-v2-card-kicker">Welcome back</p>
              <div className="landing-v2-player">
                <span className="landing-v2-player-avatar" aria-hidden="true">
                  <Avatar
                    appearance={(returning.appearance as Appearance | null) ?? {}}
                    gender={returning.gender}
                    size={58}
                  />
                </span>
                <span className="landing-v2-player-copy">
                  <strong>{returning.name}</strong>
                  <small>
                    Level {returning.level} · {location?.name ?? "Saved in Osun"}
                  </small>
                </span>
                <span className="landing-v2-balance">
                  <WalletCards aria-hidden="true" />
                  {walletQuery.isLoading
                    ? "Loading wallet"
                    : walletQuery.data
                      ? formatNaira(walletQuery.data.balance)
                      : "Wallet unavailable"}
                </span>
              </div>
              <Button asChild size="lg" className="landing-v2-primary">
                <Link to="/enter">
                  Continue your life <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <div className="landing-v2-account-actions">
                <Link to="/profile">Account and profile</Link>
                <button type="button" disabled={signingOut} onClick={() => void signOut()}>
                  <LogOut aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="landing-v2-card-kicker">Your next chapter</p>
              <h2>Start with a choice. Grow from there.</h2>
              <p className="landing-v2-card-copy">
                Create your player and turn ordinary days into your own story.
              </p>
              <ol className="landing-v2-steps" aria-label="How your story begins">
                <li>
                  <span>1</span>
                  <strong>Earn</strong>
                </li>
                <li>
                  <span>2</span>
                  <strong>Find a home</strong>
                </li>
                <li>
                  <span>3</span>
                  <strong>Build a life</strong>
                </li>
              </ol>
              <Button asChild size="lg" className="landing-v2-primary">
                <Link to={experience.primaryLink}>
                  {experience.primaryLabel} <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              {sessionState === "signed-out" ? (
                <Link to="/login" className="landing-v2-secondary">
                  I already have an account
                </Link>
              ) : (
                <button
                  type="button"
                  className="landing-v2-secondary"
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              )}
              <small className="landing-v2-money-note">
                Free to play. All naira amounts are fictional game values.
              </small>
            </>
          )}
        </section>
      </section>

      <section className="landing-v2-life" aria-labelledby="landing-life-title">
        <div>
          <p className="landing-v2-eyebrow">A world shaped by your choices</p>
          <h2 id="landing-life-title">There is always something to do next.</h2>
        </div>
        <div className="landing-v2-life-grid">
          <article>
            <BriefcaseBusiness aria-hidden="true" />
            <h3>Build your working life</h3>
            <p>Apply for jobs, work shifts, learn skills, and grow your income.</p>
          </article>
          <article>
            <Compass aria-hidden="true" />
            <h3>Explore public places</h3>
            <p>Travel through the city and discover activities at each destination.</p>
          </article>
          <article>
            <House aria-hidden="true" />
            <h3>Make a home</h3>
            <p>Choose a place to live, collect furniture, and make it feel personal.</p>
          </article>
        </div>
      </section>

      <footer className="landing-v2-footer">
        <Logo />
        <span>OSUN LIFE. An original Nigerian life simulation.</span>
        <Link to="/login">Account</Link>
      </footer>
    </main>
  );
}
