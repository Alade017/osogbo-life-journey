import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Landmark,
  MapPinned,
  MessagesSquare,
  MoreHorizontal,
  Target,
  UsersRound,
} from "lucide-react";
import { PhoneLauncher } from "@/components/game/PhoneLauncher";
import { q, rpc, useGameAction } from "@/lib/game";
import {
  DASHBOARD_PIN_IDS,
  DEFAULT_DASHBOARD_PINS,
  dashboardBadgeCounts,
  normalizeDashboardPins,
  visibleDashboardPins,
  type DashboardPinId,
} from "@/lib/dashboard-pins";

const STORAGE_KEY = "osun-life-dashboard-pins-v1";
const definitions = {
  jobs: { label: "Jobs", to: "/jobs", icon: BriefcaseBusiness },
  bank: { label: "Bank", to: "/wallet", icon: Landmark },
  map: { label: "Map", to: "/map", icon: MapPinned },
  social: { label: "Social", to: "/social", icon: UsersRound },
  missions: { label: "Missions", to: "/missions", icon: Target },
  messages: { label: "Messages", to: "/social", icon: MessagesSquare },
} as const;

function readDevicePins() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeDashboardPins(JSON.parse(saved)) : [...DEFAULT_DASHBOARD_PINS];
  } catch {
    return [...DEFAULT_DASHBOARD_PINS];
  }
}

function storeDevicePins(pins: readonly DashboardPinId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    // The server preference remains authoritative when device storage is unavailable.
  }
}

export function DashboardFeatureStrip() {
  const stripRef = useRef<HTMLDivElement>(null);
  const { data: profile } = useQuery(q.profile());
  const { data: notifications } = useQuery(q.notifications());
  const [width, setWidth] = useState(390);
  const [pins, setPins] = useState<DashboardPinId[]>(readDevicePins);
  const savePins = useGameAction((next: DashboardPinId[]) => rpc.saveDashboardPins(next));

  useEffect(() => {
    const serverPins = (profile as (typeof profile & { dashboard_pins?: unknown }) | undefined)
      ?.dashboard_pins;
    if (serverPins === undefined) return;
    const normalized = normalizeDashboardPins(serverPins);
    setPins(normalized);
    storeDevicePins(normalized);
  }, [profile]);

  useEffect(() => {
    const element = stripRef.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visiblePins = useMemo(() => visibleDashboardPins(pins, width), [pins, width]);
  const badges = useMemo(() => dashboardBadgeCounts(notifications), [notifications]);
  const updatePins = (id: DashboardPinId) => {
    const next = pins.includes(id) ? pins.filter((pin) => pin !== id) : [...pins, id].slice(-5);
    const normalized = normalizeDashboardPins(next);
    setPins(normalized);
    storeDevicePins(normalized);
    savePins.mutate(normalized);
  };
  const editor = (
    <div className="dashboard-shortcut-editor">
      <p>Choose up to five shortcuts for your Home screen.</p>
      {DASHBOARD_PIN_IDS.map((id) => {
        const definition = definitions[id];
        const checked = pins.includes(id);
        return (
          <label key={id}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => updatePins(id)}
              disabled={!checked && pins.length >= 5}
            />
            <span>{definition.label}</span>
          </label>
        );
      })}
      {savePins.isPending && <small role="status">Saving shortcuts…</small>}
    </div>
  );

  return (
    <div ref={stripRef} className="dashboard-feature-strip" aria-label="Pinned shortcuts">
      {visiblePins.map((id) => {
        const definition = definitions[id];
        const Icon = definition.icon;
        const badge = badges[id] ?? 0;
        return (
          <Link
            key={id}
            to={definition.to}
            className="dashboard-feature-tile"
            aria-label={`${definition.label}${badge ? `, ${badge} needing attention` : ""}`}
          >
            <span className="dashboard-feature-icon">
              <Icon size={18} aria-hidden="true" />
              {badge > 0 && <b>{badge > 9 ? "9+" : badge}</b>}
            </span>
            <span>{definition.label}</span>
          </Link>
        );
      })}
      <PhoneLauncher
        trigger={
          <button type="button" className="dashboard-feature-tile" aria-label="More apps">
            <span className="dashboard-feature-icon">
              <MoreHorizontal size={19} aria-hidden="true" />
            </span>
            <span>More</span>
          </button>
        }
        shortcutEditor={editor}
      />
    </div>
  );
}
