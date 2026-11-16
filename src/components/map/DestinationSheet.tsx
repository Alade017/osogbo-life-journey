import { useId, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Footprints,
  Bus,
  Car,
  Bike,
  MapPin,
  Wallet,
  X,
} from "lucide-react";
import type { TravelMode } from "@/lib/transport-service";
import { formatMapNaira } from "./map-ui-utils";
import { mapTravelBusy, type MapTravelPhase, type MapTravelTab } from "./map-travel-state";
import "./destination-sheet.css";

export type DestinationTransportOption = {
  id: TravelMode;
  label: string;
  hint: string;
  fare: number;
  minutes: number;
};
export type DestinationSheetStatus = {
  message: string;
  tone: "ready" | "loading" | "blocked" | "error";
  action?: { label: string; onClick: () => void; disabled?: boolean };
};
export type DestinationSheetProps = {
  open: boolean;
  interactionPending?: boolean;
  title: string;
  category: string;
  districtName: string;
  originName: string;
  destinationName: string;
  tab: MapTravelTab;
  onTabChange: (tab: MapTravelTab) => void;
  selectedMode: TravelMode | null;
  onModeChange: (mode: TravelMode) => void;
  options: DestinationTransportOption[];
  walletBalance: number | null;
  walletLoading: boolean;
  onRetryBalance: () => void;
  status: DestinationSheetStatus;
  phase: MapTravelPhase;
  error: string | null;
  canTravel: boolean;
  canChooseMode: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onRetryArrival: () => void;
  details: ReactNode;
};
const TRANSPORT_ICONS = {
  walking: Footprints,
  danfo: Bus,
  keke: Car,
  okada: Bike,
  car: Car,
};
const CATEGORY_EMOJI: Record<string, string> = {
  market: "🛍️",
  transport: "🚌",
  school: "🎓",
  health: "🏥",
  worship: "🏛️",
  junction: "🚦",
  sport: "⚽",
  food: "🍽️",
  services: "🏙️",
  bank: "🏦",
};

/** Controlled destination UI. It never submits an RPC or owns payment/arrival state. */
export function DestinationSheet(props: DestinationSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const restoreFocus = useRef<HTMLElement | null>(null);
  const busy = mapTravelBusy(props.phase);
  const confirmed = ["syncing", "sync-error", "arrived"].includes(props.phase);
  const locked = busy || confirmed || Boolean(props.interactionPending);
  const selected = props.options.find((option) => option.id === props.selectedMode);
  const shortage =
    selected && props.walletBalance !== null ? Math.max(0, selected.fare - props.walletBalance) : 0;
  const paidBalanceUnknown = !!selected && selected.fare > 0 && props.walletBalance === null;
  const switchTab = (tab: MapTravelTab) => {
    if (locked) return;
    props.onTabChange(tab);
    if (tab === "details") setExpanded(true);
  };
  const tabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (locked || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tab =
      event.key === "Home"
        ? "travel"
        : event.key === "End"
          ? "details"
          : props.tab === "travel"
            ? "details"
            : "travel";
    switchTab(tab);
    document.getElementById(`${id}-${tab}-tab`)?.focus();
  };
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(open) => {
        if (!open && !locked) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="destination-sheet-overlay" />
        <Dialog.Content
          className={`destination-sheet${expanded ? " is-expanded" : ""}`}
          aria-describedby={`${id}-description`}
          onOpenAutoFocus={(event) => {
            restoreFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            event.preventDefault();
            document.getElementById(`${id}-${props.tab}-tab`)?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (restoreFocus.current?.isConnected) restoreFocus.current.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (locked) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (locked) event.preventDefault();
          }}
        >
          <header className="destination-header">
            <span className="destination-category-icon" aria-hidden="true">
              {CATEGORY_EMOJI[props.category] ?? "📍"}
            </span>
            <div className="destination-heading">
              <p>{props.districtName}</p>
              <Dialog.Title>{props.title}</Dialog.Title>
              <Dialog.Description id={`${id}-description`}>
                Choose how to get here or explore what’s available.
              </Dialog.Description>
            </div>
            <div className="destination-header-actions">
              <button
                type="button"
                className="destination-expand"
                aria-label={expanded ? "Collapse travel sheet" : "Expand travel sheet"}
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
              <button
                type="button"
                className="destination-close"
                aria-label="Cancel travel selection"
                disabled={locked}
                onClick={props.onClose}
              >
                <X size={18} />
              </button>
            </div>
          </header>
          <div className="destination-tabs" role="tablist" aria-label="Destination information">
            <button
              type="button"
              role="tab"
              id={`${id}-travel-tab`}
              aria-controls={`${id}-travel-panel`}
              aria-selected={props.tab === "travel"}
              tabIndex={props.tab === "travel" ? 0 : -1}
              disabled={locked}
              onKeyDown={tabKey}
              onClick={() => switchTab("travel")}
            >
              Travel
            </button>
            <button
              type="button"
              role="tab"
              id={`${id}-details-tab`}
              aria-controls={`${id}-details-panel`}
              aria-selected={props.tab === "details"}
              tabIndex={props.tab === "details" ? 0 : -1}
              disabled={locked}
              onKeyDown={tabKey}
              onClick={() => switchTab("details")}
            >
              Details & activities
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="destination-body">
            <section
              role="tabpanel"
              id={`${id}-travel-panel`}
              aria-labelledby={`${id}-travel-tab`}
              hidden={props.tab !== "travel"}
              className="destination-panel"
            >
              <div className="destination-route">
                <MapPin size={16} aria-hidden="true" />
                <span>{props.originName}</span>
                <ArrowRight size={14} aria-hidden="true" />
                <strong>{props.destinationName}</strong>
              </div>
              <div
                className={`destination-status is-${props.status.tone}`}
                role={props.status.tone === "error" ? "alert" : "status"}
              >
                {props.status.tone === "ready" && <Check size={14} aria-hidden="true" />}
                <span>{props.status.message}</span>
                {props.status.action && (
                  <button
                    type="button"
                    disabled={props.status.action.disabled}
                    onClick={props.status.action.onClick}
                  >
                    {props.status.action.label}
                  </button>
                )}
              </div>
              {props.options.length > 0 && (
                <fieldset className="destination-options" disabled={!props.canChooseMode || locked}>
                  <legend>Choose your transport</legend>
                  {props.options.map((option) => {
                    const Icon = TRANSPORT_ICONS[option.id];
                    return (
                      <label
                        key={option.id}
                        className={`destination-option${props.selectedMode === option.id ? " is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`${id}-transport`}
                          value={option.id}
                          checked={props.selectedMode === option.id}
                          onChange={() => props.onModeChange(option.id)}
                        />
                        <span className="destination-transport-icon">
                          <Icon size={20} aria-hidden="true" />
                        </span>
                        <span className="destination-option-copy">
                          <strong>{option.label}</strong>
                          <small>{option.hint}</small>
                        </span>
                        <span className="destination-option-price">
                          <strong>
                            {option.fare === 0 ? "Free" : formatMapNaira(option.fare)}
                          </strong>
                          <small>
                            <Clock3 size={11} aria-hidden="true" />
                            {option.minutes} game min
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
              {shortage > 0 && !confirmed && (
                <div className="destination-shortfall" role="alert">
                  <Wallet size={16} aria-hidden="true" />
                  <span>
                    You need {formatMapNaira(shortage)} more for {selected?.label}.{" "}
                    {props.options.some((option) => option.id === "walking")
                      ? "Walking is free."
                      : "Choose a cheaper ride or add money to your pocket."}
                  </span>
                </div>
              )}
              {paidBalanceUnknown && !confirmed && (
                <div className="destination-status" role="status">
                  <span>
                    {props.walletLoading
                      ? "Checking your pocket balance…"
                      : "Your balance could not be checked."}
                  </span>
                  {!props.walletLoading && (
                    <button type="button" onClick={props.onRetryBalance}>
                      Refresh balance
                    </button>
                  )}
                </div>
              )}
              <div className="destination-pocket">
                <Wallet size={14} aria-hidden="true" />
                <span>Pocket balance</span>
                <strong>
                  {props.walletBalance === null
                    ? props.walletLoading
                      ? "Loading…"
                      : "Unavailable"
                    : formatMapNaira(props.walletBalance)}
                </strong>
              </div>
            </section>
            <section
              role="tabpanel"
              id={`${id}-details-panel`}
              aria-labelledby={`${id}-details-tab`}
              hidden={props.tab !== "details"}
              className="destination-panel"
            >
              {props.tab === "details" && props.details}
            </section>
            {props.error && (
              <p className="destination-error" role="alert">
                {props.error}
              </p>
            )}
          </div>
          <footer className="destination-footer">
            {confirmed ? (
              <>
                <p className="destination-confirmed" role="status">
                  <Check size={16} aria-hidden="true" />
                  {props.phase === "arrived"
                    ? "Your destination is ready."
                    : "Your trip is confirmed."}
                </p>
                {props.phase === "sync-error" ? (
                  <button
                    type="button"
                    className="destination-primary"
                    onClick={props.onRetryArrival}
                  >
                    Retry destination loading
                  </button>
                ) : (
                  <p role="status">Loading your saved destination…</p>
                )}
              </>
            ) : (
              <>
                <div className="destination-booking">
                  <div className="destination-total">
                    <small>{selected ? selected.label : "Choose a transport"}</small>
                    <strong>
                      {selected
                        ? selected.fare === 0
                          ? "Free"
                          : formatMapNaira(selected.fare)
                        : "—"}
                    </strong>
                    {selected && <span>{selected.minutes} game min · estimate</span>}
                  </div>
                  <button
                    type="button"
                    className="destination-primary"
                    disabled={!props.canTravel || locked}
                    onClick={props.onConfirm}
                  >
                    {props.phase === "departing"
                      ? "Leaving home…"
                      : busy
                        ? "Confirming travel…"
                        : "Confirm and travel"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
                <div className="destination-footer-note">
                  <span>Fare and time are estimates</span>
                  <button type="button" disabled={locked} onClick={props.onClose}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
