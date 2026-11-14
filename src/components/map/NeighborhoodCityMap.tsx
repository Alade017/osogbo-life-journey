import { useMemo, useState } from "react";
import {
  Banknote,
  Bus,
  Compass,
  Footprints,
  Fuel,
  Home,
  Landmark,
  MapPin,
  Palette,
  ShoppingBag,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import {
  filterNeighborhoodLandmarks,
  HOME_MAP_ANCHOR,
  NEIGHBORHOOD_FILTER_PILLS,
  NEIGHBORHOOD_LANDMARKS,
  OLAIYA_MAP_VIEWPORT,
  scenePointToNormalized2D,
  SURROUNDING_CITY_DISTRICTS,
  type NeighborhoodFilterCategory,
  type NeighborhoodLandmarkSpec,
} from "@/data/neighborhoodLocations";
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

function normRect(leftX: number, topY: number, width: number, height: number) {
  const tl = scenePointToNormalized2D({ x: leftX, y: topY });
  const br = scenePointToNormalized2D({ x: leftX + width, y: topY + height });
  const spanX = OLAIYA_MAP_VIEWPORT.maxX - OLAIYA_MAP_VIEWPORT.minX;
  const spanY = OLAIYA_MAP_VIEWPORT.maxY - OLAIYA_MAP_VIEWPORT.minY;
  const x = ((leftX - OLAIYA_MAP_VIEWPORT.minX) / spanX) * 1000;
  const y = ((topY - OLAIYA_MAP_VIEWPORT.minY) / spanY) * 600;
  const w = (width / spanX) * 1000;
  const h = (height / spanY) * 600;
  return { x, y, w, h, tl, br };
}

function landmarkIcon(landmark: NeighborhoodLandmarkSpec) {
  switch (landmark.id) {
    case "adire-makers-yard":
      return Palette;
    case "filling-station-mart":
      return Fuel;
    case "commercial-bank-atm":
      return Landmark;
    case "open-market-buka":
      return Utensils;
    case "roadside-shops-pos":
      return ShoppingBag;
    case "keke-korope-stand":
      return Bus;
    default:
      return MapPin;
  }
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

  const visibleLandmarks = useMemo(() => filterNeighborhoodLandmarks(activeFilter), [activeFilter]);

  const selectedLandmark = useMemo(
    () => NEIGHBORHOOD_LANDMARKS.find((item) => item.id === selectedId) ?? null,
    [selectedId],
  );

  // Derived SVG layout rectangles directly from simulation world coordinates.
  const geometry = useMemo(() => {
    const leftAvenue = normRect(458, -220, 84, 800);
    const rightAvenue = normRect(1244, -220, 72, 800);
    const crossAvenue = normRect(-380, 460, 2080, 80);
    const homeLane = normRect(320, 318, 180, 44);
    const serviceAlley = normRect(865, -80, 50, 540);

    const adireZone = normRect(-255, -25, 620, 420);
    const stationZone = normRect(525, 25, 340, 415);
    const bankZone = normRect(915, -60, 315, 495);
    const shopsZone = normRect(1345, -10, 285, 425);
    const homeCompound = normRect(260, 240, 120, 110);

    return {
      leftAvenue,
      rightAvenue,
      crossAvenue,
      homeLane,
      serviceAlley,
      adireZone,
      stationZone,
      bankZone,
      shopsZone,
      homeCompound,
    };
  }, []);

  const canAffordKeke =
    selectedLandmark === null ||
    walletBalance === null ||
    walletBalance >= selectedLandmark.kekeFare;

  const handleSelectPin = (landmark: NeighborhoodLandmarkSpec) => {
    setFareError(null);
    setSelectedId((prev) => (prev === landmark.id ? null : landmark.id));
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
          <h2>Interactive Neighborhood Map</h2>
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
              onClick={() => setActiveFilter(pill.id)}
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
          {/* Surrounding Osogbo District Connectors */}
          <div className="ncm-compass-ring" aria-label="Surrounding Osogbo districts">
            {SURROUNDING_CITY_DISTRICTS.map((district) => (
              <button
                key={district.id}
                type="button"
                className={`ncm-compass-chip ncm-compass-${district.compassPosition}`}
                title={district.summary}
                onClick={() => onSelectSurroundingDistrict?.(district.landmarkId)}
              >
                <strong>{district.name}</strong>
                <span>{district.directionLabel}</span>
              </button>
            ))}
          </div>

          {/* Vector Cartography synced 1:1 with 3D Neighborhood Coordinates */}
          <svg
            className="ncm-svg"
            viewBox="0 0 1000 600"
            role="img"
            aria-label="Stylized map of Olaiya neighborhood streets and interactive zones"
          >
            <defs>
              <pattern id="ncm-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="rgba(22, 34, 92, 0.055)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            {/* Porcelain ground */}
            <rect width="1000" height="600" fill="#FAF7F0" />
            <rect width="1000" height="600" fill="url(#ncm-grid)" />

            {/* River Green Osun greenspace perimeter accents */}
            <path
              d="M 0 36 Q 110 18 220 44 T 460 28 T 760 40 T 1000 22 L 1000 0 L 0 0 Z"
              fill="rgba(30, 154, 95, 0.14)"
            />
            <circle cx="96" cy="542" r="22" fill="rgba(30, 154, 95, 0.22)" />
            <circle cx="912" cy="48" r="26" fill="rgba(30, 154, 95, 0.2)" />
            <circle cx="948" cy="548" r="18" fill="rgba(30, 154, 95, 0.2)" />

            {/* Zone Surfaces */}
            {/* Adire & Market Laterite Yard */}
            <rect
              x={geometry.adireZone.x}
              y={geometry.adireZone.y}
              width={geometry.adireZone.w}
              height={geometry.adireZone.h}
              rx="14"
              fill="rgba(200, 69, 45, 0.13)"
              stroke="rgba(200, 69, 45, 0.32)"
              strokeWidth="1.5"
            />
            {/* Filling Station Forecourt */}
            <rect
              x={geometry.stationZone.x}
              y={geometry.stationZone.y}
              width={geometry.stationZone.w}
              height={geometry.stationZone.h}
              rx="12"
              fill="rgba(242, 178, 28, 0.13)"
              stroke="rgba(22, 34, 92, 0.22)"
              strokeWidth="1.5"
            />
            {/* Commercial Bank Interlocking Courtyard */}
            <rect
              x={geometry.bankZone.x}
              y={geometry.bankZone.y}
              width={geometry.bankZone.w}
              height={geometry.bankZone.h}
              rx="12"
              fill="rgba(22, 34, 92, 0.08)"
              stroke="rgba(22, 34, 92, 0.28)"
              strokeWidth="1.5"
            />
            {/* Roadside Shops & Keke Shoulder */}
            <rect
              x={geometry.shopsZone.x}
              y={geometry.shopsZone.y}
              width={geometry.shopsZone.w}
              height={geometry.shopsZone.h}
              rx="12"
              fill="rgba(30, 154, 95, 0.1)"
              stroke="rgba(30, 154, 95, 0.32)"
              strokeWidth="1.5"
            />
            {/* Home Compound */}
            <rect
              x={geometry.homeCompound.x}
              y={geometry.homeCompound.y}
              width={geometry.homeCompound.w}
              height={geometry.homeCompound.h}
              rx="10"
              fill="rgba(30, 154, 95, 0.2)"
              stroke="#1E9A5F"
              strokeWidth="1.6"
            />

            {/* Primary Road Network */}
            <rect
              x={geometry.leftAvenue.x}
              y={geometry.leftAvenue.y}
              width={geometry.leftAvenue.w}
              height={geometry.leftAvenue.h}
              fill="#2B354D"
            />
            <rect
              x={geometry.rightAvenue.x}
              y={geometry.rightAvenue.y}
              width={geometry.rightAvenue.w}
              height={geometry.rightAvenue.h}
              fill="#2B354D"
            />
            <rect
              x={geometry.crossAvenue.x}
              y={geometry.crossAvenue.y}
              width={geometry.crossAvenue.w}
              height={geometry.crossAvenue.h}
              fill="#2B354D"
            />
            <rect
              x={geometry.homeLane.x}
              y={geometry.homeLane.y}
              width={geometry.homeLane.w}
              height={geometry.homeLane.h}
              rx="6"
              fill="#5D667A"
            />
            <rect
              x={geometry.serviceAlley.x}
              y={geometry.serviceAlley.y}
              width={geometry.serviceAlley.w}
              height={geometry.serviceAlley.h}
              rx="6"
              fill="#8E96A4"
            />

            {/* Dashed Road Centerlines */}
            <line
              x1={geometry.leftAvenue.x + geometry.leftAvenue.w / 2}
              y1="0"
              x2={geometry.leftAvenue.x + geometry.leftAvenue.w / 2}
              y2="600"
              stroke="#FAF7F0"
              strokeWidth="2"
              strokeDasharray="10 10"
              opacity="0.72"
            />
            <line
              x1={geometry.rightAvenue.x + geometry.rightAvenue.w / 2}
              y1="0"
              x2={geometry.rightAvenue.x + geometry.rightAvenue.w / 2}
              y2="600"
              stroke="#FAF7F0"
              strokeWidth="2"
              strokeDasharray="10 10"
              opacity="0.72"
            />
            <line
              x1="0"
              y1={geometry.crossAvenue.y + geometry.crossAvenue.h / 2}
              x2="1000"
              y2={geometry.crossAvenue.y + geometry.crossAvenue.h / 2}
              stroke="#FAF7F0"
              strokeWidth="2"
              strokeDasharray="10 10"
              opacity="0.72"
            />

            {/* Quiet Street Labels */}
            <text
              x={geometry.leftAvenue.x + geometry.leftAvenue.w / 2}
              y="22"
              textAnchor="middle"
              className="ncm-road-label"
            >
              LEFT AVENUE
            </text>
            <text
              x={geometry.rightAvenue.x + geometry.rightAvenue.w / 2}
              y="22"
              textAnchor="middle"
              className="ncm-road-label"
            >
              RIGHT AVENUE
            </text>
            <text
              x="250"
              y={geometry.crossAvenue.y + geometry.crossAvenue.h / 2 + 4}
              textAnchor="middle"
              className="ncm-road-label"
            >
              OLAIYA CROSS AVENUE
            </text>
            <text
              x={geometry.serviceAlley.x + geometry.serviceAlley.w / 2}
              y="180"
              textAnchor="middle"
              transform={`rotate(-90 ${geometry.serviceAlley.x + geometry.serviceAlley.w / 2} 180)`}
              className="ncm-alley-label"
            >
              SERVICE ALLEY
            </text>

            {/* Preview Path Line from Player to Selected Landmark */}
            {selectedLandmark && (
              <line
                x1={playerPosition.mapCoords.x * 1000}
                y1={playerPosition.mapCoords.y * 600}
                x2={selectedLandmark.mapCoords.x * 1000}
                y2={selectedLandmark.mapCoords.y * 600}
                stroke="#F2B21C"
                strokeWidth="3"
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            )}
          </svg>

          {/* Interactive HTML Landmark Pin Overlay */}
          <div className="ncm-pin-layer">
            {/* Home Anchor */}
            <div
              className="ncm-home-marker"
              style={{
                left: `${HOME_MAP_ANCHOR.mapCoords.x * 100}%`,
                top: `${HOME_MAP_ANCHOR.mapCoords.y * 100}%`,
              }}
              title="Your Home Entrance"
            >
              <Home size={13} aria-hidden="true" />
              <span>Home</span>
            </div>

            {/* Category-Badged Landmark Pins */}
            {NEIGHBORHOOD_LANDMARKS.map((landmark) => {
              const isVisible = visibleLandmarks.some((item) => item.id === landmark.id);
              if (!isVisible) return null;
              const Icon = landmarkIcon(landmark);
              const isSelected = selectedId === landmark.id;
              return (
                <button
                  key={landmark.id}
                  type="button"
                  className={`ncm-pin ${isSelected ? "is-selected" : ""}`}
                  style={{
                    left: `${landmark.mapCoords.x * 100}%`,
                    top: `${landmark.mapCoords.y * 100}%`,
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${landmark.name}, ${landmark.badgeLabel}`}
                  onClick={() => handleSelectPin(landmark)}
                >
                  <span className="ncm-pin-badge" style={{ backgroundColor: landmark.accentColor }}>
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="ncm-pin-label">
                    <strong>{landmark.shortLabel}</strong>
                    <small>{landmark.badgeLabel}</small>
                  </span>
                </button>
              );
            })}

            {/* Live Player Position Marker */}
            <div
              className="ncm-player-marker"
              style={{
                left: `${playerPosition.mapCoords.x * 100}%`,
                top: `${playerPosition.mapCoords.y * 100}%`,
              }}
              role="status"
              aria-label={`Your character at ${playerPosition.world3D[0].toFixed(1)}m, ${playerPosition.world3D[1].toFixed(1)}m`}
            >
              <span className="ncm-player-halo" aria-hidden="true" />
              <span className="ncm-player-core" aria-hidden="true" />
              <span className="ncm-player-tag">You</span>
            </div>
          </div>

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
    </section>
  );
}
