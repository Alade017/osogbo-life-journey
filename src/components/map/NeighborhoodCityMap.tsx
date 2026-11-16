import { lazy, Suspense, useState } from "react";
import { Banknote, Bus, Compass, Footprints, Sparkles, X } from "lucide-react";
import {
  filterNeighborhoodLandmarks,
  NEIGHBORHOOD_FILTER_PILLS,
  SURROUNDING_CITY_DISTRICTS,
  type NeighborhoodFilterCategory,
  type NeighborhoodLandmarkSpec,
} from "@/data/neighborhoodLocations";
const NeighborhoodWorldOverview = lazy(() =>
  import("./NeighborhoodWorldOverview").then((module) => ({
    default: module.NeighborhoodWorldOverview,
  })),
);
import { formatNaira } from "@/lib/game";

export interface NeighborhoodCityMapProps {
  playerPosition: {
    scenePoint: { x: number; y: number };
    world3D: readonly [number, number];
    mapCoords: Readonly<{ x: number; y: number }>;
    isLive: boolean;
  };
  walletBalance: number | null;
  offline: boolean;
  onWalkHere: (landmark: NeighborhoodLandmarkSpec) => void;
  onBoardKeke: (landmark: NeighborhoodLandmarkSpec) => void;
  onSelectSurroundingDistrict?: (landmarkId: string) => void;
  onOpenDistrictMapView?: () => void;
}

export function NeighborhoodCityMap({
  playerPosition,
  walletBalance,
  offline,
  onWalkHere,
  onBoardKeke,
  onSelectSurroundingDistrict,
  onOpenDistrictMapView,
}: NeighborhoodCityMapProps) {
  const [activeFilter, setActiveFilter] = useState<NeighborhoodFilterCategory>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fareError, setFareError] = useState<string | null>(null);

  const [focus, setFocus] = useState<"overview" | "player" | "destination" | "free">("overview");
  const [resetKey, setResetKey] = useState(0);
  const visibleLandmarks = filterNeighborhoodLandmarks(activeFilter);
  const selectedLandmark = visibleLandmarks.find((item) => item.id === selectedId) ?? null;

  const canAffordKeke =
    selectedLandmark === null ||
    walletBalance === null ||
    walletBalance >= selectedLandmark.kekeFare;

  const handleSelectPin = (landmark: NeighborhoodLandmarkSpec) => {
    setFareError(null);
    setSelectedId(landmark.id);
    setFocus("destination");
  };

  const handleBoardKekeClick = (landmark: NeighborhoodLandmarkSpec) => {
    if (walletBalance !== null && walletBalance < landmark.kekeFare) {
      setFareError(
        `You need ${formatNaira(landmark.kekeFare)} pocket cash to board a Keke here. Walk here for free or visit an ATM.`,
      );
      return;
    }
    setFareError(null);
    onBoardKeke(landmark);
  };

  return (
    <section
      className="ncm-shell"
      aria-label="Interactive Olaiya neighborhood and Osogbo district map"
    >
      <header className="ncm-header">
        <div className="ncm-title-block">
          <p className="ncm-eyebrow">Olaiya Central · Osogbo</p>
          <h2>Olaiya in 3D</h2>
        </div>

        <div className="ncm-live-readout" aria-live="polite">
          <span className="ncm-coord-badge">
            <Compass size={14} aria-hidden="true" />
            <span>
              {playerPosition.isLive ? "Live position" : "Saved spot"} ·{" "}
              <strong className="tabular-nums">
                {playerPosition.world3D[0].toFixed(1)}m, {playerPosition.world3D[1].toFixed(1)}m
              </strong>
            </span>
          </span>
          {walletBalance !== null && (
            <span className="ncm-wallet-readout tabular-nums">
              <Banknote size={14} aria-hidden="true" />
              Pocket {formatNaira(walletBalance)}
            </span>
          )}
        </div>
      </header>

      <div className="ncm-filter-row" role="toolbar" aria-label="Filter neighborhood landmarks">
        <div className="ncm-filter-pills">
          {NEIGHBORHOOD_FILTER_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className="ncm-filter-pill"
              aria-pressed={activeFilter === pill.id}
              onClick={() => {
                setActiveFilter(pill.id);
                setSelectedId(null);
                setFareError(null);
                setFocus("overview");
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {onOpenDistrictMapView && (
          <button type="button" className="ncm-district-switch" onClick={onOpenDistrictMapView}>
            3D City Districts
          </button>
        )}
      </div>

      <div className="ncm-stage">
        <div className="ncm-canvas-frame">
          <div className="ncm-camera-tools" role="toolbar" aria-label="3D neighborhood camera">
            <button
              type="button"
              aria-pressed={focus === "player"}
              onClick={() => setFocus("player")}
            >
              Follow me
            </button>
            <button
              type="button"
              onClick={() => {
                setFocus("overview");
                setResetKey((value) => value + 1);
              }}
            >
              Reset view
            </button>
          </div>
          <div className="ncm-world" aria-label="3D Olaiya neighborhood">
            <Suspense
              fallback={
                <p className="map-scene-message" role="status">
                  Loading Olaiya in 3D…
                </p>
              }
            >
              <NeighborhoodWorldOverview
                landmarks={visibleLandmarks}
                selected={selectedLandmark}
                player={playerPosition.world3D}
                focus={focus}
                resetKey={resetKey}
                onSelect={handleSelectPin}
                onManual={() => setFocus("free")}
              />
            </Suspense>
          </div>
          <p className="ncm-camera-hint">
            Drag to move · Pinch or scroll to zoom · Fixed north-up view
          </p>

          {/* Sleek Porcelain-and-Indigo Location Drawer */}
          {selectedLandmark && (
            <aside
              className="ncm-drawer"
              role="dialog"
              aria-label={`${selectedLandmark.name} details`}
            >
              <header className="ncm-drawer-head">
                <div>
                  <p className="ncm-drawer-kicker">
                    {selectedLandmark.badgeLabel} ·{" "}
                    <span className="tabular-nums">
                      [{selectedLandmark.world3D[0].toFixed(1)}m,{" "}
                      {selectedLandmark.world3D[1].toFixed(1)}m]
                    </span>
                  </p>
                  <h3>{selectedLandmark.name}</h3>
                </div>
                <button
                  type="button"
                  className="ncm-drawer-close"
                  aria-label="Close location drawer"
                  onClick={() => {
                    setSelectedId(null);
                    setFareError(null);
                    setFocus("overview");
                  }}
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </header>

              <p className="ncm-drawer-desc">{selectedLandmark.description}</p>

              <div className="ncm-drawer-activities">
                <p className="ncm-drawer-section-label">What you can do here</p>
                <ul>
                  {selectedLandmark.activities.map((activity) => (
                    <li key={activity.id}>
                      <Sparkles size={13} aria-hidden="true" />
                      <div>
                        <strong>{activity.label}</strong>
                        <span>{activity.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {fareError && (
                <p className="ncm-drawer-error" role="alert">
                  {fareError}
                </p>
              )}

              <div className="ncm-drawer-actions">
                <button
                  type="button"
                  className="ncm-btn-walk"
                  onClick={() => onWalkHere(selectedLandmark)}
                >
                  <Footprints size={16} aria-hidden="true" />
                  Walk Here
                </button>
                <button
                  type="button"
                  className="ncm-btn-keke"
                  disabled={offline && walletBalance === null}
                  onClick={() => handleBoardKekeClick(selectedLandmark)}
                  aria-disabled={!canAffordKeke}
                >
                  <Bus size={16} aria-hidden="true" />
                  <span>Board Keke / Korope · {formatNaira(selectedLandmark.kekeFare)}</span>
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
      <div className="ncm-destinations" role="group" aria-label="Neighborhood destinations">
        {visibleLandmarks.map((landmark) => (
          <button
            key={landmark.id}
            type="button"
            aria-label={`${landmark.name}, ${landmark.badgeLabel}`}
            aria-pressed={selectedId === landmark.id}
            onClick={() => handleSelectPin(landmark)}
          >
            <span className="ncm-destination-dot" style={{ background: landmark.accentColor }} />
            <span>
              {landmark.shortLabel}
              <small>{landmark.badgeLabel}</small>
            </span>
          </button>
        ))}
      </div>
      <nav className="ncm-district-links" aria-label="Surrounding Osogbo districts">
        {SURROUNDING_CITY_DISTRICTS.map((district) => (
          <button
            key={district.id}
            type="button"
            title={district.summary}
            onClick={() => onSelectSurroundingDistrict?.(district.landmarkId)}
          >
            {district.name} · {district.directionLabel}
          </button>
        ))}
      </nav>
    </section>
  );
}
