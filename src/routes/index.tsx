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
      { title: "SunLife — Virtual World Game in Osogbo, Nigeria" },
      {
        name: "description",
        content:
          "Step into SunLife, a vibrant 3D low-poly virtual world in Osogbo, Nigeria. Customize your character, find work, furnish your home, and explore a living city.",
      },
      { property: "og:title", content: "SunLife — Virtual World Game in Osogbo, Nigeria" },
      {
        property: "og:description",
        content:
          "Start your story or return to your virtual life in SunLife (Osogbo, Nigeria).",
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
  const [activeDistrictId, setActiveDistrictId] = useState<string>("market-quarter");

  // Interactive in-hero character customization state
  const [previewGender, setPreviewGender] = useState<"female" | "male">("female");
  const [previewSkinIndex, setPreviewSkinIndex] = useState<number>(1);
  const [previewOutfitIndex, setPreviewOutfitIndex] = useState<number>(0);

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

        {/* Active District Spotlight Card */}
        <aside className="sunlife-district-spotlight">
          <div>
            <h3 className="sunlife-spotlight-title">{currentDistrict.name}</h3>
            <p className="sunlife-spotlight-desc">{currentDistrict.description}</p>
            <div className="sunlife-spotlight-landmarks">
              {currentDistrict.landmarks.map((landmark) => (
                <span key={landmark} className="sunlife-spotlight-chip">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  <span>{landmark}</span>
                </span>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* 6. FAQ Accordion */}
      <section id="faq" className="sunlife-faq-section" aria-labelledby="faq-main-title">
        <div className="sunlife-section-center">
          <span className="sunlife-section-eyebrow">
            <ShieldCheck size={14} aria-hidden="true" /> FAQ
          </span>
          <h2 id="faq-main-title" className="sunlife-section-heading">
            Frequently Asked Questions
          </h2>
          <p className="sunlife-section-desc">
            Learn more about SunLife gameplay, economy, and device accessibility.
          </p>
        </div>

        <div className="sunlife-faq-stack">
          {FAQ_ENTRIES.map((faq, idx) => (
            <details key={faq.question} className="sunlife-faq-card" open={idx === 0}>
              <summary className="sunlife-faq-summary">
                <span>{faq.question}</span>
                <span className="sunlife-faq-chevron" aria-hidden="true">
                  <ChevronDown size={16} />
                </span>
              </summary>
              <p className="sunlife-faq-content">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="sunlife-footer">
        <div className="sunlife-footer-top">
          <Link to="/" aria-label="SunLife Home" className="sunlife-brand-link">
            <span className="sunlife-brand-text">
              Sun<span>Life</span>
            </span>
          </Link>

          <p className="sunlife-footer-copy">
            A stylized 3D low-poly virtual world game set in Osogbo, Nigeria. Designed with craft,
            vibrancy, and community.
          </p>

          <ul className="sunlife-footer-links" aria-label="Footer links">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
            <li>
              <Link to="/signup">Create Citizen</Link>
            </li>
            <li>
              <Link to="/login">Sign In</Link>
            </li>
          </ul>
        </div>

        <div className="sunlife-footer-bottom">
          <span>All virtual currency (₦ Naira) is simulated with zero real-world monetary value.</span>
          <span>© {new Date().getFullYear()} SunLife Virtual World. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}
