import { useState } from "react";
import { Check, Clock3, Coins, Heart } from "lucide-react";
import type { MapPlaceAction } from "@/components/map/OsogboMap.svg";
import { formatMapNaira } from "@/components/map/map-ui-utils";

export type PlaceActionResult = {
  action_id: string;
  message: string;
  balance: number;
  happiness: number;
  hunger?: number;
  game_time: { hour: number; minute: number; day: number };
};

export function PlaceActionMenu({
  actions,
  offline,
  pending,
  result,
  onRun,
}: {
  actions: MapPlaceAction[];
  offline: boolean;
  pending: boolean;
  result?: PlaceActionResult | null | undefined;
  onRun: (actionId: string) => void;
}) {
  const [selected, setSelected] = useState<MapPlaceAction | null>(null);
  if (!actions.length) return null;
  return (
    <section className="place-action-menu" aria-label="Activities at this place">
      <h3>What can I do here?</h3>
      <ul className="map-sheet-list">
        {actions.map((action) => {
          const money = action.money_minor;
          const text =
            money.min === 0 && money.max === 0
              ? "No cost"
              : money.min < 0
                ? `Earn ${formatMapNaira(Math.abs(money.max))}–${formatMapNaira(Math.abs(money.min))}`
                : `Costs ${formatMapNaira(money.min)}–${formatMapNaira(money.max)}`;
          return (
            <li key={action.id}>
              <button className="place-action-option" onClick={() => setSelected(action)}>
                <span>
                  {action.label}
                  {action.verify && <small> · Proposed activity</small>}
                </span>
                <small>
                  {text} · {action.time_cost_minutes} game minutes
                </small>
              </button>
            </li>
          );
        })}
      </ul>
      {selected && (
        <div className="place-action-confirm" role="group" aria-label={`Confirm ${selected.label}`}>
          <strong>{selected.label}</strong>
          <p>{selected.description}</p>
          <p>
            <Clock3 size={15} /> {selected.time_cost_minutes} game minutes
          </p>
          <p>
            <Coins size={15} />{" "}
            {selected.money_minor.min === 0 && selected.money_minor.max === 0
              ? "No cost"
              : selected.money_minor.min < 0
                ? `Earn ${formatMapNaira(Math.abs(selected.money_minor.max))}–${formatMapNaira(Math.abs(selected.money_minor.min))}`
                : `Costs ${formatMapNaira(selected.money_minor.min)}–${formatMapNaira(selected.money_minor.max)}`}
          </p>
          <p>
            <Heart size={15} /> Mood effect: {selected.mood_effect > 0 ? "+" : ""}
            {selected.mood_effect}
          </p>
          {(selected.needs_effects?.hunger_satisfaction ?? 0) > 0 && (
            <p>Hunger satisfaction: +{selected.needs_effects!.hunger_satisfaction}</p>
          )}
          <small>{selected.requirement}</small>
          {(selected.cooldown_game_minutes ?? 0) > 0 && (
            <small>Repeat cooldown: {selected.cooldown_game_minutes} game minutes</small>
          )}
          <div className="place-action-buttons">
            <button onClick={() => setSelected(null)}>Cancel</button>
            <button disabled={offline || pending} onClick={() => onRun(selected.id)}>
              {offline ? "Reconnect to continue" : pending ? "Working…" : "Confirm activity"}
            </button>
          </div>
        </div>
      )}
      {result && (
        <p role="status" className="place-action-result">
          <Check size={16} /> {result.message}
        </p>
      )}
    </section>
  );
}
