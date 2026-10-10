import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  Bus,
  ChevronRight,
  CircleDollarSign,
  Compass,
  MapPin,
  Minus,
  Plus,
  ShoppingBasket,
  Users,
  X,
} from "lucide-react";
import { q, rpc, formatNaira } from "@/lib/game";
import { Avatar } from "@/components/game/Avatar";
import type { Appearance } from "@/components/game/Avatar";
import type { Location } from "@/lib/game";
import {
  CITY_DISTRICTS,
  CITY_ROAD_EDGES,
  CITY_ROUNDABOUTS,
  cityDistrictForLocation,
  cityEntranceForLocation,
  cityIsoDiamond,
  cityPositionForLocation,
  cityWorldToIso,
  findCityRoadPath,
  stableCityOffset,
  type CityWorldPosition,
} from "@/lib/city-world";
import { TRAVEL_MODE_DETAILS, estimateTrip, type TravelMode } from "@/lib/transport-service";
import "./fictional-city.css";

type Point = { x: number; y: number };
const VIEW = { width: 1000, height: 760 };
const categories = ["All", "Shop", "Jobs", "Service", "Landmark"];
const icons = [ShoppingBasket, BriefcaseBusiness, CircleDollarSign, Users];
const roadPoints = (a: CityWorldPosition, b: CityWorldPosition) => {
  const p = cityWorldToIso(a);
  const q = cityWorldToIso(b);
  return `${p.x},${p.y} ${q.x},${q.y}`;
};

export function FictionalCityMap() {
  const { data: character } = useQuery(q.character());
  const queryClient = useQueryClient();
  const { data: locationsData } = useQuery(q.locations());
  const { data: placesData } = useQuery(q.places());
  const locations = locationsData ?? [];
  const places = placesData ?? [];
  const { data: wallet } = useQuery({ ...q.wallet(), enabled: !!character });
  const { data: jobsData } = useQuery({ ...q.jobs(), enabled: !!character });
  const { data: npcsData } = useQuery({ ...q.npcs(), enabled: !!character });
  const jobs = jobsData ?? [];
  const npcs = npcsData ?? [];
  const clientName = character?.name ?? "Player";
  const center = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [walkingPosition, setWalkingPosition] = useState<Point | null>(null);
  const [walkingRoute, setWalkingRoute] = useState<CityWorldPosition[] | null>(null);
  const movedPointer = useRef(false);
  const pointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const selected = locations.find((location) => location.id === selectedId) ?? null;
  const current = locations.find((location) => location.id === character?.current_location_id);
  const persistedPosition =
    character && Number.isFinite(character.world_x) && Number.isFinite(character.world_y)
      ? { x: character.world_x, y: character.world_y }
      : cityEntranceForLocation(current?.slug ?? "city-centre");
  const position = persistedPosition;
  const displayPosition = walkingPosition ?? position;
  const revision = character?.world_position_revision ?? 0;
  const sceneTransform = `translate(${offset.x} ${offset.y}) translate(500 370) scale(${scale}) translate(-500 -370)`;
  const activeLocations = locations.filter((item) => item.is_active);
  const visibleLocations = activeLocations.filter((item) => {
    if (filter === "All") return true;
    const type = `${item.type} ${item.district_type}`.toLowerCase();
    if (filter === "Shop") return /market|shop|commercial|retail/.test(type);
    if (filter === "Jobs")
      return jobs.some((job) => job.location_id === item.id && job.is_available);
    if (filter === "Service") return /service|transport|health|bank|office/.test(type);
    return /landmark|culture|university|residential|outskirt/.test(type);
  });

  async function walkTo(destination: Point, buildingSlug: string | null = null) {
    if (!character) return;
    const path = findCityRoadPath(position, destination);
    if (!path) {
      setNotice("That street is blocked. Try another destination.");
      return;
    }
    setBusy(true);
    setNotice("Walking along the street…");
    setWalkingRoute(path);
    const animateWalk = new Promise<void>((resolve) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || path.length < 2) {
        setWalkingPosition(destination);
        resolve();
        return;
      }
      const started = performance.now();
      const duration = Math.min(900, Math.max(280, path.length * 65));
      const frame = (now: number) => {
        const progress = Math.min(1, (now - started) / duration);
        const scaled = progress * (path.length - 1);
        const index = Math.min(path.length - 2, Math.floor(scaled));
        const mix = progress === 1 ? 1 : scaled - index;
        const start = path[index]!;
        const end = path[index + 1]!;
        setWalkingPosition({
          x: start.x + (end.x - start.x) * mix,
          y: start.y + (end.y - start.y) * mix,
        });
        if (progress < 1) window.requestAnimationFrame(frame);
        else resolve();
      };
      window.requestAnimationFrame(frame);
    });
    try {
      const [saveResult] = await Promise.allSettled([
        rpc.savePlayerWorldPosition({
          worldX: destination.x,
          worldY: destination.y,
          buildingSlug,
          expectedRevision: revision,
          requestId: crypto.randomUUID(),
        }),
        animateWalk,
      ]);
      if (saveResult?.status === "rejected") throw saveResult.reason;
      await queryClient.invalidateQueries();
      setNotice("You arrived. Your energy and the city clock have been updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save your movement.");
    } finally {
      setWalkingPosition(null);
      setWalkingRoute(null);
      setBusy(false);
    }
  }

  async function travelTo(location: Location, mode: TravelMode) {
    if (!character) return;
    setBusy(true);
    setNotice(`${TRAVEL_MODE_DETAILS[mode].label} trip in progress…`);
    try {
      await rpc.travelToCityLocation({
        locationId: location.id,
        mode,
        worldX: cityEntranceForLocation(location.slug).x,
        worldY: cityEntranceForLocation(location.slug).y,
        expectedRevision: revision,
        requestId: crypto.randomUUID(),
      });
      await queryClient.invalidateQueries();
      setSelectedId(null);
      setNotice(`Arrived at ${location.name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Trip could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const beginDrag = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), scale };
    }
    setDrag({ x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, moved: false });
  };
  const moveDrag = (event: React.PointerEvent) => {
    if (pointers.current.has(event.pointerId))
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      setScale(
        Math.min(
          1.8,
          Math.max(0.65, (pinchStart.current.scale * distance) / pinchStart.current.distance),
        ),
      );
      movedPointer.current = true;
      return;
    }
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      drag.moved = true;
      movedPointer.current = true;
    }
    setOffset({ x: drag.ox + dx, y: drag.oy + dy });
  };
  const walkFromMapTap = (event: React.MouseEvent<SVGSVGElement>) => {
    if (movedPointer.current) {
      movedPointer.current = false;
      return;
    }
    if ((event.target as Element).closest(".city-building")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const screenX = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    const screenY = ((event.clientY - rect.top) / rect.height) * VIEW.height;
    const isoX = (screenX - 500 - offset.x) / scale + 500;
    const isoY = (screenY - 370 - offset.y) / scale + 370;
    const diagonal = (isoX - 500) / 31;
    const sum = (isoY - 58) / 20;
    const destination = {
      x: Math.max(0, Math.min(14, (sum + diagonal) / 2)),
      y: Math.max(0, Math.min(12, (sum - diagonal) / 2)),
    };
    if (Math.hypot(destination.x - position.x, destination.y - position.y) > 9) {
      setNotice("That spot is across town. Select its district to travel by road.");
      return;
    }
    void walkTo(destination);
  };

  return (
    <section className="fictional-city" aria-label="Interactive fictional city map">
      <div
        className="city-world-scene"
        ref={center}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          pinchStart.current = null;
          setDrag(null);
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          pinchStart.current = null;
          setDrag(null);
        }}
        onWheel={(event) =>
          setScale((s) => Math.min(1.8, Math.max(0.65, s - Math.sign(event.deltaY) * 0.08)))
        }
      >
        <svg
          className="city-world-svg"
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          role="img"
          aria-label="Illustrated isometric city with selectable districts and buildings"
          onClick={walkFromMapTap}
        >
          <defs>
            <linearGradient id="city-ground" x2="0" y2="1">
              <stop stopColor="#1e4338" />
              <stop offset="1" stopColor="#10251f" />
            </linearGradient>
            <pattern id="city-grid" width="62" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 20 31 0 62 20 31 40Z" fill="none" stroke="#477260" strokeOpacity=".25" />
            </pattern>
            <filter id="building-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity=".35" />
            </filter>
          </defs>
          <rect width="1000" height="760" fill="url(#city-ground)" />
          <g transform={sceneTransform}>
            <path
              d="M500 34 966 370 500 705 34 370Z"
              fill="url(#city-grid)"
              stroke="#6fa385"
              strokeOpacity=".3"
            />
            {CITY_DISTRICTS.map((district) => (
              <polygon
                key={district.id}
                points={cityIsoDiamond(district.center, district.radius)
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill={`var(--district-${district.tone})`}
                fillOpacity=".48"
                stroke="#9bc7a7"
                strokeOpacity=".18"
                strokeDasharray="4 8"
              />
            ))}
            {CITY_ROAD_EDGES.map((edge) => {
              const from = CITY_ROAD_EDGES.length ? edge.from.match(/road-(\d+)-(\d+)/) : null;
              const to = edge.to.match(/road-(\d+)-(\d+)/);
              if (!from || !to) return null;
              const a = { x: Number(from[1]), y: Number(from[2]) };
              const b = { x: Number(to[1]), y: Number(to[2]) };
              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <polyline
                    points={roadPoints(a, b)}
                    fill="none"
                    stroke="#0b1917"
                    strokeWidth={edge.kind === "arterial" ? 13 : 8}
                    strokeLinecap="round"
                  />
                  <polyline
                    points={roadPoints(a, b)}
                    fill="none"
                    stroke={edge.kind === "arterial" ? "#c4a873" : "#887d64"}
                    strokeOpacity=".9"
                    strokeWidth={edge.kind === "arterial" ? 8 : 4}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
            {CITY_ROUNDABOUTS.map((p, i) => {
              const c = cityWorldToIso(p);
              return (
                <g key={i}>
                  <ellipse
                    cx={c.x}
                    cy={c.y}
                    rx="14"
                    ry="9"
                    fill="#376349"
                    stroke="#dabd83"
                    strokeWidth="3"
                  />
                  <circle cx={c.x} cy={c.y} r="3" fill="#ead493" />
                </g>
              );
            })}
            {walkingRoute && (
              <polyline
                points={walkingRoute
                  .map((point) => {
                    const projected = cityWorldToIso(point, 2);
                    return `${projected.x},${projected.y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#9fe2ff"
                strokeWidth="4"
                strokeDasharray="8 7"
                strokeLinecap="round"
                opacity=".9"
              />
            )}
            {Array.from({ length: 58 }, (_, i) => {
              const x = 1 + ((i * 37) % 13),
                y = 1 + ((i * 19) % 11);
              const p = cityWorldToIso({ x, y });
              return (
                <g key={`tree-${i}`} transform={`translate(${p.x} ${p.y})`} opacity=".85">
                  <ellipse cy="3" rx="7" ry="3" fill="#0b1714" />
                  <path d="M0 -18 -8 -5 8 -5Z" fill={i % 2 ? "#43815a" : "#639553"} />
                  <path d="M0 -12 -6 -2 6 -2Z" fill="#8ba969" />
                </g>
              );
            })}
            <g className="city-vans" aria-hidden="true">
              <g transform="translate(432 300)">
                <rect x="-11" y="-7" width="22" height="11" rx="3" fill="#e6ad34" />
                <rect x="-7" y="-5" width="6" height="4" fill="#213c3a" />
                <rect x="2" y="-5" width="6" height="4" fill="#213c3a" />
                <circle cx="-6" cy="5" r="2.5" fill="#131a18" />
                <circle cx="7" cy="5" r="2.5" fill="#131a18" />
              </g>
              <g transform="translate(633 495)">
                <rect x="-9" y="-6" width="18" height="10" rx="3" fill="#3d8eb5" />
                <circle cx="-5" cy="5" r="2.3" fill="#131a18" />
                <circle cx="6" cy="5" r="2.3" fill="#131a18" />
              </g>
            </g>
            {visibleLocations.map((location, index) => {
              const base = cityPositionForLocation(location.slug);
              const jitter = stableCityOffset(location.id, 1);
              const building = { x: base.x + jitter.x * 0.18, y: base.y + jitter.y * 0.18 };
              const p = cityWorldToIso(building, 20 + (index % 3) * 4);
              const selectedNow = selectedId === location.id;
              const palette = ["#bb7447", "#a75443", "#507ca0", "#c18b37", "#738a58", "#8e6797"];
              const roof = palette[index % palette.length];
              const category = String(location.type ?? "").toLowerCase();
              const label = location.name;
              return (
                <g
                  key={location.id}
                  className={`city-building ${selectedNow ? "is-selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!movedPointer.current) setSelectedId(location.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(location.id);
                    }
                  }}
                  filter="url(#building-shadow)"
                >
                  <path
                    d={`M${p.x - 19} ${p.y + 3} v22 l19 12 19-12 V${p.y + 3} l-19 12Z`}
                    fill="#5a4b3d"
                  />
                  <path d={`M${p.x} ${p.y + 15} l19-12 v22 l-19 12Z`} fill="#70523c" />
                  <path d={`M${p.x - 19} ${p.y + 3} l19-13 19 13-19 12Z`} fill={roof} />
                  <path d={`M${p.x - 9} ${p.y + 9} v11 l7 4 V13Z`} fill="#f2c96e" />
                  <path d={`M${p.x + 7} ${p.y + 5} v7 l6-4 V1Z`} fill="#f7e0a0" />
                  <circle
                    cx={p.x}
                    cy={p.y - 16}
                    r="11"
                    fill={selectedNow ? "#f1c454" : "#e6efe5"}
                    stroke="#10251f"
                    strokeWidth="2"
                  />
                  <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fill="#17382c">
                    {category.includes("market") || category.includes("shop") ? "₦" : "⌂"}
                  </text>
                  <rect
                    x={p.x - 52}
                    y={p.y + 37}
                    width="104"
                    height="17"
                    rx="7"
                    fill="#071714"
                    fillOpacity=".9"
                  />
                  <text x={p.x} y={p.y + 49} textAnchor="middle" className="city-building-label">
                    {label.length > 17 ? `${label.slice(0, 16)}…` : label}
                  </text>
                </g>
              );
            })}
            {character &&
              (() => {
                const p = cityWorldToIso(displayPosition, 20);
                return (
                  <g
                    className="city-player"
                    transform={`translate(${p.x} ${p.y})`}
                    aria-label={`${clientName}, your character`}
                  >
                    <circle r="19" fill="#60c7ed" fillOpacity=".22" stroke="#7ad8fa" />
                    <foreignObject x="-14" y="-30" width="28" height="34">
                      <div className="city-avatar">
                        <Avatar
                          appearance={(character.appearance ?? {}) as Appearance}
                          gender={character.gender ?? "nonbinary"}
                          size={28}
                        />
                      </div>
                    </foreignObject>
                    <path d="M-4 4 0 11 4 4Z" fill="#7ad8fa" />
                  </g>
                );
              })()}
            <text x="490" y="86" className="city-area-label">
              OSOGBO
            </text>
          </g>
        </svg>
        <div className="city-map-tools" aria-label="Map controls">
          <button aria-label="Zoom in" onClick={() => setScale((s) => Math.min(1.8, s + 0.15))}>
            <Plus />
          </button>
          <button aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.65, s - 0.15))}>
            <Minus />
          </button>
          <button
            aria-label="Center on player"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            <Compass />
          </button>
        </div>
        <aside className="city-status-card">
          <div className="city-player-head">
            <div className="city-avatar-frame">
              <Avatar
                appearance={(character?.appearance ?? {}) as Appearance}
                gender={character?.gender ?? "nonbinary"}
                size={44}
              />
            </div>
            <div>
              <strong>{clientName}</strong>
              <small>
                Level {character?.level ?? 1} · {current?.name ?? "Central District"}
              </small>
            </div>
            <button
              className="city-icon-button"
              aria-label="Close player details"
              onClick={(e) =>
                e.currentTarget.parentElement?.parentElement?.classList.toggle("is-compact")
              }
            >
              <X size={16} />
            </button>
          </div>
          <div className="city-status-values">
            <span>
              ❤️ Health <b>{character?.health ?? 100}</b>
            </span>
            <span>
              ⚡ Energy <b>{character?.energy ?? 0}</b>
            </span>
            <span>
              🙂 Mood <b>{character?.happiness ?? 0}</b>
            </span>
          </div>
          <small className="city-cash-line">
            Wallet <b>{formatNaira(wallet?.balance ?? 0)}</b>
          </small>
        </aside>
        <aside className="city-quest-card">
          <span>WORLD ACTIVITY</span>
          <strong>{jobs.filter((job) => job.is_available).length} jobs hiring</strong>
          <p>Busy market roads today. Keep an eye on your energy before walking.</p>
          <div className="city-activity-tags">
            <span>
              <BriefcaseBusiness size={13} /> Jobs
            </span>
            <span>
              <Users size={13} /> {npcs.length} locals
            </span>
          </div>
        </aside>
        <div className="city-world-title">
          <span>
            <i /> SIMULATION LIVE
          </span>
          <strong>Osogbo, Osun State</strong>
          <small>Street life • markets • work • community</small>
        </div>
        <div className="city-filter-bar" role="tablist" aria-label="Filter map locations">
          {categories.map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={filter === item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {notice && (
          <div className="city-toast" role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="city-touch-hint">Drag to explore · pinch or scroll to zoom</div>
      </div>
      <nav className="city-bottom-shortcuts" aria-label="City shortcuts">
        <a href="/jobs">
          <BriefcaseBusiness />
          Jobs
        </a>
        <a href="/market">
          <ShoppingBasket />
          Market
        </a>
        <a href="/social">
          <Users />
          People
        </a>
        <a href="/inventory">
          <ChevronRight />
          Inventory
        </a>
      </nav>
      {selected && (
        <div
          className="city-drawer-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <section
            className="city-location-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="city-drawer-title"
          >
            <button
              className="city-drawer-close"
              aria-label="Close location details"
              onClick={() => setSelectedId(null)}
            >
              <X />
            </button>
            <span className="city-drawer-eyebrow">
              {CITY_DISTRICTS.find((d) => d.id === cityDistrictForLocation(selected.slug))?.name ??
                "CITY LOCATION"}
            </span>
            <h2 id="city-drawer-title">{selected.name}</h2>
            <p>
              {selected.description ||
                "A lively stop in the fictional city. Visit to discover its people, services and opportunities."}
            </p>
            <div className="city-drawer-info">
              <span>
                <MapPin size={15} /> {current?.id === selected.id ? "You are here" : "Across town"}
              </span>
              <span>
                <BriefcaseBusiness size={15} />{" "}
                {jobs.filter((j) => j.location_id === selected.id && j.is_available).length} open
                jobs
              </span>
              <span>
                <Users size={15} />{" "}
                {
                  npcs.filter(
                    (n) => n.home_location_id === selected.id || n.work_location_id === selected.id,
                  ).length
                }{" "}
                locals connected
              </span>
            </div>
            {current?.id === selected.id ? (
              <div className="city-drawer-actions">
                <button
                  disabled={busy}
                  onClick={() => void walkTo(cityEntranceForLocation(selected.slug), selected.slug)}
                >
                  <MapPin /> Walk outside
                </button>
                <a href={`/location/${selected.slug}`}>
                  <ChevronRight /> Enter location
                </a>
              </div>
            ) : (
              <>
                <h3>Travel there</h3>
                <div className="city-travel-options">
                  {(["danfo", "keke", "okada", "car"] as TravelMode[]).map((mode, index) => {
                    const Icon = icons[index] ?? Bus;
                    const fare = estimateTrip(
                      mode,
                      selected.travel_fare ?? 150,
                      Math.max(
                        8,
                        Math.abs(
                          position.x -
                            cityEntranceForLocation(selected.slug).x +
                            (position.y - cityEntranceForLocation(selected.slug).y),
                        ) * 4,
                      ),
                    );
                    return (
                      <button
                        key={mode}
                        disabled={busy}
                        onClick={() => void travelTo(selected, mode)}
                      >
                        <Icon />
                        <span>
                          <strong>{TRAVEL_MODE_DETAILS[mode].label}</strong>
                          <small>
                            {fare.minutes} min · est. {formatNaira(fare.fare)}
                          </small>
                        </span>
                        <ChevronRight />
                      </button>
                    );
                  })}
                </div>
                <button
                  className="city-walk-button"
                  disabled={busy}
                  onClick={() => void walkTo(cityEntranceForLocation(selected.slug), selected.slug)}
                >
                  Walk to nearby street · costs energy
                </button>
              </>
            )}
            <div className="city-local-places">
              <h3>Nearby places</h3>
              {places
                .filter((place) => place.location_id === selected.id)
                .slice(0, 3)
                .map((place) => (
                  <div key={place.id}>
                    <span>{place.name}</span>
                    <small>{place.category}</small>
                  </div>
                ))}
              {places.every((place) => place.location_id !== selected.id) && (
                <small>Local shops, services and neighbours appear here.</small>
              )}
            </div>
          </section>
        </div>
      )}
      {busy && (
        <div className="city-busy-indicator" role="status">
          Updating your journey…
        </div>
      )}
    </section>
  );
}
