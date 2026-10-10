import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Gift } from "lucide-react";
import { q, rpc, formatNaira, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Chip, LoadingState, PageHeader, StatBar } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/_game/missions")({
  head: () => pageMeta("Missions", "Complete missions in Osogbo to earn rewards and XP."),
  component: MissionsPage,
});

function MissionsPage() {
  const { data: missions, isLoading } = useQuery(q.missions());
  const claim = useGameAction(rpc.claimMission, {
    onSuccess: (r) =>
      toast.success(`Reward claimed: ${formatNaira(r.money)}${r.xp ? ` · +${r.xp} XP` : ""}`),
  });
  if (isLoading) return <LoadingState />;
  const sorted = [...(missions ?? [])].sort(
    (a, b) => (a.mission?.sort_order ?? 0) - (b.mission?.sort_order ?? 0),
  );

  return (
    <div>
      <PageHeader
        eyebrow="YOUR NEXT STEPS"
        title="Missions"
        subtitle={`${sorted.filter((m) => m.status === "claimed").length}/${sorted.length} completed`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((pm) => {
          const m = pm.mission!;
          const money = m.slug === "earn_10000";
          return (
            <div
              key={pm.id}
              className={`game-panel p-5 ${pm.status === "completed" ? "bg-sun" : ""}`}
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
                  <Chip>In progress</Chip>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              <div className="mt-4">
                <StatBar
                  label={
                    money ? `${formatNaira(pm.progress)} / ${formatNaira(m.target)}` : "Progress"
                  }
                  value={pm.progress}
                  max={m.target}
                  tone="primary"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1 text-sm font-semibold">
                  <Gift className="h-4 w-4" /> {formatNaira(m.reward_money)}
                  {m.reward_xp ? ` · ${m.reward_xp} XP` : ""}
                </p>
                {pm.status === "completed" && (
                  <Button
                    variant="default"
                    size="sm"
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
