import { useEffect, useMemo, useRef, useState } from "react";
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
import { CityLocationArtwork } from "@/components/game/CityLocationArtwork";
import type { GamePlace, Job, Location } from "@/lib/game";
import {
  CITY_DISTRICTS,
  CITY_LIGHT_BEACONS,
  CITY_ROAD_EDGES,
  CITY_ROUNDABOUTS,
  cityDistrictForLocation,
  cityEntranceForRecord,
  cityEntranceForLocation,
  cityIsoDiamond,
  cityPositionForRecord,
  cityWorldToIso,
  findCityRoadPath,
  stableCityOffset,
  type CityWorldPosition,
} from "@/lib/city-world";
import { TRAVEL_MODE_DETAILS, estimateTrip, type TravelMode } from "@/lib/transport-service";
import {
  layoutCityLabels,
  type CityLabelPlacement,
  type CityLabelRect,
} from "@/lib/city-label-layout";
import "./fictional-city.css";

type Point = { x: number; y: number };
const VIEW = { width: 1000, height: 760 };
const categories = ["All", "Shop", "Jobs", "Service", "Landmark"];
const icons = [ShoppingBasket, BriefcaseBusiness, CircleDollarSign, Users];
const EMPTY_LOCATIONS: Location[] = [];
const EMPTY_PLACES: GamePlace[] = [];
const EMPTY_JOBS: Job[] = [];
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
  const locations = locationsData ?? EMPTY_LOCATIONS;
  const places = placesData ?? EMPTY_PLACES;
  const { data: wallet } = useQuery({ ...q.wallet(), enabled: !!character });
  const { data: jobsData } = useQuery({ ...q.jobs(), enabled: !!character });
  const { data: npcsData } = useQuery({ ...q.npcs(), enabled: !!character });
  const jobs = jobsData ?? EMPTY_JOBS;
  const npcs = npcsData ?? [];
  const clientName = character?.name ?? "Player";
  const center = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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
  const [cityLabels, setCityLabels] = useState<CityLabelPlacement[]>([]);
  const movedPointer = useRef(false);
  const pointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const selected = locations.find((location) => location.id === selectedId) ?? null;
  const current = locations.find((location) => location.id === character?.current_location_id);
  const persistedPosition =
    character && Number.isFinite(character.world_x) && Number.isFinite(character.world_y)
      ? { x: character.world_x, y: character.world_y }
      : current
        ? cityEntranceForRecord(current)
        : cityEntranceForLocation("city-centre");
  const position = persistedPosition;
  const displayPosition = walkingPosition ?? position;
  const revision = character?.world_position_revision ?? 0;
  const sceneTransform = `translate(${offset.x} ${offset.y}) translate(500 370) scale(${scale}) translate(-500 -370)`;
  const activeLocations = useMemo(() => locations.filter((item) => item.is_active), [locations]);
  const visibleLocations = useMemo(
    () =>
      activeLocations.filter((item) => {
        if (filter === "All") return true;
        const type = `${item.type} ${item.district_type}`.toLowerCase();
        if (filter === "Shop") return /market|shop|commercial|retail/.test(type);
        if (filter === "Jobs")
          return jobs.some((job) => job.location_id === item.id && job.is_available);
        if (filter === "Service") return /service|transport|health|bank|office/.test(type);
        return /landmark|culture|university|residential|outskirt/.test(type);
      }),
    [activeLocations, filter, jobs],
  );

  useEffect(() => {
    const svg = svgRef.current;
    const scene = center.current;
    if (!svg || !scene) return;
    const obstacleRoot = scene.closest<HTMLElement>(".fictional-city") ?? scene;
    const update = () => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const inverse = matrix.inverse();
      const toSvg = (x: number, y: number) => {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        const mapped = point.matrixTransform(inverse);
        return { x: mapped.x, y: mapped.y };
      };
      const obstacles: CityLabelRect[] = [
        ...obstacleRoot.querySelectorAll<HTMLElement>("[data-city-obstacle]"),
      ].map((element) => {
        const rect = element.getBoundingClientRect();
        const topLeft = toSvg(rect.left, rect.top);
        const bottomRight = toSvg(rect.right, rect.bottom);
        return {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        };
      });
      const project = (position: CityWorldPosition) => {
        const iso = cityWorldToIso(position);
        return {
          x: (iso.x - 500) * scale + 500 + offset.x,
          y: (iso.y - 370) * scale + 370 + offset.y,
        };
      };
      for (const beacon of CITY_LIGHT_BEACONS) {
        const top = project(beacon.position);
        const bottom = project({ x: beacon.position.x, y: beacon.position.y + beacon.length });
        obstacles.push({
          x: top.x - 5,
          y: Math.min(top.y, bottom.y),
          width: 10,
          height: Math.abs(bottom.y - top.y),
        });
      }
      const labels = visibleLocations.map((location) => {
        const base = cityPositionForRecord(location);
        const jitter = stableCityOffset(location.id, 1);
        const anchor = project({ x: base.x + jitter.x * 0.18, y: base.y + jitter.y * 0.18 });
        return {
          id: location.id,
          text: location.name,
          anchor,
          priority: selectedId === location.id ? 100 : current?.id === location.id ? 50 : 0,
        };
      });
      setCityLabels(
        layoutCityLabels(labels, obstacles, { width: VIEW.width, height: VIEW.height }),
      );
    };
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(obstacleRoot);
    obstacleRoot
      .querySelectorAll<HTMLElement>("[data-city-obstacle]")
      .forEach((element) => observer.observe(element));
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(obstacleRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [visibleLocations, scale, offset.x, offset.y, selectedId, current?.id]);

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
        worldX: cityEntranceForRecord(location).x,
        worldY: cityEntranceForRecord(location).y,
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
          ref={svgRef}
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
            <pattern id="roof-rusted" width="8" height="6" patternUnits="userSpaceOnUse">
              <rect width="8" height="6" fill="#9b654c" />
              <path d="M0 1h8M0 4h8" stroke="#c38960" strokeOpacity=".72" strokeWidth=".7" />
            </pattern>
            <filter id="building-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity=".35" />
            </filter>
            <filter id="beacon-glow" x="-100%" y="-20%" width="300%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
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
            <g className="city-light-beacons" aria-hidden="true" pointerEvents="none">
              {CITY_LIGHT_BEACONS.map((beacon) => {
                const top = cityWorldToIso(beacon.position, 12);
                const bottom = cityWorldToIso({
                  x: beacon.position.x,
                  y: beacon.position.y + beacon.length,
                });
                return (
                  <g key={beacon.id}>
                    <line
                      x1={top.x}
                      y1={top.y}
                      x2={bottom.x}
                      y2={bottom.y}
                      stroke={beacon.color}
                      strokeWidth="2.2"
                      strokeOpacity=".18"
                      vectorEffect="non-scaling-stroke"
                      filter="url(#beacon-glow)"
                    />
                    <line
                      x1={top.x}
                      y1={top.y}
                      x2={bottom.x}
                      y2={bottom.y}
                      stroke={beacon.color}
                      strokeWidth=".8"
                      strokeOpacity=".72"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle cx={top.x} cy={top.y} r="2" fill={beacon.color} fillOpacity=".75" />
                  </g>
                );
              })}
            </g>
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
            {visibleLocations.map((location) => {
              const base = cityPositionForRecord(location);
              const jitter = stableCityOffset(location.id, 1);
              const building = { x: base.x + jitter.x * 0.18, y: base.y + jitter.y * 0.18 };
              const selectedNow = selectedId === location.id;
              const category = String(location.type ?? "").toLowerCase();
              return (
                <g
                  key={location.id}
                  className={`city-building ${selectedNow ? "is-selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${location.name}`}
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
                  <CityLocationArtwork
                    location={location}
                    position={building}
                    places={places.filter((place) => place.location_id === location.id)}
                  />
                  <circle
                    cx={cityWorldToIso(building).x}
                    cy={cityWorldToIso(building).y - 25}
                    r="10"
                    fill={selectedNow ? "#f1c454" : "#e6efe5"}
                    stroke="#10251f"
                    strokeWidth="2"
                  />
                  <text
                    x={cityWorldToIso(building).x}
                    y={cityWorldToIso(building).y - 21}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#17382c"
                  >
                    {category.includes("market") || category.includes("shop") ? "₦" : "⌂"}
                  </text>
                </g>
              );
            })}{" "}
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
        <svg
          className="city-label-layer"
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          aria-hidden="true"
        >
          {cityLabels.map((label) => {
            const left = label.center.x - label.width / 2;
            const top = label.center.y - label.height / 2;
            const shifted =
              Math.abs(label.center.x - label.anchor.x) > 14 ||
              Math.abs(label.center.y - label.anchor.y) > 28;
            const active = label.id === selectedId || label.id === current?.id;
            return (
              <g key={label.id} className={`city-map-label ${active ? "is-active" : ""}`}>
                {shifted && (
                  <path
                    className="city-map-label-leader"
                    d={`M${label.anchor.x} ${label.anchor.y} L${label.center.x} ${label.center.y}`}
                  />
                )}
                <rect
                  className="city-map-label-bg"
                  x={left}
                  y={top}
                  width={label.width}
                  height={label.height}
                  rx="8"
                />
                {label.lines.map((line, index) => (
                  <text
                    key={`${label.id}-${index}`}
                    className="city-map-label-text"
                    x={label.center.x}
                    y={top + 14 + index * 12}
                    textAnchor="middle"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
        <div className="city-map-tools" data-city-obstacle aria-label="Map controls">
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
        <aside className="city-status-card" data-city-obstacle>
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
        <aside className="city-quest-card" data-city-obstacle>
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
        <div className="city-world-title" data-city-obstacle>
          <span>
            <i /> SIMULATION LIVE
          </span>
          <strong>Osogbo, Osun State</strong>
          <small>Street life • markets • work • community</small>
        </div>
        <div
          className="city-filter-bar"
          data-city-obstacle
          role="tablist"
          aria-label="Filter map locations"
        >
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
          <div className="city-toast" data-city-obstacle role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="city-touch-hint" data-city-obstacle>
          Drag to explore · pinch or scroll to zoom
        </div>
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
            data-city-obstacle
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
                  onClick={() => void walkTo(cityEntranceForRecord(selected), selected.slug)}
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
                            cityEntranceForRecord(selected).x +
                            (position.y - cityEntranceForRecord(selected).y),
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
                  onClick={() => void walkTo(cityEntranceForRecord(selected), selected.slug)}
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
