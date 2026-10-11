import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, Compass, House, MapPin } from "lucide-react";
import { Avatar, type Appearance } from "@/components/game/Avatar";
import { Logo } from "@/components/game/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/game";
import cityPhoto from "@/assets/osogbo-city.jpg";
import miniatureCity from "@/assets/hero-city.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OSOGBO LIFE — A Nigerian life simulation game" },
      {
        name: "description",
        content:
          "Create your character, build a career, and make a life in a miniature Osogbo-inspired city.",
      },
      { property: "og:title", content: "OSOGBO LIFE — A Nigerian life simulation game" },
      {
        property: "og:description",
        content: "Create your character and make a life in a miniature Osogbo-inspired city.",
      },
    ],
  }),
  component: Landing,
});

type SessionState = "checking" | "signed-out" | "signed-in" | "error";

async function readSessionState(): Promise<SessionState> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return "error";
    return data.session ? "signed-in" : "signed-out";
  } catch {
    return "error";
  }
}

function Landing() {
  const [sessionState, setSessionState] = useState<SessionState>("checking");

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
  const locationsQuery = useQuery({
    ...q.locations(),
    enabled: !!characterQuery.data,
    staleTime: 5 * 60_000,
  });
  const character = characterQuery.data;
  const location = locationsQuery.data?.find(
    (place) => place.id === character?.current_location_id,
  );
  const isChecking =
    sessionState === "checking" || (sessionState === "signed-in" && characterQuery.isLoading);

  const primaryLink = character
    ? "/home"
    : sessionState === "signed-in"
      ? "/create-character"
      : "/signup";
  const primaryLabel = isChecking
    ? "Checking your save…"
    : character
      ? "Continue life"
      : "Start a new life";

  async function retrySessionCheck() {
    setSessionState("checking");
    setSessionState(await readSessionState());
  }

  return (
    <main className="landing-screen min-h-screen bg-background text-foreground">
      <header className="landing-header">
        <Link to="/" aria-label="OSOGBO LIFE home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login" className="landing-login-link">
            Log in
          </Link>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <img
          src={cityPhoto}
          alt="A view over Osogbo, Nigeria"
          className="landing-hero-image"
          fetchPriority="high"
        />
        <div className="landing-hero-shade" />
        <div className="landing-hero-content">
          <div className="landing-copy">
            <p className="landing-kicker">A life simulation · Osogbo, Nigeria</p>
            <h1 id="landing-title">
              Your life.
              <br />
              Your Osogbo.
            </h1>
            <p className="landing-description">
              Meet the city one day at a time. Find work, discover familiar places, and shape a life
              that feels like yours.
            </p>
            {character && (
              <div className="landing-save-summary" aria-live="polite">
                <span className="landing-save-avatar" aria-hidden="true">
                  <Avatar
                    appearance={(character.appearance as Appearance | null) ?? {}}
                    gender={character.gender}
                    size={46}
                  />
                </span>
                <span>
                  <strong>Welcome back, {character.name}</strong>
                  <small>{location?.name ?? "Last saved in Osogbo"}</small>
                </span>
              </div>
            )}
            {characterQuery.isError && sessionState === "signed-in" && (
              <p className="landing-save-error" role="status">
                Your save could not be checked. Retry before starting a new life.
              </p>
            )}
            {sessionState === "error" && (
              <p className="landing-save-error" role="status">
                Your account could not be checked. Retry so the game can safely find your progress.
              </p>
            )}
            <div className="landing-actions">
              {isChecking ? (
                <Button size="lg" variant="default" disabled>
                  {primaryLabel}
                </Button>
              ) : sessionState === "error" ? (
                <Button size="lg" variant="default" onClick={() => void retrySessionCheck()}>
                  Retry account check
                </Button>
              ) : characterQuery.isError ? (
                <Button
                  size="lg"
                  variant="default"
                  disabled={characterQuery.isRefetching}
                  onClick={() => void characterQuery.refetch()}
                >
                  {characterQuery.isRefetching ? "Checking…" : "Retry save check"}
                </Button>
              ) : (
                <Button asChild size="lg" variant="default">
                  <Link to={primaryLink}>
                    {primaryLabel} <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              )}
              <a href="#your-story" className="landing-secondary-action">
                Discover the game
              </a>
            </div>
            <p className="landing-economy-note">
              All money and prices are simulated in-game values.
            </p>
          </div>

          <div className="landing-character-stage" aria-hidden="true">
            <div className="landing-character-halo" />
            <div className="landing-character-avatar">
              <Avatar
                appearance={(character?.appearance as Appearance | null | undefined) ?? {}}
                gender={character?.gender ?? "female"}
                size={260}
              />
            </div>
            <p>{character?.name ?? "A new story begins here"}</p>
          </div>
        </div>
        <a
          href="https://commons.wikimedia.org/wiki/File:Osogbo.jpg"
          target="_blank"
          rel="noreferrer"
          className="landing-photo-credit"
        >
          Osogbo skyline · El-Shaddaites · CC BY-SA 4.0
        </a>
      </section>

      <section id="your-story" className="landing-story" aria-label="Ways to play">
        <div className="landing-story-heading">
          <p className="landing-kicker landing-kicker-dark">A city to grow into</p>
          <h2>Make the everyday yours.</h2>
        </div>
        <div className="landing-story-grid">
          <Link
            to={sessionState === "signed-in" ? "/map" : "/signup"}
            className="landing-story-link"
          >
            <Compass aria-hidden="true" />
            <span>
              <strong>Find your way</strong>
              <small>Explore the city and choose where to go.</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link
            to={sessionState === "signed-in" ? "/jobs" : "/signup"}
            className="landing-story-link"
          >
            <BriefcaseBusiness aria-hidden="true" />
            <span>
              <strong>Build a working life</strong>
              <small>Apply for jobs, work shifts, and grow.</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link
            to={sessionState === "signed-in" ? "/home" : "/signup"}
            className="landing-story-link"
          >
            <House aria-hidden="true" />
            <span>
              <strong>Come home</strong>
              <small>Make a space and settle into your routine.</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <figure className="landing-city-card">
          <img src={miniatureCity} alt="A miniature Osogbo-inspired city" loading="lazy" />
          <figcaption>
            <MapPin aria-hidden="true" /> Inspired by Osogbo, built for your story.
          </figcaption>
        </figure>
      </section>

      <footer className="landing-footer">
        <Logo />
        <span>OSOGBO LIFE · An original Nigerian life simulation</span>
        <Link to="/login">Account & settings</Link>
      </footer>
    </main>
  );
}
