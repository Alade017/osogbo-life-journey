import { useEffect, useState, useSyncExternalStore } from "react";
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
import osogboCityImage from "@/assets/osogbo-city.jpg";
import "@/components/game/landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OSUN LIFE â€” A Nigerian life simulation game" },
      {
        name: "description",
        content:
          "Create your character, find work, make a home, and build a life across a fictional Osun-inspired world.",
      },
      { property: "og:title", content: "OSUN LIFE â€” A Nigerian life simulation game" },
      {
        property: "og:description",
        content: "Start a new story or return to your saved life in OSUN LIFE.",
      },
      { name: "twitter:title", content: "OSUN LIFE â€” A Nigerian life simulation game" },
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
      primaryLabel: "Checking your saveâ€¦",
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

      <section className="landing-v2-stage" aria-labelledby="landing-title">
        <div className="landing-v2-world" aria-label="A preview of the OSUN LIFE world">
          <img
            className="landing-v2-world-photo"
            src={osogboCityImage}
            alt="Panoramic view of Osogbo, the real world inspiration for OSUN LIFE"
            fetchPriority="high"
          />
          <div className="landing-v2-world-shade" aria-hidden="true" />
          <div className="landing-v2-world-map">
            <EntryTownPreview />
          </div>
          <div className="landing-v2-world-avatar" aria-hidden="true">
            <Avatar
              appearance={(character?.appearance as Appearance | null | undefined) ?? {}}
              gender={character?.gender ?? "female"}
              size={154}
            />
          </div>
          <span className="landing-v2-world-label">
            <MapPin aria-hidden="true" /> Your Osun story starts here
          </span>
          <span className="landing-v2-photo-credit">Photo: El-Shaddaites · CC BY-SA 4.0</span>
        </div>

        <div className="landing-v2-intro">
          <p className="landing-v2-eyebrow">
            <Sparkles aria-hidden="true" /> An original Nigerian life simulation
          </p>
          <h1 id="landing-title">
            Make your life <em>your own.</em>
          </h1>
          <p>
            Create your character, find your place, and grow a life in a fictional Osun-inspired
            social world.
          </p>
          <div className="landing-v2-hero-signals" aria-label="Game highlights">
            <span><House aria-hidden="true" /> Make a home</span>
            <span><BriefcaseBusiness aria-hidden="true" /> Build a career</span>
            <span><UsersRound aria-hidden="true" /> Meet people</span>
          </div>
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
              <p className="landing-v2-card-kicker">Your saved life</p>
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
                  <small>Level {returning.level} · {location?.name ?? "Saved in Osun"}</small>
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
                <Link to="/enter">Continue your life <ArrowRight aria-hidden="true" /></Link>
              </Button>
              <div className="landing-v2-account-actions">
                <Link to="/profile">Account and profile</Link>
                <button type="button" disabled={signingOut} onClick={() => void signOut()}>
                  <LogOut aria-hidden="true" /> {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="landing-v2-card-kicker">Start your story</p>
              <h2>Begin with a life that grows with you.</h2>
              <ol className="landing-v2-steps" aria-label="How your story begins">
                <li><span>1</span><strong>Create</strong></li>
                <li><span>2</span><strong>Settle in</strong></li>
                <li><span>3</span><strong>Explore</strong></li>
              </ol>
              <Button asChild size="lg" className="landing-v2-primary">
                <Link to={experience.primaryLink}>{experience.primaryLabel} <ArrowRight aria-hidden="true" /></Link>
              </Button>
              {sessionState === "signed-out" ? (
                <Link to="/login" className="landing-v2-secondary">I already have an account</Link>
              ) : (
                <button type="button" className="landing-v2-secondary" onClick={() => void signOut()}>
                  Sign out
                </button>
              )}
              <small className="landing-v2-money-note">Free to play. All naira amounts are fictional game values.</small>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
