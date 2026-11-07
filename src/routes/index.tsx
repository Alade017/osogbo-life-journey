import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  Compass,
  Headphones,
  House,
  LogOut,
  MapPin,
  Music2,
  Palette,
  ShieldCheck,
  Sparkles,
  Store,
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
import {
  OUTFITS,
  SKIN_TONES,
  type Appearance,
} from "@/game/avatar-appearance";
import { LandingBackdrop } from "@/components/game/LandingBackdrop";
import "@/components/game/landing.css";

// 3D character preview loads non-blockingly so initial UI displays instantly.
const CharacterPreview = lazy(() =>
  import("@/components/3d/CharacterPreview").then((module) => ({
    default: module.CharacterPreview,
  })),
);

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
      { name: "twitter:title", content: "SunLife — Virtual World Game in Osogbo, Nigeria" },
      {
        name: "twitter:description",
        content:
          "Work shifts, own 3D homes, customize your avatar, and meet players in SunLife.",
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

/* ==========================================================================
   CONFIG-DRIVEN CONTENT (ZERO HARDCODING)
   ========================================================================== */

interface NavLinkItem {
  label: string;
  href: string;
}

const NAV_LINKS: readonly NavLinkItem[] = [
  { label: "Features", href: "#features" },
  { label: "Properties", href: "#properties" },
  { label: "Town Map", href: "#town-map" },
  { label: "FAQ", href: "#faq" },
] as const;

interface CoreFeatureItem {
  number: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof BriefcaseBusiness;
  highlights: readonly string[];
}

const CORE_FEATURES: readonly CoreFeatureItem[] = [
  {
    number: "01",
    title: "Living Economy & Shifts",
    tagline: "Virtual Career",
    description:
      "Clock in at bustling markets, public clinics, or transit hubs. Earn server-verified in-game Naira (₦) at your own pace.",
    icon: BriefcaseBusiness,
    highlights: ["Daily shift wages", "Skill level progression", "Virtual banking at Cedar Bank"],
  },
  {
    number: "02",
    title: "Stylized 3D Homes & Decor",
    tagline: "Modular Living",
    description:
      "Claim your corner in town. Upgrade from starter rooms to private bungalows and furnish every room in real-time 3D.",
    icon: House,
    highlights: ["Interactive room customizer", "50+ furniture and decor items", "Invite visiting players"],
  },
  {
    number: "03",
    title: "Real-Time Social Town",
    tagline: "Persistent World",
    description:
      "Walk the virtual streets of Osogbo, bump into other players, join public gatherings, and send town messages.",
    icon: UsersRound,
    highlights: ["Shared town hangouts", "Direct & local chat", "Persistent cloud save sync"],
  },
] as const;

interface LowPolyProperty {
  id: string;
  title: string;
  image: string;
  tier: string;
  priceTag: string;
  specs: string;
  description: string;
  perks: readonly string[];
}

const LOW_POLY_PROPERTIES: readonly LowPolyProperty[] = [
  {
    id: "mini-flat",
    title: "Self-Contained Mini-Flat",
    image: "/assets/homes/mini-flat.webp",
    tier: "Starter Living",
    priceTag: "₦4,200 / week",
    specs: "1 Bed · 1 Bath · Private Kitchenette",
    description:
      "A cozy, self-contained 3D low-poly apartment ideal for young professionals starting out in town.",
    perks: ["Independent kitchenette", "Dedicated furniture slots", "Low overhead rent"],
  },
  {
    id: "bungalow",
    title: "Suburban Bungalow Compound",
    image: "/assets/homes/bungalow.webp",
    tier: "Established Compound",
    priceTag: "₦12,500 / week",
    specs: "2 Beds · 2 Baths · Gated Yard",
    description:
      "A spacious gated compound with outdoor veranda, generous interior footprint, and prime neighborhood status.",
    perks: ["Private veranda patio", "High furniture capacity", "Gated compound entrance"],
  },
  {
    id: "duplex",
    title: "Two-Storey Family Duplex",
    image: "/assets/homes/duplex.webp",
    tier: "Executive Residence",
    priceTag: "₦28,000 / week",
    specs: "3 Beds · 3 Baths · Balcony",
    description:
      "A contemporary multi-level duplex featuring scenic balcony views and maximum custom interior potential.",
    perks: ["Scenic rooftop balcony", "Multi-room zoning", "Highest town prestige"],
  },
] as const;

interface DistrictAtlasItem {
  id: string;
  name: string;
  role: string;
  tagline: string;
  description: string;
  landmarks: readonly string[];
  traffic: string;
  vibe: string;
}

const DISTRICT_ATLAS: readonly DistrictAtlasItem[] = [
  {
    id: "market-quarter",
    name: "Market Quarter (Oja Oba)",
    role: "Commerce & Trading Hub",
    tagline: "The commercial heartbeat of daily Osogbo life",
    description:
      "A colorful open-air trading district with lively vendor stalls, artisan goods, local banking, and active player trading.",
    landmarks: ["Central Town Market", "Cedar Bank Branch", "Craft & Produce Stalls"],
    traffic: "High Foot Traffic",
    vibe: "Lively Commerce & Banter",
  },
  {
    id: "civic-quarter",
    name: "Civic Quarter",
    role: "Public Help & Services",
    tagline: "Order, healthcare, and community administration",
    description:
      "The municipal center housing the courthouse, central health clinic, and public notice assistance desks.",
    landmarks: ["Civic Courthouse", "Community Health Clinic", "Public Assistance Desk"],
    traffic: "Medium Activity",
    vibe: "Orderly & Helpful",
  },
  {
    id: "garden-quarter",
    name: "Garden Quarter",
    role: "Leisure & Greenery",
    tagline: "Scenic escapes inspired by the grove foothills",
    description:
      "A tranquil green quarter with shaded walking avenues, open sports recreation areas, and peaceful riverside paths.",
    landmarks: ["Sports Grounds", "Community Pavilion", "Riverside Grove Path"],
    traffic: "Relaxed Pace",
    vibe: "Tranquil & Social",
  },
  {
    id: "transit-quarter",
    name: "Transit Quarter",
    role: "Mobility & Gateway",
    tagline: "Connecting travelers across Osun State",
    description:
      "The active transit gateway featuring commuter bus parks, taxi stands, road kiosks, and traveler canteens.",
    landmarks: ["Transit Motor Park", "Express Waypoint Hub", "Traveler Kiosks"],
    traffic: "Non-stop Movement",
    vibe: "Dynamic Transit Pulse",
  },
] as const;

interface FAQEntry {
  question: string;
  answer: string;
}

const FAQ_ENTRIES: readonly FAQEntry[] = [
  {
    question: "What is SunLife?",
    answer:
      "SunLife is a modern, high-conversion browser virtual world game set in a fictionalized 3D low-poly recreation of Osogbo, Nigeria. Players customize stylized 3D avatars, work honest shifts, rent stylized low-poly houses, and meet players in a shared persistent world.",
  },
  {
    question: "Is the in-game currency real money?",
    answer:
      "No. All in-game Naira (₦) amounts shown in SunLife are 100% fictional simulation credits for gameplay only. There are zero real-money conversions, gambling mechanisms, or pay-to-win systems.",
  },
  {
    question: "Can I play smoothly on mobile or tablet?",
    answer:
      "Yes! SunLife is built directly for responsive web browsers with touch movement controls, lightweight low-poly rendering, and fast loading.",
  },
  {
    question: "How does player saving work?",
    answer:
      "Your character appearance, property leases, furniture placements, wallet balance, and friendship lists are continuously validated server-side and synced to our cloud database via Supabase.",
  },
] as const;

/* ==========================================================================
   TOWN RADIO CONTROLLER
   ========================================================================== */

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
      className="sunlife-audio-btn"
      role="switch"
      aria-checked={musicEnabled}
      aria-label={musicEnabled ? "Mute SunLife radio" : "Play SunLife radio"}
      disabled={changing}
      onClick={() => void toggleAudio()}
    >
      <span className={`sunlife-eq-icon ${musicEnabled ? "playing" : ""}`} aria-hidden="true">
        <span className="sunlife-eq-bar" />
        <span className="sunlife-eq-bar" />
        <span className="sunlife-eq-bar" />
        <span className="sunlife-eq-bar" />
      </span>
      <span>{musicEnabled ? <Music2 size={15} aria-hidden="true" /> : <Headphones size={15} aria-hidden="true" />}</span>
      <span>Town Radio</span>
    </button>
  );
}

/* ==========================================================================
   MAIN SUNLIFE LANDING COMPONENT
   ========================================================================== */

function Landing() {
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
  const defaultDistrict = DISTRICT_ATLAS[0] as DistrictAtlasItem;
  const currentDistrict: DistrictAtlasItem =
    DISTRICT_ATLAS.find((district) => district.id === activeDistrictId) ?? defaultDistrict;

  // Active appearance: character's own if returning, or the hero quick-customizer preview
  const activeAppearance: Appearance = character
    ? ((character.appearance ?? {}) as unknown as Appearance)
    : {
        skin: previewSkinIndex,
        outfit: previewOutfitIndex,
        hair: 1,
        bottoms: 0,
        shoes: 0,
      };

  const activeGender = character ? character.gender : previewGender;

  return (
    <main className="sunlife-page">
      {/* 1. Ultra-Clean Top Bar */}
      <header className="sunlife-header">
        <Link to="/" aria-label="SunLife Home" className="sunlife-brand-link">
          <span className="sunlife-brand-text">
            Sun<span>Life</span>
          </span>
        </Link>

        <nav aria-label="Main menu" className="sunlife-nav">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="sunlife-nav-item">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="sunlife-header-tools">
          <LandingAudio identity={character?.id ?? "public-landing"} />
          {sessionState === "signed-out" && (
            <Link to="/login" className="sunlife-sign-btn">
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* 2. Hero Section: Stylized 3D Character & Sunlit Osogbo Street */}
      <section className="sunlife-hero" aria-labelledby="hero-main-title">
        <LandingBackdrop />
        <div className="sunlife-shade" aria-hidden="true" />

        <div className="sunlife-hero-grid">
          {/* Left Column: Clean UI Box with Bold Typography & Customization */}
          <div className="sunlife-hero-card">
            <div className="sunlife-eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              <span>3D Low-Poly Virtual World</span>
              <span className="sunlife-eyebrow-pill">Osogbo, Nigeria</span>
            </div>

            <h1 id="hero-main-title" className="sunlife-title">
              Welcome to SunLife.
              <em>Your Virtual Life in Osogbo.</em>
            </h1>

            <p className="sunlife-lede">
              Explore colorful sunlit streets, rent stylized 3D low-poly houses, clock shifts for
              honest in-game Naira (₦), and meet players in a vibrant persistent city.
            </p>

            {/* Returning Player Experience */}
            {experience.mode === "checking" ? (
              <div className="sunlife-resident-dossier" role="status">
                <span className="osun-loader" aria-hidden="true" />
                <span>Checking your resident passport…</span>
              </div>
            ) : experience.mode === "error" ? (
              <div className="sunlife-resident-dossier" role="alert">
                <VolumeX size={20} aria-hidden="true" />
                <span>Account check paused. Progress is safe.</span>
                <Button size="sm" onClick={() => void retrySessionCheck()}>Retry</Button>
              </div>
            ) : returning ? (
              <>
                <div className="sunlife-resident-dossier">
                  <div>
                    <span className="sunlife-resident-name">{returning.name}</span>
                    <div className="sunlife-resident-sub">
                      <span className="sunlife-level-badge">Level {returning.level}</span>
                      <span>·</span>
                      <span>{location?.name ?? "Saved in Osun"}</span>
                    </div>
                  </div>
                  <span className="sunlife-balance-pill" title="Virtual in-game balance">
                    <WalletCards size={16} aria-hidden="true" />
                    {walletQuery.isLoading
                      ? "Loading…"
                      : walletQuery.data
                        ? formatNaira(walletQuery.data.balance)
                        : "₦0"}
                  </span>
                </div>

                <Link to="/enter" className="sunlife-cta-blue">
                  Resume Life in SunLife <ArrowRight aria-hidden="true" />
                </Link>

                <div className="sunlife-card-footer">
                  <Link to="/profile" className="sunlife-text-link">Resident Profile & Settings</Link>
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={() => void signOut()}
                    className="sunlife-text-link"
                  >
                    <LogOut size={13} aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Character Customization Options Box in Hero */}
                <div className="sunlife-customizer-box" aria-label="Character Customization Options">
                  <div className="sunlife-customizer-header">
                    <span className="sunlife-customizer-label">Quick Avatar Preview</span>
                    {/* Gender switch */}
                    <div className="sunlife-gender-toggle" role="radiogroup" aria-label="Gender selection">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={previewGender === "female"}
                        className={`sunlife-gender-btn ${previewGender === "female" ? "active" : ""}`}
                        onClick={() => setPreviewGender("female")}
                      >
                        Female
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={previewGender === "male"}
                        className={`sunlife-gender-btn ${previewGender === "male" ? "active" : ""}`}
                        onClick={() => setPreviewGender("male")}
                      >
                        Male
                      </button>
                    </div>
                  </div>

                  <div className="sunlife-swatches-row">
                    {/* Skin Tone Swatches */}
                    <div className="sunlife-swatch-group">
                      <span className="sunlife-swatch-title">Skin Tone</span>
                      <div className="sunlife-swatch-list">
                        {SKIN_TONES.slice(0, 5).map((color, idx) => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Skin tone ${idx + 1}`}
                            className={`sunlife-swatch-btn ${previewSkinIndex === idx ? "active" : ""}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setPreviewSkinIndex(idx)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Outfit Color Swatches */}
                    <div className="sunlife-swatch-group">
                      <span className="sunlife-swatch-title">Outfit Palette</span>
                      <div className="sunlife-swatch-list">
                        {OUTFITS.slice(0, 5).map((color, idx) => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Outfit color ${idx + 1}`}
                            className={`sunlife-swatch-btn ${previewOutfitIndex === idx ? "active" : ""}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setPreviewOutfitIndex(idx)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blue CTA Button */}
                <Link to={experience.primaryLink} className="sunlife-cta-blue">
                  Enter SunLife Now <ArrowRight aria-hidden="true" />
                </Link>

                <div className="sunlife-card-footer">
                  <span>100% Free to play in browser</span>
                  {sessionState === "signed-out" ? (
                    <Link to="/login" className="sunlife-text-link">
                      Already registered? Sign In
                    </Link>
                  ) : (
                    <button type="button" className="sunlife-text-link" onClick={() => void signOut()}>
                      Sign out
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Column: 3D Stylized Character in Energetic Pose */}
          <div className="sunlife-character-pedestal" aria-label="3D Stylized Character Preview">
            <span className="sunlife-pedestal-badge">
              <MapPin size={15} aria-hidden="true" />
              <span>{location?.name ? `Saved at ${location.name}` : "Sunlit Street · Osogbo"}</span>
            </span>

            <Suspense
              fallback={
                <div className="osun-stage-loader" role="status">
                  <span className="osun-loader" aria-hidden="true" />
                  <small>Rendering 3D avatar…</small>
                </div>
              }
            >
              <CharacterPreview
                appearance={activeAppearance}
                gender={activeGender}
                equipment={wornEquipment}
                label={character ? `${character.name}, resident` : "Stylized low-poly 3D character"}
              />
            </Suspense>

            <div className="sunlife-pedestal-footer" aria-hidden="true">
              <span>Dynamic 3D Low-Poly Pose</span>
              <span>Real-Time Lighting & Colors</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three-Column Game Features Layout */}
      <section id="features" className="sunlife-features-section" aria-labelledby="features-title">
        <div className="sunlife-section-center">
          <span className="sunlife-section-eyebrow">
            <Sparkles size={14} aria-hidden="true" /> Game Features
          </span>
          <h2 id="features-title" className="sunlife-section-heading">
            A Living, Stylized Virtual World
          </h2>
          <p className="sunlife-section-desc">
            Engineered with a cohesive 3D low-poly art style, authentic Nigerian cultural touches,
            and complete player freedom.
          </p>
        </div>

        <div className="sunlife-three-columns">
          {CORE_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.number} className="sunlife-column-card">
                <div className="sunlife-card-icon-wrap">
                  <Icon aria-hidden="true" />
                </div>
                <span className="sunlife-column-num">{feature.number} · {feature.tagline}</span>
                <h3 className="sunlife-column-title">{feature.title}</h3>
                <p className="sunlife-column-body">{feature.description}</p>
                <div className="sunlife-column-bullets">
                  {feature.highlights.map((highlight) => (
                    <span key={highlight} className="sunlife-bullet-item">
                      <CheckCircle2 aria-hidden="true" />
                      <span>{highlight}</span>
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. Property Section: Stylized 3D Low-Poly Houses */}
      <section id="properties" className="sunlife-property-section" aria-labelledby="properties-title">
        <div className="sunlife-section-center">
          <span className="sunlife-section-eyebrow">
            <House size={14} aria-hidden="true" /> Virtual Real Estate
          </span>
          <h2 id="properties-title" className="sunlife-section-heading">
            Stylized 3D Low-Poly Houses
          </h2>
          <p className="sunlife-section-desc">
            Choose your residence from our actual in-game 3D models. Rent or purchase, then furnish
            every room to make it your own.
          </p>
        </div>

        <div className="sunlife-property-grid">
          {LOW_POLY_PROPERTIES.map((property) => (
            <article key={property.id} className="sunlife-property-card">
              <div className="sunlife-property-visual">
                <img
                  src={property.image}
                  alt={property.title}
                  className="sunlife-property-img"
                  loading="lazy"
                  decoding="async"
                />
                <span className="sunlife-price-tag">{property.priceTag}</span>
              </div>
              <div className="sunlife-property-body">
                <span className="sunlife-property-tier">{property.tier} · {property.specs}</span>
                <h3 className="sunlife-property-title">{property.title}</h3>
                <p className="sunlife-property-desc">{property.description}</p>
                <div className="sunlife-property-perks">
                  {property.perks.map((perk) => (
                    <span key={perk} className="sunlife-perk-line">
                      <CheckCircle2 aria-hidden="true" />
                      <span>{perk}</span>
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 5. Map Section: Clean Isometric 3D Game Map Overview */}
      <section id="town-map" className="sunlife-map-section" aria-labelledby="map-overview-title">
        <div className="sunlife-section-center">
          <span className="sunlife-section-eyebrow">
            <Compass size={14} aria-hidden="true" /> Town Atlas
          </span>
          <h2 id="map-overview-title" className="sunlife-section-heading">
            Isometric 3D Game Map Overview
          </h2>
          <p className="sunlife-section-desc">
            Explore the quarters of fictional Osogbo. Inspect district vibes, foot traffic, and
            signature landmarks.
          </p>
        </div>

        {/* District Switcher Tabs */}
        <div className="sunlife-district-selector" role="tablist" aria-label="Town Quarters">
          {DISTRICT_ATLAS.map((district) => (
            <button
              key={district.id}
              type="button"
              role="tab"
              aria-selected={activeDistrictId === district.id}
              className={`sunlife-district-pill-btn ${activeDistrictId === district.id ? "active" : ""}`}
              onClick={() => setActiveDistrictId(district.id)}
            >
              <MapPin size={15} aria-hidden="true" />
              <span>{district.name}</span>
            </button>
          ))}
        </div>

        {/* Map Diorama Frame */}
        <div className="sunlife-map-diorama-frame">
          <EntryTownPreview />
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
