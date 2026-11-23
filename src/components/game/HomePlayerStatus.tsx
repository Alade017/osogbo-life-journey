import { Component, Suspense, lazy, useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { UserRound, Zap } from "lucide-react";
import { normalizeAvatarAppearance, type Appearance } from "@/game/avatar-appearance";
import type { PlayerState } from "@/lib/player-state";
import { useGameTime } from "./GameTimeProvider";

const CharacterPreview = lazy(() =>
  import("@/components/3d/CharacterPreview").then((module) => ({
    default: module.CharacterPreview,
  })),
);

class PortraitBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? <UserRound aria-hidden="true" /> : this.props.children;
  }
}

/** Uses the same character and worn equipment as the profile, with live simulation energy. */
export function HomePlayerStatus({ player }: { player: PlayerState }) {
  const { simulation, ready } = useGameTime();
  const energy = Math.max(0, Math.min(100, Math.round(simulation.needs.energy)));
  const gender = player.gender ?? "nonbinary";
  const appearance = useMemo(() => {
    const raw = (
      player.avatar && typeof player.avatar === "object" && !Array.isArray(player.avatar)
        ? player.avatar
        : {}
    ) as Appearance;
    return normalizeAvatarAppearance(raw, gender);
  }, [player.avatar, gender]);

  return (
    <Link
      to="/profile"
      className="home-player-status"
      aria-label={`${player.name}, level ${player.level}. ${ready ? `Energy ${energy}%` : "Connecting needs"}. Open profile`}
    >
      <div className="home-player-portrait">
        <PortraitBoundary key={player.id}>
          <Suspense fallback={<UserRound aria-hidden="true" />}>
            <CharacterPreview
              appearance={appearance}
              gender={gender}
              equipment={player.equipment}
              label={player.name}
              framing="head"
            />
          </Suspense>
        </PortraitBoundary>
        <span className="home-player-level">{player.level}</span>
      </div>
      <span className="home-player-energy">
        <span className="home-player-name">{player.name}</span>
        <span className="home-player-energy-row">
          <Zap size={22} aria-hidden="true" />
          <span
            className="home-player-energy-meter"
            role="progressbar"
            aria-label="Energy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ready ? energy : undefined}
            aria-valuetext={ready ? `${energy}%` : "Connecting"}
          >
            <span style={{ width: ready ? `${energy}%` : "0%" }} />
          </span>
        </span>
      </span>
    </Link>
  );
}
