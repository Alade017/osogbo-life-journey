import { Activity, Droplets, Heart, Smile, Sparkles, Users, Utensils, Zap } from "lucide-react";
import type { Character } from "@/lib/game";

const NEEDS = [
  { key: "health", label: "Health", icon: Heart, tone: "#e97c69", inverted: false },
  { key: "energy", label: "Energy", icon: Zap, tone: "#efbd46", inverted: false },
  { key: "hunger", label: "Hunger", icon: Utensils, tone: "#e99750", inverted: false },
  { key: "happiness", label: "Happiness", icon: Smile, tone: "#8ecb83", inverted: false },
  { key: "hygiene", label: "Hygiene", icon: Droplets, tone: "#7bbfd2", inverted: false },
  { key: "social", label: "Social", icon: Users, tone: "#9a9ae0", inverted: false },
  { key: "stress", label: "Stress", icon: Activity, tone: "#d889a1", inverted: false },
] as const;

export function NeedsPanel({ character }: { character: Character }) {
  return (
    <section className="needs-panel" aria-label="Character needs">
      <div className="needs-heading">
        <span className="needs-heading-icon">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
            How you're doing
          </p>
          <h2 className="font-display text-sm font-bold text-white">Your needs</h2>
        </div>
      </div>
      <div className="needs-list">
        {NEEDS.map((need) => {
          const Icon = need.icon;
          const value = need.key === "hygiene" ? null : character[need.key];
          const fill = value === null ? 0 : need.inverted ? 100 - value : value;
          return (
            <div className={`need-meter ${value === null ? "need-untracked" : ""}`} key={need.key}>
              <div className="need-meter-top">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: need.tone }} />
                  <span className="truncate">{need.label}</span>
                </span>
                <span className="need-value">{value === null ? "—" : `${value}%`}</span>
              </div>
              <div className="need-track">
                <span style={{ width: `${fill}%`, backgroundColor: need.tone }} />
              </div>
              {value === null && <span className="sr-only">Not tracked yet</span>}
            </div>
          );
        })}
      </div>
      <p className="needs-note">Hygiene is not tracked yet.</p>
    </section>
  );
}
