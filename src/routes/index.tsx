import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LogOut, MapPin, WalletCards } from "lucide-react";
import { EntryTownPreview } from "@/components/game/EntryTownPreview";
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

  const signedIn = sessionState === "signed-in";
  const characterQuery = useQuery({ ...q.character(), enabled: signedIn, staleTime: 30_000 });
  const character = characterQuery.data;
  const walletQuery = useQuery({ ...q.wallet(), enabled: !!character, staleTime: 30_000 });
  const locationsQuery = useQuery({ ...q.locations(), enabled: !!character, staleTime: 300_000 });
  const location = locationsQuery.data?.find(
    (place) => place.id === character?.current_location_id,
  );
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
            <button
              type="button"
              className="entry-link"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <LogOut aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <>
              <Link to="/login" className="entry-link">
                Log in
              </Link>
              <Link to="/signup" className="entry-pill">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="entry-card" aria-labelledby="entry-title">
        <div className="entry-scene">
          {location?.image_url ? (
            <img src={location.image_url} alt="" className="entry-scene-photo" loading="eager" />
          ) : (
            <EntryTownPreview />
          )}
          {location && (
            <span className="entry-scene-tag">
              <MapPin aria-hidden="true" /> {location.name}
            </span>
          )}
        </div>

        <div className="entry-body">
          {character ? (
            <div className="entry-player">
              <div>
                <p className="entry-kicker">Your saved life</p>
                <h1 id="entry-title" className="entry-name">
                  {character.name}
                </h1>
                <p className="entry-meta">
                  Level {character.level}
                  {location ? ` · ${location.name}` : ""}
                </p>
              </div>
              <span className="entry-balance">
                <WalletCards aria-hidden="true" />
                {walletQuery.data ? formatNaira(walletQuery.data.balance) : "—"}
              </span>
            </div>
          ) : (
            <div className="entry-player">
              <div>
                <p className="entry-kicker">Osogbo awaits</p>
                <h1 id="entry-title" className="entry-name">
                  Make your life your own.
                </h1>
                <p className="entry-meta">
                  Create your character, find work, make a home, and build your story.
                </p>
              </div>
            </div>
          )}

          <Button asChild size="lg" className="entry-cta">
            <Link to={action.to}>
              {action.kind === "continue" ? "Continue to life" : "Sign up"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <small className="entry-note">Free to play. All naira amounts are fictional.</small>
        </div>
      </section>
    </main>
  );
}
