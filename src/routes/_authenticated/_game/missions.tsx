import { useMissionClaim } from "@/hooks/use-mission-claim";
import { useMissions } from "@/hooks/use-missions";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Gift } from "lucide-react";
import { formatNaira } from "@/lib/game";
import { orderedMissions } from "@/lib/mission-service";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Chip, LoadingState, PageHeader, StatBar } from "@/components/game/ui";
import { DailyTasks } from "@/components/game/DailyTasks";
import { LoginStreakSummary } from "@/components/game/LoginStreakSummary";

export const Route = createFileRoute("/_authenticated/_game/missions")({
  head: () => pageMeta("Missions", "Complete missions in Osogbo to earn rewards and XP."),
  component: MissionsPage,
});

function MissionsPage() {
  const { user } = Route.useRouteContext();
  const { data: missions, isLoading, isError, refetch, userId, characterId } = useMissions();
  const claim = useMissionClaim(userId, characterId);
  if (isLoading) return <LoadingState />;
  const sorted = orderedMissions(missions ?? []);
  const readyToClaim = sorted.filter((mission) => mission.status === "completed").length;

  return (
    <div className="mission-progress-page">
      <PageHeader
        eyebrow="YOUR NEXT STEPS"
        title="Missions"
        subtitle={`${sorted.filter((m) => m.status === "claimed").length}/${sorted.length} completed`}
      />
      {readyToClaim > 0 && (
        <p className="mission-rewards-ready" role="status">
          <Gift size={18} aria-hidden="true" />
          {readyToClaim} mission reward{readyToClaim === 1 ? "" : "s"} ready to claim
        </p>
      )}
      <DailyTasks userId={user.id} />
      <LoginStreakSummary />
      <h2 className="mb-4 text-2xl font-bold">Lifetime missions</h2>
      {isError && (
        <div role="alert">
          Could not refresh lifetime missions.{" "}
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((pm) => {
          const m = pm.mission!;
          const money = m.slug === "earn_10000";
          const progressRatio = m.target > 0 ? Math.max(0, Math.min(1, pm.progress / m.target)) : 0;
          const nearlyComplete = pm.status !== "claimed" && pm.status !== "completed" && progressRatio >= 0.8;
          return (
            <div
              key={pm.id}
              className={`game-panel mission-progress-card border-l-4 p-5 ${pm.status === "completed" ? "is-ready border-l-sun" : pm.status === "claimed" ? "is-claimed border-l-transparent" : nearlyComplete ? "is-near-goal border-l-primary" : "border-l-transparent"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-bold">{m.title}</h3>
                {pm.status === "claimed" ? (
                  <Chip tone="primary">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </Chip>
                ) : pm.status === "completed" ? (
                  <Chip tone="clay">Ready!</Chip>
                ) : (
                  <Chip>{nearlyComplete ? "Almost there" : "In progress"}</Chip>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              <div className="mission-progress-track mt-4">
                <StatBar
                  label={
                    money ? `${formatNaira(pm.progress)} / ${formatNaira(m.target)}` : "Progress"
                  }
                  value={pm.progress}
                  max={m.target}
                  tone="primary"
                />
              </div>
              <div className="mission-reward-row mt-4 flex items-center justify-between gap-2">
                <p className="mission-reward-value flex items-center gap-1 text-sm font-semibold">
                  <Gift className="h-4 w-4" /> {formatNaira(m.reward_money)}
                  {m.reward_xp ? ` · ${m.reward_xp} XP` : ""}
                </p>
                {pm.status === "completed" && (
                  <Button
                    variant="default"
                    size="sm"
                    className="mission-claim-action"
                    disabled={claim.isPending}
                    onClick={() => claim.mutate(pm.id)}
                  >
                    Claim reward
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
