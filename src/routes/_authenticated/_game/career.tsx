import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Building2, CheckCircle2, MapPin, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { q, formatNaira } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, PageHeader } from "@/components/game/ui";
import { careerRpc, getMyCareer, getMyCareerSession, listCareerRanks, listCareerTracks, listCareerVenues } from "@/lib/career-service";

export const Route = createFileRoute("/_authenticated/_game/career")({
  head: () => pageMeta("Careers", "Apply for work, complete shifts and earn promotions."),
  component: CareerPage,
});
function CareerPage() {
  const qc = useQueryClient();
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const { data: locations } = useQuery(q.locations());
  const tracks = useQuery({ queryKey: ["careerTracks"], queryFn: listCareerTracks });
  const ranks = useQuery({ queryKey: ["careerRanks"], queryFn: listCareerRanks });
  const venues = useQuery({ queryKey: ["careerVenues"], queryFn: listCareerVenues });
  const career = useQuery({ queryKey: ["myCareer"], queryFn: getMyCareer });
  const session = useQuery({ queryKey: ["myCareerSession"], queryFn: getMyCareerSession });
  const refresh = async () => {
    await Promise.all([tracks.refetch(), ranks.refetch(), venues.refetch(), career.refetch(), session.refetch(),
      qc.invalidateQueries({ queryKey: ["wallet"] }), qc.invalidateQueries({ queryKey: ["transactions"] })]);
  };
  const mutate = useMutation({
    mutationFn: async (action: { kind: "apply"; slug: string } | { kind: "start" } |
      { kind: "step"; sessionId: string; step: number } | { kind: "promote" }) => {
      if (action.kind === "apply") return careerRpc.apply(action.slug);
      if (action.kind === "start") return careerRpc.startShift();
      if (action.kind === "step") return careerRpc.completeStep(action.sessionId, action.step);
      return careerRpc.promote();
    },
    onSuccess: async (result: any) => {
      if (result?.shift_complete) toast.success(`Shift completed · ${formatNaira(result.paid)} paid`);
      else if (result?.step_completed) toast.success(`Work step ${result.step_completed} completed`);
      else if (result?.career_level) toast.success(`Career level ${result.career_level} unlocked`);
      else toast.success("Career updated");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (characterLoading || tracks.isLoading || ranks.isLoading || venues.isLoading) return <LoadingState />;
  if (!character) return <EmptyState title="Create a character first" body="Your career progress is saved to your character." />;
  if (tracks.isError || ranks.isError || venues.isError || career.isError || session.isError) {
    return <section className="game-panel grid gap-3 p-5" role="alert"><h1 className="text-xl font-bold">Careers are unavailable</h1><p>Reconnect and retry. No progress or money was changed.</p><Button onClick={() => void refresh()}>Retry</Button></section>;
  }
  const active = career.data;
  const currentSession = session.data;
  const activeTrack = tracks.data?.find((track) => track.slug === active?.track_slug);
  const rank = ranks.data?.find((item) => item.track_slug === active?.track_slug && item.level === active?.career_level);
  const nextRank = ranks.data?.find((item) => item.track_slug === active?.track_slug && item.level === (active?.career_level ?? 0) + 1);
  const here = character.current_location_id;
  const currentLocation = locations?.find((location) => location.id === here);
  const activeVenue = venues.data?.find((venue) => venue.track_slug === active?.track_slug && venue.location_id === here);
  const nextPromotionShifts = nextRank?.promotion_shifts ?? Infinity;
  const promotionReady = !!active && !!nextRank && active.completed_shifts >= nextPromotionShifts && active.performance_points >= nextPromotionShifts;
  const isBusy = mutate.isPending;
  return <div className="mx-auto grid w-full max-w-3xl gap-5 px-1 pb-28 sm:px-0">
    <PageHeader title="Careers" subtitle="Build a profession, complete work steps and unlock promotions." eyebrow="WORK & PROGRESSION" />
    <section className="game-panel grid gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3"><BriefcaseBusiness /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current workplace</p><p className="font-semibold">{currentLocation?.name ?? "Osogbo"}</p></div><span className="text-xs text-muted-foreground">Career</span></div>
      {active && activeTrack && rank ? <>
        <div className="rounded-xl border border-border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Your track</p><h2 className="mt-1 text-xl font-bold">{activeTrack.name}</h2><p className="mt-1 text-sm text-muted-foreground">{rank.title} · Level {active.career_level}</p><p className="mt-3 text-lg font-bold">{formatNaira(rank.shift_pay)} <span className="text-sm font-normal text-muted-foreground">per completed shift</span></p><p className="mt-1 text-sm text-muted-foreground">{active.completed_shifts} completed shifts · {active.performance_points} performance points</p></div>
        {currentSession ? <div className="grid gap-3 rounded-xl border border-border p-4"><div><h3 className="font-semibold">Your active shift</h3><p className="text-sm text-muted-foreground">Complete every work step. Pay is issued only when the final step is confirmed by the server.</p></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, currentSession.steps_completed / currentSession.steps_required * 100)}%` }} /></div><p className="text-sm">Step {currentSession.steps_completed} of {currentSession.steps_required}</p><Button className="min-h-11 w-full" disabled={isBusy || !activeVenue || currentSession.steps_completed >= currentSession.steps_required} onClick={() => mutate.mutate({ kind: "step", sessionId: currentSession.id, step: currentSession.steps_completed + 1 })}>{isBusy ? "Saving…" : `Complete step ${currentSession.steps_completed + 1}`}</Button>{!activeVenue && <p className="text-sm text-destructive">Travel to an approved workplace to continue this shift.</p>}</div> : <div className="grid gap-2"><p className="text-sm text-muted-foreground">Work steps: customer service · task processing · end-of-shift handover.</p><Button className="min-h-11 w-full" disabled={isBusy || !activeVenue} onClick={() => mutate.mutate({ kind: "start" })}>{isBusy ? "Starting…" : activeVenue ? "Start a shift" : "Travel to your workplace"}</Button>{!activeVenue && <p className="text-sm text-muted-foreground">Travel to Cedar Bank, Meridian Bank or Osun Mall as required by your track. Your shift cannot start remotely.</p>}{nextRank && <Button variant="outline" className="min-h-11 w-full" disabled={isBusy || !promotionReady} onClick={() => mutate.mutate({ kind: "promote" })}><TrendingUp size={16} className="mr-2" />{promotionReady ? `Promote to ${nextRank.title}` : `Promotion needs ${nextPromotionShifts} completed shifts`}</Button>}{!nextRank && <p className="text-sm font-medium text-emerald-700">You reached the top rank.</p>}</div>}
      </> : <div className="grid gap-3"><div><h2 className="text-lg font-bold">Choose your career</h2><p className="text-sm text-muted-foreground">Apply at an approved workplace. You can hold one active career at a time.</p></div>{(tracks.data ?? []).map((track) => {
        const trackRanks = (ranks.data ?? []).filter((item) => item.track_slug === track.slug);
        const trackVenues = (venues.data ?? []).filter((venue) => venue.track_slug === track.slug);
        const isHere = trackVenues.some((venue) => venue.location_id === here);
        const firstRank = trackRanks.find((item) => item.level === 1);
        return <article key={track.slug} className="grid gap-3 rounded-xl border border-border p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2"><Building2 size={20} /></div><div className="min-w-0 flex-1"><h3 className="font-bold">{track.name}</h3><p className="mt-1 text-sm text-muted-foreground">{track.description}</p><p className="mt-2 text-sm font-semibold">{firstRank ? `${formatNaira(firstRank.shift_pay)} per shift` : "Pay configured by employer"}</p></div></div><div className="flex items-start gap-2 text-xs text-muted-foreground"><MapPin size={14} className="mt-0.5 shrink-0" /><span>{trackVenues.map((venue) => venue.locations?.name).filter(Boolean).join(" · ") || track.venue_slug}</span></div><Button className="min-h-11 w-full" disabled={isBusy || !isHere} onClick={() => mutate.mutate({ kind: "apply", slug: track.slug })}>{isBusy ? "Applying…" : isHere ? "Apply for this career" : "Travel to venue to apply"}</Button></article>;
      })}<a className="text-sm font-semibold text-primary underline underline-offset-4" href="/jobs">Browse regular jobs and shifts</a></div>}
      {mutate.isError && <p role="alert" className="text-sm text-destructive">{mutate.error.message}</p>}
    </section>
    <section className="grid gap-2 sm:grid-cols-2"><div className="game-panel p-4"><CheckCircle2 className="mb-2 text-primary" /><h3 className="font-semibold">Server-verified shifts</h3><p className="mt-1 text-sm text-muted-foreground">Incomplete or out-of-order work cannot pay out.</p></div><div className="game-panel p-4"><TrendingUp className="mb-2 text-primary" /><h3 className="font-semibold">Career progression</h3><p className="mt-1 text-sm text-muted-foreground">Promotions unlock after completed shifts and performance milestones.</p></div></section>
  </div>;
}
