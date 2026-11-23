import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Armchair,
  ArrowLeft,
  ChevronRight,
  Monitor,
  Move,
  Sparkles,
  X,
} from "lucide-react";
import { homeFurnitureAction } from "@/lib/home-furniture-actions";
import { homeFurnitureLabel } from "@/lib/home-furniture-label";
import { ACTION_CATALOG, type LifeActionId } from "@/lib/life-simulation";
import type { HousePlacement } from "./HouseRoomScene";
import { HomeAccessoryPanel } from "./HomeAccessoryPanel";

type Props = {
  placement: HousePlacement;
  roomLabel: string;
  disabledReason: string | null;
  pending: boolean;
  error: string;
  onClose: () => void;
  onUse: (action: LifeActionId) => Promise<boolean>;
  onMove: () => void;
  onStore: () => Promise<void>;
};

/** Selection overview; activity configuration retains the existing authoritative task panel. */
export function HomeFurniturePanel({
  placement,
  roomLabel,
  disabledReason,
  pending,
  error,
  onClose,
  onUse,
  onMove,
  onStore,
}: Props) {
  const [view, setView] = useState<"overview" | "activity" | "inspect" | "store">("overview");
  const [saving, setSaving] = useState(false);
  const [storeError, setStoreError] = useState("");
  const inFlight = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const label = homeFurnitureLabel(placement.item_id);
  const primary = homeFurnitureAction(placement.item_id);
  const action = primary ? ACTION_CATALOG[primary] : null;
  const ItemIcon = primary === "watch_tv" ? Monitor : Armchair;
  const working = pending || saving;

  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus({ preventScroll: true });
    const dismiss = () => onCloseRef.current();
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("osogbo-hud-dismiss-panels", dismiss);
    return () => {
      window.removeEventListener("keydown", escape);
      window.removeEventListener("osogbo-hud-dismiss-panels", dismiss);
      if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        document.activeElement === document.body
      )
        previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    // Focus remains inside this non-modal region after changing its content.
    if (view !== "overview") panel.current?.focus({ preventScroll: true });
  }, [view]);

  const storeItem = async () => {
    if (inFlight.current || pending || disabledReason) return;
    inFlight.current = true;
    setSaving(true);
    setStoreError("");
    try {
      await onStore();
    } catch (failure) {
      setStoreError(failure instanceof Error ? failure.message : "The item could not be stored.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <section
        ref={panel}
        className="home-furniture-panel"
        role="region"
        aria-label={`${label} actions`}
        aria-busy={working}
        tabIndex={-1}
      >
        <header className="home-furniture-heading">
          <span className="home-furniture-icon">
            <ItemIcon size={28} aria-hidden="true" />
          </span>
          <div className="home-furniture-title">
            <h2>{label}</h2>
            <p>
              {homeFurnitureLabel(placement.category)} · {roomLabel}
            </p>
            {!disabledReason && primary && (
              <span className="home-furniture-availability">Walk to use</span>
            )}
          </div>
          <button
            ref={closeButton}
            type="button"
            className="home-furniture-close"
            aria-label="Close furniture actions"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="home-furniture-body">
          {view !== "overview" && (
            <button
              type="button"
              className="home-furniture-back"
              onClick={() => setView("overview")}
            >
              <ArrowLeft size={16} aria-hidden="true" /> All actions
            </button>
          )}
          {view === "overview" && (
            <>
              <p className="home-furniture-eyebrow">Available actions</p>
              <div className="home-furniture-actions">
                <button
                  type="button"
                  disabled={!primary || !!disabledReason || working}
                  onClick={() => setView("activity")}
                >
                  <ItemIcon size={27} aria-hidden="true" />
                  <span>
                    <strong>{action?.name ?? "Decoration"}</strong>
                    <small>{primary ? "Choose an activity" : "Inspect or rearrange"}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setView("inspect")}>
                  <Sparkles size={27} aria-hidden="true" />
                  <span>
                    <strong>Inspect</strong>
                    <small>Look closer</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
                <button type="button" disabled={!!disabledReason || working} onClick={onMove}>
                  <Move size={27} aria-hidden="true" />
                  <span>
                    <strong>Move</strong>
                    <small>Pick a new spot</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!!disabledReason || working}
                  onClick={() => setView("store")}
                >
                  <Archive size={27} aria-hidden="true" />
                  <span>
                    <strong>Store</strong>
                    <small>Return to inventory</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
          {view === "activity" && (
            <HomeAccessoryPanel
              placement={placement}
              disabledReason={disabledReason}
              pending={pending}
              error={error}
              onClose={() => setView("overview")}
              onUse={onUse}
            />
          )}
          {view === "inspect" && (
            <dl className="home-furniture-details">
              <div>
                <dt>Item</dt>
                <dd>{label}</dd>
              </div>
              <div>
                <dt>Room</dt>
                <dd>{roomLabel}</dd>
              </div>
              <div>
                <dt>Floor</dt>
                <dd>{placement.floor === 1 ? "Upstairs" : "Ground floor"}</dd>
              </div>
              <div>
                <dt>Rotation</dt>
                <dd>{Math.round(placement.rotation_deg ?? 0)}°</dd>
              </div>
              <div>
                <dt>Use</dt>
                <dd>{action?.name ?? "Decoration"}</dd>
              </div>
            </dl>
          )}
          {view === "store" && (
            <div className="home-furniture-store">
              <p>Store {label}? It will return to your inventory.</p>
              <div>
                <button type="button" disabled={working} onClick={() => setView("overview")}>
                  Keep item
                </button>
                <button
                  type="button"
                  disabled={!!disabledReason || working}
                  onClick={() => void storeItem()}
                >
                  {working ? "Storing…" : "Confirm store"}
                </button>
              </div>
            </div>
          )}
          {view !== "activity" && (disabledReason || error || storeError) && (
            <p className="home-task-notice" role={error || storeError ? "alert" : "status"}>
              {storeError || error || disabledReason}
            </p>
          )}
        </div>
      </section>
      <aside className="home-selection-toast" aria-label="Selected furniture">
        <ItemIcon size={27} aria-hidden="true" />
        <span>
          <strong>{label} selected</strong>
          <small>Choose an action to continue.</small>
        </span>
      </aside>
    </>
  );
}
