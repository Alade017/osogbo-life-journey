import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, LogOut, MapPin, WalletCards } from "lucide-react";
import { EntryTownPreview } from "@/components/game/EntryTownPreview";
import { findLandmarkCell } from "@/components/game/entry-town-preview";
import landingCopy from "@/data/landing-copy.json";
import town from "@/data/osogbo-town.json";
import { Logo } from "@/components/game/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";
import { entryAction, type EntrySession } from "@/lib/entry-action";
import { districtSpotlight } from "@/lib/district-spotlight";
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
  // Live data: which places are open, and the counts shown on the page. Works for everyone.
  const locationsQuery = useQuery({ ...q.locations(), staleTime: 300_000 });
  const jobsQuery = useQuery({ ...q.jobs(), staleTime: 300_000 });
  const activitiesQuery = useQuery({ ...q.activities(), staleTime: 300_000 });
  const location = locationsQuery.data?.find(
    (place) => place.id === character?.current_location_id,
  );
  const activeSlugs = useMemo(
    () => (locationsQuery.data ? new Set(locationsQuery.data.map((place) => place.slug)) : null),
    [locationsQuery.data],
  );
  const lastStop = findLandmarkCell(location?.slug);
  const action = entryAction(sessionState, Boolean(character));
  const currentDistrict = districtSpotlight(location?.slug);
  const glance = [
    { label: landingCopy.glanceLabels.districts, value: String(town.districts.length) },
    {
      label: landingCopy.glanceLabels.places,
      value: String(activeSlugs ? activeSlugs.size : town.landmarks.length),
    },
    {
      label: landingCopy.glanceLabels.jobs,
      value: jobsQuery.data ? String(jobsQuery.data.length) : "—",
    },
    {
      label: landingCopy.glanceLabels.activities,
      value: activitiesQuery.data ? String(activitiesQuery.data.length) : "—",
    },
  ];

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
          <EntryTownPreview
            focus={lastStop}
            focusLabel={location?.name ?? null}
            activeSlugs={activeSlugs}
          />
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
                <p className="entry-kicker">{landingCopy.signedOut.kicker}</p>
                <h1 id="entry-title" className="entry-name">
                  {landingCopy.signedOut.title}
                </h1>
                <p className="entry-meta">{landingCopy.signedOut.body}</p>
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

      <section className="entry-glance" aria-labelledby="glance-title">
        <h2 id="glance-title" className="entry-section-title">
          The town at a glance
        </h2>
        <dl className="entry-glance-grid">
          {glance.map((item) => (
            <div key={item.label} className="entry-glance-item">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="entry-steps" aria-labelledby="steps-title">
        <h2 id="steps-title" className="entry-section-title">
          How it works
        </h2>
        <ol className="entry-steps-list">
          {landingCopy.howItWorks.map((step, index) => (
            <li key={step.title} className="entry-step">
              <span className="entry-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {currentDistrict && (
        <aside className="sunlife-district-spotlight" aria-labelledby="district-title">
          <h2 id="district-title" className="sunlife-spotlight-title">
            {currentDistrict.name}
          </h2>
          <p className="sunlife-spotlight-desc">{currentDistrict.description}</p>
          <div className="sunlife-spotlight-landmarks">
            {currentDistrict.landmarks.map((landmark) => (
              <span key={landmark} className="sunlife-spotlight-chip">
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>{landmark}</span>
              </span>
            ))}
          </div>
        </aside>
      )}
    </main>
  );
}
