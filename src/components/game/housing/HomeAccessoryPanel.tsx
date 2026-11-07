import { useRef, useState } from "react";
import { Check, Clock3, CookingPot, Sparkles, X } from "lucide-react";
import { homeFurnitureActions, homeTaskSeconds } from "@/lib/home-furniture-actions";
import {
  ACTION_CATALOG,
  NEED_RULES,
  type LifeActionId,
  type NeedName,
} from "@/lib/life-simulation";
import type { HousePlacement } from "./HouseRoomScene";

// Meal preference is presentation only: every dish uses the existing validated cook action.
// Raw ingredients are not listed; they are not dishes.
type Tier = "street" | "home" | "prestige" | "party";
const MEAL_TIERS: { id: Tier; label: string }[] = [
  { id: "street", label: "Street food & quick meals" },
  { id: "home", label: "Home-cooked staples" },
  { id: "prestige", label: "Prestige & gourmet" },
  { id: "party", label: "Party food" },
];
const MEALS = [
  { id: "bread-tea", tier: "street", name: "Bread & tea", symbol: "🍞" },
  { id: "ojojo", tier: "street", name: "Ojojo", symbol: "🍌" },
  { id: "kokoro", tier: "street", name: "Kokoro", symbol: "🍠" },
  { id: "boiled-plantain-egg", tier: "street", name: "Boiled plantain & egg", symbol: "🍳" },
  { id: "fried-dodo", tier: "street", name: "Fried dodo", symbol: "🍌" },
  { id: "jollof", tier: "home", name: "Jollof rice", symbol: "🍚" },
  { id: "ewa-agoyin", tier: "home", name: "Ewa agoyin", symbol: "🫘" },
  { id: "eba-ewedu", tier: "home", name: "Eba & ewedu", symbol: "🥬" },
  { id: "amala-gbegiri", tier: "home", name: "Amala & gbegiri", symbol: "🥣" },
  { id: "yam-porridge", tier: "home", name: "Yam porridge", symbol: "🍲" },
  { id: "ofada-ayamase", tier: "home", name: "Ofada rice & ayamase", symbol: "🍛" },
  { id: "pounded-yam-egusi", tier: "prestige", name: "Pounded yam & egusi", symbol: "🍲" },
  { id: "efo-riro", tier: "prestige", name: "Efo riro", symbol: "🥬" },
  { id: "ikokore", tier: "prestige", name: "Ikokore", symbol: "🐟" },
  { id: "suya-platter", tier: "prestige", name: "Suya platter", symbol: "🍢" },
  { id: "isi-ewu", tier: "prestige", name: "Isi ewu", symbol: "🐐" },
  { id: "party-jollof", tier: "party", name: "Party jollof", symbol: "🔥" },
  { id: "moin-moin", tier: "party", name: "Moin moin", symbol: "🫔" },
  { id: "akara-ogi", tier: "party", name: "Akara & ogi", symbol: "🧆" },
  { id: "small-chops", tier: "party", name: "Small chops platter", symbol: "🥟" },
  { id: "chin-chin", tier: "party", name: "Chin chin", symbol: "🍪" },
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
  onUse: (action: LifeActionId) => Promise<boolean>;
}) {
  const [meal, setMeal] = useState<string>("jollof");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const working = pending || submitting;
  const choices = homeFurnitureActions(placement.item_id);
  const [chosenAction, setChosenAction] = useState<LifeActionId | null>(null);
  const actionId = chosenAction ?? choices[0];
  if (!actionId) return null;
  const action = ACTION_CATALOG[actionId];
  const cooking = actionId === "cook";
  const selected = MEALS.find((item) => item.id === meal)!;
  const actionLabel = cooking ? `Cook ${selected.name}` : action.name;
  const accessoryLabel = cooking
    ? "Your cooker"
    : actionId === "shower"
      ? "Shower"
      : actionId === "sleep"
        ? "Bed"
        : placement.item_id.replaceAll("-", " ");
  const runAccessory = async () => {
    if (inFlight.current || pending || disabledReason) return;
    inFlight.current = true;
    setSubmitting(true);
    setConfirmed(false);
    try {
      if (await onUse(actionId)) setConfirmed(true);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  return (
    <section className="home-accessory-panel" role="region" aria-label={`${accessoryLabel} action`}>
      <header className="home-accessory-heading">
        <span className="home-accessory-icon">
          {cooking ? <CookingPot size={25} /> : <Sparkles size={25} />}
        </span>
        <div>
          <h2>{accessoryLabel}</h2>
          <p>{cooking ? "Choose a meal" : action.name}</p>
        </div>
        <button
          type="button"
          className="home-accessory-close"
          onClick={onClose}
          aria-label="Close accessory"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </header>
      <div className="home-task-options" role="group" aria-label="Accessory tasks">
        {choices.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={actionId === id}
            disabled={working}
            onClick={() => {
              setChosenAction(id);
              setConfirmed(false);
            }}
          >
            {ACTION_CATALOG[id].name}
            <small>{homeTaskSeconds(id)}s</small>
          </button>
        ))}
      </div>
      <div className="home-accessory-facts">
        <span>
          <Clock3 size={14} />
          {homeTaskSeconds(actionId)}s � {action.durationMinutes} game min
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
        <div className="home-meal-groups" role="radiogroup" aria-label="Meal preference">
          {MEAL_TIERS.map((tier) => (
            <section key={tier.id} className="home-meal-group">
              <h3 className="home-meal-tier">{tier.label}</h3>
              <div className="home-meal-grid">
                {MEALS.filter((item) => item.tier === tier.id).map((item) => (
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
                      disabled={working}
                      onChange={() => {
                        setMeal(item.id);
                        setConfirmed(false);
                      }}
                    />
                    <span className="home-meal-top">
                      <span className="home-meal-symbol" aria-hidden="true">
                        {item.symbol}
                      </span>
                      <span className="home-meal-time">
                        <Clock3 size={12} aria-hidden="true" />
                        {action.durationMinutes}m
                      </span>
                    </span>
                    <span className="home-meal-price">Free</span>
                    <strong>{item.name}</strong>
                    <span className="home-meal-chips" aria-hidden="true">
                      {Object.entries(action.needs)
                        .filter(([, value]) => (value ?? 0) > 0)
                        .map(([need]) => (
                          <span key={need}>+{NEED_RULES[need as NeedName].label}</span>
                        ))}
                    </span>
                  </label>
                ))}
              </div>
            </section>
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
        className={`home-task-start${working ? " is-pending" : ""}`}
        disabled={!!disabledReason || working}
        aria-busy={working}
        onClick={() => void runAccessory()}
      >
        {working ? (
          <span className="home-task-button-label">
            <span className="home-task-spinner" aria-hidden="true" />
            Starting {actionLabel.toLowerCase()}…
          </span>
        ) : confirmed ? (
          <span className="home-task-button-label">
            <Check size={17} aria-hidden="true" />
            {actionLabel} again
          </span>
        ) : (
          actionLabel
        )}
      </button>
    </section>
  );
}
