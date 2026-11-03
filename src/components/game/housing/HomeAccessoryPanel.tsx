import { useState } from "react";
import { Check, Clock3, CookingPot, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { homeFurnitureAction } from "@/lib/home-furniture-actions";
import { ACTION_CATALOG, NEED_RULES, type NeedName } from "@/lib/life-simulation";
import type { HousePlacement } from "./HouseRoomScene";

// Meal preference is presentation only: all choices use the existing validated cook action.
const MEALS = [
  { id: "jollof", name: "Jollof rice", symbol: "🍚", description: "A familiar home favourite." },
  { id: "noodles", name: "Indomie & egg", symbol: "🍜", description: "A warm bowl with egg." },
  {
    id: "plantain",
    name: "Plantain & beans",
    symbol: "🍌",
    description: "A comforting homemade plate.",
  },
] as const;

export function HomeAccessoryPanel({
  placement,
  disabledReason,
  pending,
  error,
  onClose,
  onUse,
}: {
  placement: HousePlacement;
  disabledReason: string | null;
  pending: boolean;
  error: string;
  onClose: () => void;
  onUse: () => Promise<boolean>;
}) {
  const [meal, setMeal] = useState<string>(MEALS[0].id);
  const [confirmed, setConfirmed] = useState(false);
  const actionId = homeFurnitureAction(placement.item_id);
  if (!actionId) return null;
  const action = ACTION_CATALOG[actionId];
  const cooking = actionId === "cook";
  const selected = MEALS.find((item) => item.id === meal)!;
  const actionLabel = cooking ? `Cook ${selected.name}` : action.name;
  const useAccessory = async () => {
    setConfirmed(false);
    if (await onUse()) setConfirmed(true);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="home-accessory-dialog">
        <header className="home-accessory-heading">
          <span className="home-accessory-icon">
            {cooking ? <CookingPot size={25} /> : <Sparkles size={25} />}
          </span>
          <div>
            <DialogTitle>
              {cooking ? "Your cooker" : placement.item_id.replaceAll("-", " ")}
            </DialogTitle>
            <DialogDescription>
              {cooking ? "What would you like to cook?" : action.name}
            </DialogDescription>
          </div>
        </header>
        <div className="home-accessory-facts">
          <span>
            <Clock3 size={14} />
            {action.durationMinutes} game min
          </span>
          <span>
            {action.cost === 0
              ? "Free"
              : new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                  maximumFractionDigits: 0,
                }).format(action.cost)}
          </span>
        </div>
        {cooking && (
          <div className="home-meal-grid" role="radiogroup" aria-label="Meal preference">
            {MEALS.map((item) => (
              <label
                key={item.id}
                className={`home-meal-card${meal === item.id ? " is-selected" : ""}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="home-meal-preference"
                  value={item.id}
                  aria-label={item.name}
                  checked={meal === item.id}
                  disabled={pending}
                  onChange={() => setMeal(item.id)}
                />
                <span className="home-meal-symbol" aria-hidden="true">
                  {item.symbol}
                </span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </label>
            ))}
          </div>
        )}
        <div className="home-task-benefits" aria-label="Activity benefits">
          {Object.entries(action.needs).map(([need, value]) => (
            <span key={need}>
              {value! > 0 ? "+" : ""}
              {value} {NEED_RULES[need as NeedName].label}
            </span>
          ))}
          {action.skill && action.skillXp > 0 && (
            <span>
              +{action.skillXp} {action.skill} XP
            </span>
          )}
        </div>
        {cooking && (
          <p className="home-meal-note">All meal choices have the time and benefits shown above.</p>
        )}
        {(disabledReason || error) && (
          <p className="home-task-notice" role={error ? "alert" : "status"}>
            {error || disabledReason}
          </p>
        )}
        {confirmed && (
          <p className="home-task-confirmation" role="status">
            Needs updated — {action.outcome}
          </p>
        )}
        <button
          type="button"
          className={`home-task-start${pending ? " is-pending" : ""}${confirmed ? " is-confirmed" : ""}`}
          disabled={!!disabledReason || pending || confirmed}
          aria-busy={pending}
          onClick={() => void useAccessory()}
        >
          {pending ? (
            <span className="home-task-button-label">
              <span className="home-task-spinner" aria-hidden="true" />
              Starting {actionLabel.toLowerCase()}…
            </span>
          ) : confirmed ? (
            <span className="home-task-button-label">
              <Check size={17} aria-hidden="true" />
              Done — needs updated
            </span>
          ) : (
            actionLabel
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
}
