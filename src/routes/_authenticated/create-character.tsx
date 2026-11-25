import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  RotateCcw,
  RotateCw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/game";
import {
  BODY_BUILDS,
  BODY_HEIGHTS,
  HAIR_COLORS,
  HAIR_STYLES_BY_GENDER,
  OUTFITS,
  SKIN_TONES,
  TROUSERS,
  type Appearance,
  type AvatarAnimationState,
} from "@/components/game/Avatar";
import { CharacterPreview } from "@/components/3d/CharacterPreview";
import "@/components/game/profile-inventory.css";
import "@/components/game/character-studio.css";
import {
  appearanceForGender,
  DEFAULT_CHARACTER_APPEARANCE,
  randomizeCharacterAppearance,
} from "@/lib/character-appearance";
import { GameDataUnavailable, LoadingState } from "@/components/game/ui";
import { PaletteSelect } from "@/components/ui/palette-select";

export const Route = createFileRoute("/_authenticated/create-character")({
  head: () => ({
    meta: [
      { title: "Create your character — OSUN LIFE" },
      {
        name: "description",
        content: "Create a look, choose your story, and begin your Osogbo life.",
      },
    ],
  }),
  component: CreateCharacter,
});
const GENDERS = [
  { v: "female", l: "Female" },
  { v: "male", l: "Male" },
  { v: "nonbinary", l: "Non-binary" },
];
const PERSONALITIES = [
  { v: "ambitious", l: "Ambitious", d: "+5 Career", text: "You see possibilities everywhere." },
  {
    v: "creative",
    l: "Creative",
    d: "+3 Intelligence, +2 Happiness",
    text: "You make something out of anything.",
  },
  { v: "social", l: "Social", d: "+5 Social", text: "A new face is a friend to be made." },
  { v: "studious", l: "Studious", d: "+5 Intelligence", text: "There is always more to discover." },
  {
    v: "easygoing",
    l: "Easygoing",
    d: "+5 Happiness",
    text: "You take life one good day at a time.",
  },
];
const STEPS = ["Appearance", "Your story", "Review"];
function Picker({
  label,
  options,
  value,
  onChange,
  swatches = false,
}: {
  label: string;
  options: string[];
  value: number;
  onChange: (n: number) => void;
  swatches?: boolean;
}) {
  return (
    <fieldset className="cs-picker">
      <legend>
        {label}
        <span>{swatches ? `Tone ${value + 1}` : options[value]}</span>
      </legend>
      <div className={swatches ? "cs-swatches" : "cs-options"}>
        {options.map((option, index) => (
          <button
            key={option + index}
            type="button"
            aria-label={swatches ? `${label}, option ${index + 1}` : option}
            aria-pressed={value === index}
            onClick={() => onChange(index)}
            style={swatches ? { backgroundColor: option } : undefined}
          >
            {swatches ? value === index ? <Check size={16} /> : null : option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function CreateCharacter() {
  const navigate = useNavigate(),
    client = useQueryClient();
  const character = useQuery(q.character()),
    jobs = useQuery(q.jobs());
  const [name, setName] = useState(""),
    [gender, setGender] = useState("female"),
    [age, setAge] = useState("22"),
    [personality, setPersonality] = useState("ambitious"),
    [occupation, setOccupation] = useState("");
  const [appearance, setAppearance] = useState<Required<Appearance>>({
    ...DEFAULT_CHARACTER_APPEARANCE,
  });
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [motion, setMotion] = useState<AvatarAnimationState>("idle"),
    [rotation, setRotation] = useState(0);
  const submitting = useRef(false),
    panel = useRef<HTMLDivElement>(null);
  const cleanName = name.trim(),
    ageNumber = Number(age);
  const validName = cleanName.length >= 2 && cleanName.length <= 24;
  const validAge = age !== "" && Number.isInteger(ageNumber) && ageNumber >= 16 && ageNumber <= 60;
  const valid = validName && validAge && !jobs.isPending && !jobs.isError;
  const trait = PERSONALITIES.find((p) => p.v === personality)!;
  const hairs = HAIR_STYLES_BY_GENDER[gender] ?? HAIR_STYLES_BY_GENDER["nonbinary"]!;
  useEffect(() => {
    if (character.data) void navigate({ to: "/enter" });
  }, [character.data, navigate]);
  function update(key: keyof Appearance, value: number) {
    setAppearance((current) => ({ ...current, [key]: value }));
  }
  function go(next: number) {
    setStep(next);
    panel.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }
  async function submit() {
    if (submitting.current || !valid || character.data) return;
    submitting.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_character", {
        p_name: cleanName,
        p_gender: gender,
        p_appearance: { ...appearance, shoes: 0, headwear: 0, clothed: true },
        p_age: ageNumber,
        p_personality: personality,
        p_occupation: occupation || null,
      } as never);
      if (error) throw error;
      await client.invalidateQueries();
      toast.success(`Welcome to Osogbo, ${cleanName}!`);
      await navigate({ to: "/enter" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Your character could not be created. Please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (character.isPending)
    return (
      <div className="cs-page">
        <LoadingState />
      </div>
    );
  if (character.isError)
    return (
      <GameDataUnavailable
        error={character.error}
        onRetry={() => void character.refetch()}
        isRetrying={character.isRefetching}
      />
    );
  if (character.data)
    return (
      <div className="cs-page">
        <LoadingState />
      </div>
    );
  return (
    <main className="cs-page">
      <header className="cs-header">
        <a href="/" className="cs-brand">
          <span aria-hidden="true">O.</span> OSUN LIFE
        </a>
        <span className="cs-header-note">A new life. Your own way.</span>
      </header>
      <div className="cs-heading">
        <p className="cs-eyebrow">WELCOME TO YOUR NEXT CHAPTER</p>
        <h1>
          Create your character<span>.</span>
        </h1>
        <p>A familiar face. A little personality. A whole city of possibilities.</p>
      </div>
      <div className="cs-layout">
        <section className="cs-stage" aria-label="Character preview studio">
          <div className="cs-stage-top">
            <span>
              <span className="cs-dot" /> LIVE PREVIEW
            </span>
            <span>OSOGBO · YOUR STORY</span>
          </div>
          <div className="cs-stage-caption">
            <h2>{cleanName || "Meet your new self"}</h2>
            <p>
              {BODY_BUILDS[appearance.build]} build · {BODY_HEIGHTS[appearance.stature]} height
            </p>
          </div>
          <CharacterPreview
            appearance={appearance}
            gender={gender}
            equipment={[]}
            label={`${cleanName || "Your character"} preview`}
            interactive
            animation={motion}
            rotation={rotation}
          />
          <div className="cs-turn">
            <button
              type="button"
              aria-label="Rotate character left"
              onClick={() => setRotation((r) => r - Math.PI / 4)}
            >
              <RotateCcw size={17} />
            </button>
            <span>Drag to look around</span>
            <button
              type="button"
              aria-label="Rotate character right"
              onClick={() => setRotation((r) => r + Math.PI / 4)}
            >
              <RotateCw size={17} />
            </button>
          </div>
          <div className="cs-motion" role="group" aria-label="Preview animation">
            {(
              [
                { id: "idle", label: "Stand" },
                { id: "walk", label: "Walk" },
                { id: "dance", label: "Dance" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={motion === m.id}
                onClick={() => setMotion(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="cs-stage-footer">
            <span>
              <Sparkles size={15} /> Made by you
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAppearance(randomizeCharacterAppearance(gender))}
            >
              <Shuffle size={15} /> Surprise me
            </button>
          </div>
        </section>
        <div className="cs-panel" ref={panel}>
          <nav className="cs-steps" aria-label="Character creation steps">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                aria-current={step === index ? "step" : undefined}
                disabled={busy || (index === 2 && !valid)}
                onClick={() => go(index)}
              >
                <span>
                  {index < step ? <Check size={14} /> : String(index + 1).padStart(2, "0")}
                </span>
                {label}
              </button>
            ))}
          </nav>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 2) {
                if (step === 0 || valid) go(step + 1);
              } else void submit();
            }}
          >
            <fieldset className="cs-fields" disabled={busy}>
              <legend className="cs-sr">{STEPS[step]}</legend>
              {step === 0 && (
                <>
                  <div className="cs-section-heading">
                    <div>
                      <p className="cs-eyebrow">01 / THE FIRST IMPRESSION</p>
                      <h2>Find your look</h2>
                      <p>Make it feel like you, or someone entirely new.</p>
                    </div>
                    <button
                      className="cs-text-button"
                      type="button"
                      onClick={() => setAppearance({ ...DEFAULT_CHARACTER_APPEARANCE })}
                    >
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                  <Picker
                    label="Presentation"
                    options={GENDERS.map((g) => g.l)}
                    value={GENDERS.findIndex((g) => g.v === gender)}
                    onChange={(i) => {
                      const next = GENDERS[i]!.v;
                      setGender(next);
                      setAppearance((a) => appearanceForGender(a, next));
                    }}
                  />
                  <Picker
                    label="Skin tone"
                    options={SKIN_TONES}
                    value={appearance.skin}
                    onChange={(n) => update("skin", n)}
                    swatches
                  />
                  <div className="cs-pair">
                    <Picker
                      label="Height"
                      options={BODY_HEIGHTS}
                      value={appearance.stature}
                      onChange={(n) => update("stature", n)}
                    />
                    <Picker
                      label="Build"
                      options={BODY_BUILDS}
                      value={appearance.build}
                      onChange={(n) => update("build", n)}
                    />
                  </div>
                  <div className="cs-divider" />
                  <Picker
                    label="Hairstyle"
                    options={hairs}
                    value={appearance.hair}
                    onChange={(n) => update("hair", n)}
                  />
                  <Picker
                    label="Hair colour"
                    options={HAIR_COLORS}
                    value={appearance.hairColor}
                    onChange={(n) => update("hairColor", n)}
                    swatches
                  />
                  <div className="cs-divider" />
                  <div className="cs-section-heading">
                    <div>
                      <h3>Your first outfit</h3>
                      <p>Start simple. Discover more styles in the city.</p>
                    </div>
                  </div>
                  <div className="cs-outfit">
                    <Picker
                      label="Top"
                      options={OUTFITS}
                      value={appearance.outfit}
                      onChange={(n) => update("outfit", n)}
                      swatches
                    />
                    <Picker
                      label="Trousers"
                      options={TROUSERS}
                      value={appearance.bottoms}
                      onChange={(n) => update("bottoms", n)}
                      swatches
                    />
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="cs-section-heading">
                    <div>
                      <p className="cs-eyebrow">02 / A LITTLE ABOUT YOU</p>
                      <h2>Give your story a start</h2>
                      <p>The rest is yours to discover.</p>
                    </div>
                  </div>
                  <div className="cs-identity">
                    <div className="cs-identity-field">
                      <label htmlFor="character-name">Character name</label>
                      <input
                        id="character-name"
                        maxLength={24}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="What should we call you?"
                        autoComplete="off"
                        aria-invalid={name.length > 0 && !validName}
                        aria-describedby="name-help"
                      />
                      <small id="name-help">
                        {name.length > 0 && !validName
                          ? "Use 2 to 24 characters."
                          : "Your name around the city. 2–24 characters."}
                      </small>
                    </div>
                    <div className="cs-identity-field">
                      <label htmlFor="character-age">Age</label>
                      <input
                        id="character-age"
                        type="number"
                        min={16}
                        max={60}
                        step={1}
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        aria-invalid={!validAge}
                        aria-describedby="age-help"
                      />
                      <small id="age-help">16–60 years</small>
                    </div>
                  </div>
                  <fieldset className="cs-picker">
                    <legend>What drives you?</legend>
                    <div className="cs-traits">
                      {PERSONALITIES.map((p) => (
                        <button
                          key={p.v}
                          type="button"
                          aria-pressed={personality === p.v}
                          onClick={() => setPersonality(p.v)}
                        >
                          <span className="cs-trait-title">
                            {p.l}
                            {personality === p.v && <CheckCheck size={17} />}
                          </span>
                          <span>{p.text}</span>
                          <small>{p.d}</small>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="cs-career">
                    <label htmlFor="character-career">
                      A career to work towards <span>Optional</span>
                    </label>
                    <PaletteSelect
                      id="character-career"
                      value={occupation}
                      onValueChange={setOccupation}
                      disabled={jobs.isPending || jobs.isError}
                      options={[
                        {
                          value: "",
                          label: jobs.isPending ? "Loading careers…" : "I’m still exploring",
                        },
                        ...(jobs.data ?? []).map((j) => ({ value: j.slug, label: j.name })),
                      ]}
                    />
                    <p>Your preference gives you a direction. Job requirements still apply.</p>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="cs-section-heading">
                    <div>
                      <p className="cs-eyebrow">03 / THE CITY IS WAITING</p>
                      <h2>This is your beginning</h2>
                      <p>One last look before your first day in Osogbo.</p>
                    </div>
                  </div>
                  <div className="cs-review">
                    <span className="cs-review-mark">
                      <CheckCheck size={27} />
                    </span>
                    <p className="cs-eyebrow">YOUR NEW OSOGBO LIFE</p>
                    <h3>{cleanName}</h3>
                    <p>
                      {ageNumber} years old · {GENDERS.find((g) => g.v === gender)?.l} · {trait.l}
                    </p>
                    <dl>
                      <div>
                        <dt>Your style</dt>
                        <dd>
                          {hairs[appearance.hair]} · {BODY_BUILDS[appearance.build]}
                        </dd>
                      </div>
                      <div>
                        <dt>Your outlook</dt>
                        <dd>{trait.text}</dd>
                      </div>
                      <div>
                        <dt>Your direction</dt>
                        <dd>
                          {jobs.data?.find((j) => j.slug === occupation)?.name ||
                            "Open to possibilities"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <p className="cs-review-note">
                    You can change your wardrobe as you explore. Your character name, age,
                    presentation and personality will be saved when you begin.
                  </p>
                </>
              )}
            </fieldset>
            {jobs.isError && (
              <div className="cs-error" role="alert">
                Careers could not load.{" "}
                <button type="button" onClick={() => void jobs.refetch()}>
                  Retry careers
                </button>
              </div>
            )}
            <footer className="cs-actions">
              {step > 0 ? (
                <button
                  type="button"
                  className="cs-back"
                  disabled={busy}
                  onClick={() => go(step - 1)}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              ) : (
                <span className="cs-action-note">A little detail goes a long way.</span>
              )}
              <button type="submit" className="cs-primary" disabled={busy || (step > 0 && !valid)}>
                {busy
                  ? "Creating your character…"
                  : step === 0
                    ? "Next: your story"
                    : step === 1
                      ? "Review character"
                      : "Begin your Osogbo life"}
                <ArrowRight size={17} />
              </button>
            </footer>
          </form>
        </div>
      </div>
      <p className="cs-bottom-note">Live. Build. Belong.</p>
    </main>
  );
}
