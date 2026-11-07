import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ACTIVITY_CATEGORIES, parseJobActivityRequirements } from "@/lib/job-activity-model";
import { q, type Activity } from "@/lib/game";
import { useGameTime } from "@/components/game/GameTimeProvider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  rest: "Rest", study: "Study", exercise: "Exercise", social: "Social",
  exploration: "Exploration", food: "Food", culture: "Culture", event: "Events", other: "Other",
};
function requirementStatus(activity: Activity, context: {
  level: number; reputation: number; locationId: string | null; locationSlug: string | null;
  hour: number; skills: Array<{ skill_slug: string; level: number; experience: number }>;
  itemSlugs: string[];
}): string | null {
  const r = parseJobActivityRequirements(activity.requirements);
  if (r.level !== undefined && context.level < r.level) return `Requires Level ${r.level}`;
  if (r.minimumReputation !== undefined && context.reputation < r.minimumReputation)
    return `Requires ${r.minimumReputation} reputation`;
  if (activity.location_id && context.locationId !== activity.location_id)
    return "Travel to the activity location first";
  if (r.locationSlug && context.locationSlug !== r.locationSlug)
    return `Requires ${r.locationSlug.replace(/-/g, " ")}`;
  if (r.availableHours) {
    const { start, end } = r.availableHours;
    const valid = start < end
      ? context.hour >= start && context.hour < end
      : context.hour >= start || context.hour < end;
    if (!valid) return `Available ${start}:00–${end}:00 game time`;
  }
  for (const required of r.skills ?? []) {
    const skill = context.skills.find((item) => item.skill_slug === required.slug);
    if ((required.minimumLevel !== undefined && (skill?.level ?? 0) < required.minimumLevel) ||
        (required.minimumExperience !== undefined && (skill?.experience ?? 0) < required.minimumExperience))
      return `Requires ${required.slug.replace(/[-_]/g, " ")} skill`;
  }
  const missing = (r.items ?? []).find((slug) => !context.itemSlugs.includes(slug));
  return missing ? `Requires ${missing.replace(/[-_]/g, " ")}` : null;
}
function hasExtraRewardMetadata(value: Activity["rewards"]) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}
export function ActivityCatalogueApp() {
  const qc = useQueryClient();
  const { simulation, ready, busy, performCatalogActivity } = useGameTime();
  const { data: activities, isLoading, isError, refetch } = useQuery(q.activities());
  const { data: character } = useQuery(q.character());
  const { data: locations } = useQuery(q.locations());
  const { data: skills } = useQuery(q.playerSkills());
  const { data: inventory } = useQuery(q.inventory());
  const { data: history } = useQuery(q.activityCompletions());
  const [category, setCategory] = useState("all");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const location = locations?.find((row) => row.id === character?.current_location_id);
  const itemSlugs = useMemo(() => (inventory ?? []).flatMap((row) => {
    const item = (row as { item?: { slug?: string } | null }).item;
    return item?.slug ? [item.slug] : [];
  }), [inventory]);
  const context = useMemo(() => ({
    level: character?.level ?? 0, reputation: character?.reputation ?? 0,
    locationId: character?.current_location_id ?? null, locationSlug: location?.slug ?? null,
    hour: simulation.gameTime.hour,
    skills: (skills ?? []).map((s) => ({ skill_slug: s.skill_slug, level: s.level, experience: s.experience })),
    itemSlugs,
  }), [character?.level, character?.reputation, character?.current_location_id, location?.slug, simulation.gameTime.hour, skills, itemSlugs]);
  const catalogue = (activities ?? []).filter((activity) => {
    const metadata = activity.metadata;
    const mapAction = metadata !== null && typeof metadata === "object" && !Array.isArray(metadata) &&
      metadata.server_action === "map_place_action";
    return !mapAction && (category === "all" || activity.category === category);
  });
  const cooldownFor = (activity: Activity) => {
    const latest = (history ?? []).find((row) => row.activity_id === activity.id);
    if (!latest || latest.cooldown_minutes <= 0) return null;
    const ends = new Date(latest.completed_at).getTime() + latest.cooldown_minutes * 60_000;
    return ends > Date.now() ? ends : null;
  };
  const complete = async (activity: Activity) => {
    if (!ready || busy || submitting) return;
    setSubmitting(activity.slug);
    try {
      const result = await performCatalogActivity(activity.slug, crypto.randomUUID());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: q.activities().queryKey }),
        queryClient.invalidateQueries({ queryKey: q.character().queryKey }),
        queryClient.invalidateQueries({ queryKey: q.playerSkills().queryKey }),
        queryClient.invalidateQueries({ queryKey: q.inventory().queryKey }),
        queryClient.invalidateQueries({ queryKey: q.activityCompletions().queryKey }),
      ]);
      toast.success(result.duplicate ? `${result.activity.name} was already completed.` :
        `${result.activity.name} completed · +${result.activity.xp_reward} XP`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete this activity.");
    } finally { setSubmitting(null); }
  };
  return (
    <div className="phone-theme-page" aria-label="Activity catalogue">
      <header className="flex items-start justify-between gap-3">
        <div><h2 className="text-base font-bold">Activity catalogue</h2>
          <p className="text-xs text-muted-foreground">Discover activities around town. The server checks eligibility and awards progression.</p></div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs">
          Day {simulation.gameTime.day} · {String(simulation.gameTime.hour).padStart(2,"0")}:{String(simulation.gameTime.minute).padStart(2,"0")}
        </span>
      </header>
      <div className="flex flex-wrap gap-2" aria-label="Filter activities by category">
        <button type="button" onClick={() => setCategory("all")} aria-pressed={category === "all"}
          className={cn("rounded-full border px-3 py-1.5 text-xs", category === "all" && "border-primary bg-primary text-primary-foreground")}>All</button>
        {ACTIVITY_CATEGORIES.map((value) => <button type="button" key={value} onClick={() => setCategory(value)}
          aria-pressed={category === value}
          className={cn("rounded-full border px-3 py-1.5 text-xs", category === value && "border-primary bg-primary text-primary-foreground")}>
          {CATEGORY_LABELS[value] ?? value}
        </button>)}
      </div>
      {!ready && <p role="status" className="rounded-xl border p-3 text-sm text-muted-foreground">Reconnecting your personal simulation. Activities unlock when the server confirms your session.</p>}
      {isLoading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading activities…</p>
      : isError ? <div role="alert" className="rounded-xl border p-4 text-sm"><p>Activities could not be loaded.</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}>Try again</Button></div>
      : catalogue.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No activities are available in this category.</p>
      : <div className="grid gap-3">{catalogue.map((activity) => {
        const blocked = requirementStatus(activity, context);
        const cooldown = cooldownFor(activity);
        const reason = blocked ?? (cooldown ? "Cooling down" : null);
        const locationName = activity.location_id ? locations?.find((row) => row.id === activity.location_id)?.name ?? "Required location" : "Anywhere";
        return <article key={activity.id} className="rounded-xl border bg-card p-3 text-card-foreground">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{activity.name}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{CATEGORY_LABELS[activity.category] ?? activity.category}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
          </div><span className="shrink-0 text-xs tabular-nums">{activity.duration_minutes} min</span></div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>📍 {locationName}</span><span>⚡ {activity.energy_delta > 0 ? "+" : ""}{activity.energy_delta} energy</span>
            <span>🍲 {activity.hunger_delta > 0 ? "+" : ""}{activity.hunger_delta} hunger</span><span>💧 {activity.thirst_delta > 0 ? "+" : ""}{activity.thirst_delta} thirst</span>
            <span>⭐ +{activity.xp_reward} XP</span>{activity.cooldown_minutes > 0 && <span>Cooldown {activity.cooldown_minutes} min</span>}
          </div>
          {hasExtraRewardMetadata(activity.rewards) && <p className="mt-2 text-[11px] text-muted-foreground">
            Additional reward metadata is configured; this executor currently awards only the listed XP and stat changes.</p>}
          {reason && <p className="mt-2 text-xs text-amber-700">{reason}</p>}
          <Button className="mt-3 w-full" size="sm" disabled={!ready || busy || !!submitting || !!reason}
            onClick={() => void complete(activity)}>{submitting === activity.slug ? "Completing…" : reason ?? "Complete activity"}</Button>
        </article>;
      })}</div>}
      <section className="space-y-2" aria-label="Recent activity history">
        <h3 className="text-sm font-semibold">Recent activity</h3>
        {history?.length ? <div className="space-y-2">{history.slice(0,8).map((entry) =>
          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5 text-xs">
            <span className="min-w-0"><strong className="block truncate">{entry.activity_name}</strong>
              <span className="text-muted-foreground">{new Date(entry.completed_at).toLocaleString()}</span></span>
            <span className="shrink-0">+{entry.xp_reward} XP</span>
          </div>)}</div>
        : <p className="rounded-lg border p-3 text-xs text-muted-foreground">No completed catalogue activities yet.</p>}
      </section>
    </div>
  );
}
