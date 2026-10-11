import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Gift, ListChecks } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatNaira, q } from "@/lib/game";

export function MissionChips() {
  const { data: missions } = useQuery(q.missions());
  const activeMissions = (missions ?? []).filter(
    (playerMission) => playerMission.status === "in_progress" && playerMission.mission,
  );

  if (!activeMissions.length) return null;
  const visibleMissions = activeMissions.slice(0, 1);

  return (
    <section className="city-mission-chips" aria-label="Active missions">
      {visibleMissions.map(({ id, progress, mission }) => {
        if (!mission) return null;
        const target = Math.max(1, mission.target);
        const current = Math.max(0, Math.min(progress, target));
        const percent = Math.round((current / target) * 100);
        return (
          <details className="city-mission-chip" key={id}>
            <summary>
              <span className="city-mission-icon">
                <ListChecks size={16} aria-hidden="true" />
              </span>
              <span className="city-mission-title">{mission.title}</span>
              <span className="city-mission-progress">{percent}%</span>
            </summary>
            <div className="city-mission-detail">
              <p>{mission.description}</p>
              <span className="city-mission-reward">
                <Gift size={14} aria-hidden="true" />
                {formatNaira(mission.reward_money)}
                {mission.reward_xp ? ` · ${mission.reward_xp} XP` : ""}
              </span>
              <span
                className="city-mission-track"
                role="meter"
                aria-label={`${mission.title} progress`}
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={current}
              >
                <i style={{ width: `${percent}%` }} />
              </span>
              <Link to="/missions" className="city-mission-link">
                View missions <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </details>
        );
      })}
      {activeMissions.length > visibleMissions.length && (
        <Link to="/missions" className="city-mission-more">
          View {activeMissions.length - visibleMissions.length} other active mission
          {activeMissions.length - visibleMissions.length === 1 ? "" : "s"}
        </Link>
      )}
    </section>
  );
}
