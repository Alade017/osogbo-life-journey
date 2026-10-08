import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/game";
import {
  Avatar,
  HAIR_COLORS,
  HAIR_STYLES_BY_GENDER,
  HEADWEAR,
  OUTFITS,
  SHOE_COLORS,
  SKIN_TONES,
  TROUSERS,
  type Appearance,
} from "@/components/game/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/game/Logo";
import { cn } from "@/lib/utils";
import { GameDataUnavailable, LoadingState } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/create-character")({
  head: () => ({
    meta: [
      { title: "Create your character — OSOGBO LIFE" },
      { name: "description", content: "Design your character before entering Osogbo." },
      { property: "og:title", content: "Create your character — OSOGBO LIFE" },
      { property: "og:description", content: "Design your character before entering Osogbo." },
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
  { v: "ambitious", l: "Ambitious", d: "+5 Career" },
  { v: "creative", l: "Creative", d: "+3 Intelligence, +2 Happiness" },
  { v: "social", l: "Social", d: "+5 Social" },
  { v: "studious", l: "Studious", d: "+5 Intelligence" },
  { v: "easygoing", l: "Easygoing", d: "+5 Happiness" },
];

function Picker({
  label,
  options,
  value,
  onChange,
  swatches,
}: {
  label: string;
  options: string[];
  value: number;
  onChange: (n: number) => void;
  swatches?: boolean;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button
            key={o + i}
            type="button"
            onClick={() => onChange(i)}
            aria-label={swatches ? `${label} ${i + 1}` : o}
            aria-pressed={value === i}
            className={cn(
              "game-control",
              swatches ? "h-9 w-9 rounded-full" : "bg-card px-3 py-1.5 text-sm",
              value === i && !swatches && "bg-sun",
              value === i && swatches && "ring-4 ring-primary ring-offset-2 ring-offset-card",
            )}
            style={swatches ? { backgroundColor: o } : undefined}
          >
            {swatches ? "" : o}
          </button>
        ))}
      </div>
    </div>
  );
}

function CreateCharacter() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const {
    data: character,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery(q.character());
  const {
    data: jobs,
    isLoading: jobsLoading,
    isError: jobsError,
    error: jobsQueryError,
    refetch: refetchJobs,
    isRefetching: isJobsRefetching,
  } = useQuery(q.jobs());
  const [name, setName] = useState("");
  const [gender, setGender] = useState("female");
  const [age, setAge] = useState(22);
  const [personality, setPersonality] = useState("ambitious");
  const [occupation, setOccupation] = useState<string>("");
  const [ap, setAp] = useState<Required<Appearance>>({
    skin: 1,
    hair: 1,
    hairColor: 0,
    outfit: 0,
    bottoms: 0,
    shoes: 0,
    headwear: 0,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (character) navigate({ to: "/home" });
  }, [character, navigate]);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc("create_character", {
      p_name: name,
      p_gender: gender,
      p_appearance: ap,
      p_age: age,
      p_personality: personality,
      p_occupation: occupation || null,
    } as never);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries();
    toast.success(`Welcome to Osogbo, ${name}!`);
    navigate({ to: "/home" });
  }

  if (isLoading)
    return (
      <div className="game-shell min-h-screen">
        <LoadingState />
      </div>
    );
  if (isError)
    return (
      <GameDataUnavailable error={error} onRetry={() => void refetch()} isRetrying={isRefetching} />
    );
  if (jobsError)
    return (
      <GameDataUnavailable
        error={jobsQueryError}
        onRetry={() => void refetchJobs()}
        isRetrying={isJobsRefetching}
      />
    );
  const valid = name.trim().length >= 2 && name.trim().length <= 24;
  const hairOptions = HAIR_STYLES_BY_GENDER[gender] ?? HAIR_STYLES_BY_GENDER["nonbinary"] ?? [];

  return (
    <div className="game-canvas min-h-screen px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <Logo />
        <h1 className="mt-6 text-4xl font-bold">Create your character</h1>
        <p className="text-muted-foreground">
          You start with ₦5,000 (in-game), full energy and a few essentials.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="game-panel game-panel-accent flex flex-col items-center justify-center p-6 md:sticky md:top-6 md:self-start">
            <div className="bob">
              <Avatar appearance={ap} gender={gender} size={170} />
            </div>
            <div className="mt-4 rounded-lg border-2 border-edge bg-card px-4 py-1.5 font-display text-lg font-bold">
              {name.trim() || "Your name"}
            </div>
          </div>

          <div className="game-panel space-y-6 p-5 md:p-7">
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1.5">
                <Label htmlFor="name">Character name</Label>
                <Input
                  id="name"
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Adunni"
                  className="h-11 border-2 bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  min={16}
                  max={60}
                  value={age}
                  onChange={(e) => setAge(Math.max(16, Math.min(60, Number(e.target.value) || 16)))}
                  className="h-11 border-2 bg-card"
                />
              </div>
            </div>

            <Picker
              label="Gender / presentation"
              options={GENDERS.map((g) => g.l)}
              value={GENDERS.findIndex((g) => g.v === gender)}
              onChange={(i) => setGender(GENDERS[i]?.v ?? "female")}
            />
            <Picker
              label="Skin tone"
              options={SKIN_TONES}
              swatches
              value={ap.skin}
              onChange={(skin) => setAp({ ...ap, skin })}
            />
            <Picker
              label="Hair style"
              options={hairOptions}
              value={ap.hair}
              onChange={(hair) => setAp({ ...ap, hair })}
            />
            <Picker
              label="Hair colour"
              options={HAIR_COLORS}
              swatches
              value={ap.hairColor}
              onChange={(hairColor) => setAp({ ...ap, hairColor })}
            />
            <Picker
              label="Outfit colour"
              options={OUTFITS}
              swatches
              value={ap.outfit}
              onChange={(outfit) => setAp({ ...ap, outfit })}
            />
            <Picker
              label="Trousers / bottoms"
              options={TROUSERS}
              swatches
              value={ap.bottoms}
              onChange={(bottoms) => setAp({ ...ap, bottoms })}
            />
            <Picker
              label="Shoes"
              options={SHOE_COLORS}
              swatches
              value={ap.shoes}
              onChange={(shoes) => setAp({ ...ap, shoes })}
            />
            <Picker
              label="Headwear"
              options={HEADWEAR}
              value={ap.headwear}
              onChange={(headwear) => setAp({ ...ap, headwear })}
            />

            <div>
              <Label className="mb-2 block">Personality</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PERSONALITIES.map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => setPersonality(p.v)}
                    aria-pressed={personality === p.v}
                    className={cn(
                      "game-control bg-card px-3 py-2 text-left",
                      personality === p.v && "bg-sun",
                    )}
                  >
                    <span className="block">{p.l}</span>
                    <span className="block font-sans text-xs font-medium text-muted-foreground">
                      {p.d}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="occ">Career preference</Label>
              <select
                id="occ"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                disabled={jobsLoading || jobsError}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">No career preference</option>
                {jobs?.map((j) => (
                  <option key={j.id} value={j.slug}>
                    {j.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {jobsError
                  ? "Job choices could not load. Check the game database setup before creating your character."
                  : jobsLoading
                    ? "Loading available careers…"
                    : "Choose a career goal. This preference is saved with your character; job requirements still apply."}
              </p>
            </div>

            <Button
              variant="default"
              size="lg"
              className="w-full"
              disabled={!valid || busy || jobsLoading}
              onClick={submit}
            >
              {busy ? "Entering Osogbo…" : jobsLoading ? "Loading careers…" : "Enter Osogbo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
