import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, LogOut, MapPin, Sparkles, WalletCards } from "lucide-react";
import { EntryTownPreview } from "@/components/game/EntryTownPreview";
import { findLandmarkForSlug } from "@/components/game/entry-town-preview";
import { Logo } from "@/components/game/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";
import { entryAction, type EntrySession } from "@/lib/entry-action";
import "@/components/game/home-entry.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OSUN LIFE — A Nigerian life simulation game" },
      { name: "description", content: "Create your character and build a life in an Osogbo-inspired Nigerian world." },
      { property: "og:title", content: "OSUN LIFE — A Nigerian life simulation game" },
      { property: "og:description", content: "Start a new story or return to your saved life in OSUN LIFE." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: EntryPage,
});

type SessionState = EntrySession;

async function readSessionState(): Promise<SessionState> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return "error";
    return data.session ? "signed-in" : "signed-out";
  } catch {
    return "error";
  }
}

function EntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setSessionState(session ? "signed-in" : "signed-out"),
    );
    void readSessionState().then((state) => {
      if (active) setSessionState(state);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signedIn = sessionState === "signed-in";
  const characterQuery = useQuery({ ...q.character(), enabled: signedIn, staleTime: 30_000 });
  const character = characterQuery.data;
  const walletQuery = useQuery({ ...q.wallet(), enabled: !!character, staleTime: 30_000 });
  const locationsQuery = useQuery({ ...q.locations(), staleTime: 300_000 });
  const location = locationsQuery.data?.find((place) => place.id === character?.current_location_id);
  const focusLandmarkId = findLandmarkForSlug(location?.slug)?.id ?? null;
  const action = entryAction(sessionState, Boolean(character));

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

  return (
    <main className="entry">
      <header className="entry-top">
        <Link to="/" aria-label="OSUN LIFE home" className="entry-brand">
          <Logo small />
          <span>OSUN LIFE</span>
        </Link>
        <nav className="entry-auth" aria-label="Account">
          {signedIn ? (
            <button type="button" className="entry-link" disabled={signingOut} onClick={() => void signOut()}>
              <LogOut aria-hidden="true" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <>
              <Link to="/login" className="entry-link">Log in</Link>
              <Link to="/signup" className="entry-pill">Create account</Link>
            </>
          )}
        </nav>
      </header>

      <section className="entry-main" aria-labelledby="entry-title">
        <div className="entry-hero-copy">
          <p className="entry-eyebrow"><Sparkles aria-hidden="true" /> A Nigerian life simulation</p>
          {character ? (
            <>
              <p className="entry-kicker">Welcome back to your story</p>
              <h1 id="entry-title" className="entry-title">Good to see you, <span>{character.name}.</span></h1>
              <p className="entry-description">Your neighbourhood is waiting. Pick up where you left off.</p>
            </>
          ) : (
            <>
              <p className="entry-kicker">Osogbo awaits</p>
              <h1 id="entry-title" className="entry-title">Your next chapter starts <span>in Osun.</span></h1>
              <p className="entry-description">Create your character, find work, make a home, and build your story in a living Nigerian world.</p>
            </>
          )}

          <div className="entry-hero-actions">
            <Button asChild size="lg" className="entry-cta">
              <Link to={action.to}>
                {action.kind === "continue" ? "Continue your life" : "Start your story"}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {!signedIn && <Link to="/login" className="entry-secondary-action">I already have an account</Link>}
          </div>

          <div className="entry-trust-row">
            <span><CheckCircle2 aria-hidden="true" /> Free to play</span>
            <span><MapPin aria-hidden="true" /> Inspired by Osun State</span>
          </div>

          {character && (
            <div className="entry-return-card">
              <span>Level {character.level}{location ? ` · ${location.name}` : ""}</span>
              <span className="entry-balance">
                <WalletCards aria-hidden="true" />
                {walletQuery.data ? formatNaira(walletQuery.data.balance) : "Loading balance"}
              </span>
            </div>
          )}
        </div>

        <div className="entry-hero-visual" aria-label="A preview of the game world">
          <div className="entry-scene-frame">
            <EntryTownPreview
              focusLandmarkId={focusLandmarkId}
              focusLabel={location?.name ?? null}
              activeSlugs={locationsQuery.data ? new Set(locationsQuery.data.map((place) => place.slug)) : null}
            />
            {location && <span className="entry-scene-tag"><MapPin aria-hidden="true" /> {location.name}</span>}
            <div className="entry-scene-caption">
              <span className="entry-live-dot" />
              <span>Explore the neighbourhood</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
