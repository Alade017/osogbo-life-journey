import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Compass, Home, LogOut, MapPin, Sparkles, WalletCards } from "lucide-react";
import { EntryTownPreview } from "@/components/game/EntryTownPreview";
import { findLandmarkForSlug } from "@/components/game/entry-town-preview";
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
      { name: "description", content: "Create your character, find work, make a home, and build a life across a fictional Osun-inspired world." },
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
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSessionState(session ? "signed-in" : "signed-out"));
    void readSessionState().then((state) => { if (active) setSessionState(state); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const signedIn = sessionState === "signed-in";
  const characterQuery = useQuery({ ...q.character(), enabled: signedIn, staleTime: 30_000 });
  const character = characterQuery.data;
  const walletQuery = useQuery({ ...q.wallet(), enabled: !!character, staleTime: 30_000 });
  const locationsQuery = useQuery({ ...q.locations(), staleTime: 300_000 });
  const jobsQuery = useQuery({ ...q.jobs(), staleTime: 300_000 });
  const activitiesQuery = useQuery({ ...q.activities(), staleTime: 300_000 });
  const location = locationsQuery.data?.find((place) => place.id === character?.current_location_id);
  const activeSlugs = useMemo(() => locationsQuery.data ? new Set(locationsQuery.data.map((place) => place.slug)) : null, [locationsQuery.data]);
  const focusLandmarkId = findLandmarkForSlug(location?.slug)?.id ?? null;
  const action = entryAction(sessionState, Boolean(character));
  const currentDistrict = districtSpotlight(location?.slug);
  const glance = [
    { label: landingCopy.glanceLabels.districts, value: String(town.districts.length) },
    { label: landingCopy.glanceLabels.places, value: String(activeSlugs ? activeSlugs.size : town.landmarks.length) },
    { label: landingCopy.glanceLabels.jobs, value: jobsQuery.data ? String(jobsQuery.data.length) : "—" },
    { label: landingCopy.glanceLabels.activities, value: activitiesQuery.data ? String(activitiesQuery.data.length) : "—" },
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
        <Link to="/" aria-label="OSUN LIFE home" className="entry-brand"><Logo small /><span>OSUN LIFE</span></Link>
        <nav className="entry-main-nav" aria-label="Main navigation">
          <a href="#world">The world</a><a href="#experience">Your life</a><a href="#how-to-play">How to play</a>
        </nav>
        <nav className="entry-auth" aria-label="Account">
          {signedIn ? (
            <button type="button" className="entry-link" disabled={signingOut} onClick={() => void signOut()}>
              <LogOut aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <><Link to="/login" className="entry-link">Log in</Link><Link to="/signup" className="entry-pill">Create account</Link></>
          )}
        </nav>
      </header>

      <section className="entry-hero" aria-labelledby="entry-title">
        <div className="entry-hero-copy">
          <p className="entry-eyebrow"><Sparkles aria-hidden="true" /> A Nigerian life simulation</p>
          {character ? (
            <>
              <p className="entry-kicker">Welcome back to your story</p>
              <h1 id="entry-title" className="entry-title">Good to see you, <span>{character.name}.</span></h1>
              <p className="entry-description">Your neighbourhood is still moving. Pick up where you left off and keep shaping your life.</p>
            </>
          ) : (
            <>
              <p className="entry-kicker">{landingCopy.signedOut.kicker}</p>
              <h1 id="entry-title" className="entry-title">Your next chapter starts <span>in Osun.</span></h1>
              <p className="entry-description">{landingCopy.signedOut.body} Explore a living, Osogbo-inspired world built around everyday Nigerian life.</p>
            </>
          )}
          <div className="entry-hero-actions">
            <Button asChild size="lg" className="entry-cta">
              <Link to={action.to}>{action.kind === "continue" ? "Continue your life" : "Start your story"}<ArrowRight aria-hidden="true" /></Link>
            </Button>
            {!signedIn && <Link to="/login" className="entry-secondary-action">I already have an account</Link>}
          </div>
          <div className="entry-trust-row">
            <span><CheckCircle2 aria-hidden="true" /> Free to play</span><span><MapPin aria-hidden="true" /> Inspired by Osun State</span>
          </div>
          {character && (
            <div className="entry-return-card">
              <div><span className="entry-return-label">Your current life</span><strong>Level {character.level}{location ? ` · ${location.name}` : ""}</strong></div>
              <span className="entry-balance"><WalletCards aria-hidden="true" />{walletQuery.data ? formatNaira(walletQuery.data.balance) : "Loading balance"}</span>
            </div>
          )}
        </div>

        <div className="entry-hero-visual" id="world">
          <div className="entry-scene-frame">
            <EntryTownPreview focusLandmarkId={focusLandmarkId} focusLabel={location?.name ?? null} activeSlugs={activeSlugs} />
            {location && <span className="entry-scene-tag"><MapPin aria-hidden="true" /> {location.name}</span>}
            <div className="entry-scene-caption"><span className="entry-live-dot" /><span>Explore the neighbourhood</span><span className="entry-caption-arrow"><ArrowRight aria-hidden="true" /></span></div>
          </div>
          <div className="entry-visual-note">
            <span className="entry-visual-note-icon"><Compass aria-hidden="true" /></span>
            <span><strong>A world with room to grow</strong><small>Places to visit. People to meet. Stories to make.</small></span>
          </div>
        </div>
      </section>

      <section className="entry-glance" aria-labelledby="glance-title">
        <div className="entry-section-heading"><p className="entry-section-kicker">The world, at a glance</p><h2 id="glance-title" className="entry-section-title">A town full of possibilities.</h2></div>
        <dl className="entry-glance-grid">
          {glance.map((item, index) => <div key={item.label} className="entry-glance-item"><dt>{item.label}</dt><dd>{item.value}</dd><span className="entry-stat-index">0{index + 1}</span></div>)}
        </dl>
      </section>

      <section className="entry-experience" id="experience" aria-labelledby="experience-title">
        <div className="entry-experience-intro">
          <p className="entry-section-kicker">Make it your own</p><h2 id="experience-title">More than a place to visit. A life to build.</h2>
          <p>Shape your days through the places you go, the work you take on and the home you make.</p>
        </div>
        <div className="entry-feature-grid">
          <article className="entry-feature-card"><span className="entry-feature-icon"><Compass aria-hidden="true" /></span><p className="entry-feature-number">01 / EXPLORE</p><h3>Find your way around</h3><p>Move through neighbourhoods, discover local spots and make the town feel familiar.</p></article>
          <article className="entry-feature-card"><span className="entry-feature-icon"><BriefcaseBusiness aria-hidden="true" /></span><p className="entry-feature-number">02 / EARN</p><h3>Work towards more</h3><p>Find opportunities, earn money and make choices about how your life develops.</p></article>
          <article className="entry-feature-card"><span className="entry-feature-icon"><Home aria-hidden="true" /></span><p className="entry-feature-number">03 / SETTLE</p><h3>Create a place of your own</h3><p>Make a home, shape your space and build a routine that feels like yours.</p></article>
        </div>
      </section>

      <section className="entry-steps" id="how-to-play" aria-labelledby="steps-title">
        <div className="entry-section-heading"><p className="entry-section-kicker">A new story is waiting</p><h2 id="steps-title" className="entry-section-title">Start simple. Build from there.</h2></div>
        <ol className="entry-steps-list">
          {landingCopy.howItWorks.map((step, index) => (
            <li key={step.title} className="entry-step"><span className="entry-step-number" aria-hidden="true">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div><ArrowRight className="entry-step-arrow" aria-hidden="true" /></li>
          ))}
        </ol>
      </section>

      {currentDistrict && (
        <aside className="sunlife-district-spotlight" aria-labelledby="district-title">
          <div><p className="entry-section-kicker">Your neighbourhood</p><h2 id="district-title" className="sunlife-spotlight-title">{currentDistrict.name}</h2><p className="sunlife-spotlight-desc">{currentDistrict.description}</p></div>
          <div className="sunlife-spotlight-landmarks">
            {currentDistrict.landmarks.map((landmark) => <span key={landmark} className="sunlife-spotlight-chip"><CheckCircle2 size={13} aria-hidden="true" /><span>{landmark}</span></span>)}
          </div>
        </aside>
      )}

      <section className="entry-bottom-cta">
        <p className="entry-section-kicker">Your story is yours to shape</p><h2>{character ? "Ready to get back out there?" : "Come make a life of your own."}</h2>
        <p>Step into OSUN LIFE and see where the day takes you.</p>
        <Button asChild size="lg" className="entry-cta"><Link to={action.to}>{action.kind === "continue" ? "Continue your life" : "Create your character"}<ArrowRight aria-hidden="true" /></Link></Button>
      </section>

      <footer className="entry-footer">
        <Link to="/" aria-label="OSUN LIFE home" className="entry-footer-brand"><Logo small /><span>OSUN LIFE</span></Link>
        <p>A fictional world inspired by everyday life in Osun State.</p><span>Free to play · All naira amounts are fictional.</span>
      </footer>
    </main>
  );
}
