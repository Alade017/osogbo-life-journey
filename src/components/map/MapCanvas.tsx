import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import townData from "@/data/osogbo-town.json";
import { DRACO_PATH } from "@/types/models";
import { TownScenery } from "@/components/map/TownScenery";
import "./map-canvas.css";
import * as THREE from "three";

const GRID = townData.grid as { rows: string[]; cellSize?: number };
const CELL = GRID.cellSize ?? 2;
const TOWN_HALF_X = (GRID.rows[0]!.length * CELL) / 2 + 2;
const TOWN_HALF_Z = (GRID.rows.length * CELL) / 2 + 2;
const WORLD_SIZE = 1400; // the ground is so large that the fog hides its edge
const SKY = "#cfe6d4";

function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Level inside the town so roads and buildings sit flat; rolling hills outside. */
export function groundHeight(x: number, z: number) {
  const dx = Math.max(0, Math.abs(x) - TOWN_HALF_X);
  const dz = Math.max(0, Math.abs(z) - TOWN_HALF_Z);
  const blend = Math.min(1, Math.hypot(dx, dz) / 10);
  const hills = valueNoise(x * 0.035, z * 0.035) * 6 + valueNoise(x * 0.09, z * 0.09) * 1.5;
  return (hills - 2) * blend;
}

export type MapFilter =
  | "market"
  | "transport"
  | "school"
  | "health"
  | "worship"
  | "junction"
  | "sport"
  | "food"
  | "services"
  | "jobs"
  | "all";
export type MapSearchTarget = string | { id: string; kind?: "district" | "landmark" };
export type MapPlayerLocation = {
  x: number;
  y: number;
  label?: string;
  activity?: string;
  markerType?: "player" | "stall" | "job";
};
export type MapEventChip = { id: string; label: string; x: number; y: number };
export type MapBillboardMarker = {
  campaignId: string;
  landmarkId: string;
  advertiserName: string;
  title?: string;
  imageUrl?: string | null;
  count: number;
};

/** Display-only property input. Ownership, rent, and status remain server/game-state owned. */
export type MapProperty = {
  id: string;
  label?: string;
  type: "compound" | "flat" | "shophouse";
  tier: 1 | 2 | 3;
  status: "owned" | "current" | "rent_due" | "overdue" | "vacant";
  position: [number, number, number];
  rotation?: number;
  ownerName?: string;
};

export interface MapCanvasProps {
  onSelectDistrict: (id: string) => void;
  onSelectLandmark: (id: string) => void;
  activeFilter?: MapFilter;
  searchTarget?: MapSearchTarget | null;
  playerLocation?: MapPlayerLocation | null;
  eventChips?: MapEventChip[];
  jobLandmarkIds?: string[];
  billboardMarkers?: MapBillboardMarker[];
  onSelectBillboard?: (campaignId: string) => void;
  /** Pass undefined while the existing property source is loading. */
  properties?: readonly MapProperty[] | undefined;
}

const HOUSE_MODELS: Record<MapProperty["type"], string> = {
  compound: "/models/compound.glb",
  flat: "/models/flat.glb",
  shophouse: "/models/shophouse.glb",
};

const propertyStatusText: Record<MapProperty["status"], string> = {
  owned: "Owned",
  current: "Your home",
  rent_due: "Rent due",
  overdue: "Rent overdue",
  vacant: "Vacant",
};

const filterCategories: Partial<Record<MapFilter, readonly string[]>> = {
  jobs: ["services", "food", "market", "transport"],
};

type AssetBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: string;
};

/** Keeps an unavailable optional GLB local to its own map object. */
class AssetBoundary extends Component<AssetBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidUpdate(previousProps: AssetBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 260, 260);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes["position"]!;
      for (let i = 0; i < pos.count; i++) {
      pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#8bbf76" roughness={1} />
    </mesh>
  );
}

/** Trees scattered past the town edge so the world keeps going. */
function OuterForest() {
  const trees = useMemo(() => {
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = 0; out.length < 240 && i < 3000; i++) {
      const x = (hash2(i, 1) - 0.5) * WORLD_SIZE * 0.9;
      const z = (hash2(i, 2) - 0.5) * WORLD_SIZE * 0.9;
      if (Math.abs(x) < TOWN_HALF_X + 4 && Math.abs(z) < TOWN_HALF_Z + 4) continue;
      out.push({ x, z, s: 0.8 + hash2(i, 3) * 0.8 });
    }
    return out;
  }, []);
  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, groundHeight(t.x, t.z), t.z]} scale={t.s}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 1.2, 6]} />
            <meshStandardMaterial color="#7a5a3a" />
          </mesh>
          <mesh position={[0, 1.8, 0]}>
            <coneGeometry args={[0.8, 2, 7]} />
            <meshStandardMaterial color="#3f7d45" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function GltfObject({ path, tier }: { path: string; tier: MapProperty["tier"] | undefined }) {
  const { scene } = useGLTF(path, DRACO_PATH, true);
  const object = useMemo(() => {
    const instance = clone(scene);
    instance.traverse((child) => {
      const accessory = /^Accessory_Tier(\d+)_/.exec(child.name);
      if (accessory && tier !== undefined) child.visible = Number(accessory[1]) <= tier;
      if ("isMesh" in child && child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    return instance;
  }, [scene, tier]);

  // The clone shares cached GLTF geometry/materials, so R3F must not dispose them per house.
  return <primitive object={object} dispose={null} />;
}

/** Avoids requesting an absent optional export through GLTFLoader. */
function OptionalGltf({
  path,
  fallback,
  loadingFallback = fallback,
  tier,
}: {
  path: string;
  fallback: ReactNode;
  loadingFallback?: ReactNode;
  tier?: MapProperty["tier"];
}) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let current = true;
    void fetch(path, { method: "HEAD" })
      .then((response) => {
        if (current) setAvailable(response.ok);
      })
      .catch(() => {
        if (current) setAvailable(false);
      });
    return () => {
      current = false;
    };
  }, [path]);

  if (!available) return fallback;
  return (
    <AssetBoundary resetKey={path} fallback={fallback}>
      <Suspense fallback={loadingFallback}>
        <GltfObject path={path} tier={tier} />
      </Suspense>
    </AssetBoundary>
  );
}
// switch to true once public/models/town.glb is exported from Blender.
const TOWN_BASE_MODEL_ENABLED=true;
function TownBase() {
  if(!TOWN_BASE_MODEL_ENABLED) return null;
  return <OptionalGltf path="/models/town.glb" fallback={null} loadingFallback={<MapLoading/>} />;
}

function HousePlaceholder({ property }: { property: MapProperty }) {
  return (
    <group position={property.position} rotation-y={property.rotation ?? 0}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.4, 1.1, 1.2]} />
        <meshStandardMaterial color="#b8784f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.22, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[1.15, 0.65, 4]} />
        <meshStandardMaterial color="#6b4738" roughness={1} />
      </mesh>
    </group>
  );
}

export function houseBadgeText(property: MapProperty) {
  if (property.status === "owned" && property.ownerName) return property.ownerName;
  return propertyStatusText[property.status];
}

function House({ property }: { property: MapProperty }) {
  const modelPath = HOUSE_MODELS[property.type];
  const placeholder = (
    <HousePlaceholder property={{ ...property, position: [0, 0, 0], rotation: 0 }} />
  );
  return (
    <group position={property.position} rotation-y={property.rotation ?? 0}>
      <OptionalGltf path={modelPath} tier={property.tier} fallback={placeholder} />
      <Html position={[0, 2.25, 0]} center distanceFactor={10} zIndexRange={[4, 0]}>
        <span className={`town-house-badge is-${property.status}`}>{houseBadgeText(property)}</span>
      </Html>
    </group>
  );
}

function MapLoading() {
  const { active, progress } = useProgress();
  return (
    <Html center zIndexRange={[6, 0]}>
      <p className="town-map-loading" aria-live="polite">
        {active ? `Loading town ${Math.round(progress)}%` : "Loading town"}
      </p>
    </Html>
  );
}

function scenePoint(x: number, z: number): [number, number, number] {
  return [(x - 6.5) * 2, 0, (z - 4.5) * 2];
}

function PlaceMarkers({
  places,
  onSelectLandmark,
  onSelectDistrict,
}: {
  places: readonly (typeof townData.landmarks)[number][];
  onSelectLandmark: (id: string) => void;
  onSelectDistrict: (id: string) => void;
}) {
  return (
    <group>
      {townData.districts.map((district) => {
        const area = district.gridArea;
        const [x, , z] = scenePoint(area.x + (area.width - 1) / 2, area.z + (area.depth - 1) / 2);
        return (
          <Html
            key={district.id}
            position={[x, 0.45, z]}
            center
            distanceFactor={15}
            zIndexRange={[2, 0]}
          >
            <button
              className="town-district-marker"
              type="button"
              onClick={() => onSelectDistrict(district.id)}
            >
              {district.name}
            </button>
          </Html>
        );
      })}
      {places.map((place) => {
        const [x, , z] = scenePoint(place.grid.x, place.grid.z);
        return (
          <Html
            key={place.id}
            position={[x, 2.15, z]}
            center
            distanceFactor={12}
            zIndexRange={[5, 0]}
          >
            <button
              className="town-place-marker"
              type="button"
              aria-label={`Open ${place.label}`}
              onClick={() => onSelectLandmark(place.id)}
            >
              <span>{place.label}</span>
              <small>{place.actions.length} actions</small>
            </button>
          </Html>
        );
      })}
    </group>
  );
}

function TownScene({
  properties,
  places,
  onSelectLandmark,
  onSelectDistrict,
}: {
  properties: readonly MapProperty[] | undefined;
  places: readonly (typeof townData.landmarks)[number][];
  onSelectLandmark: (id: string) => void;
  onSelectDistrict: (id: string) => void;
}) {
  return (
    <>
  <color attach="background" args={[SKY]} />
  <fog attach="fog" args={[SKY, 45, 170]} />
  <hemisphereLight args={["#ffffff", "#7a9d6a", 1.0]} />
  <directionalLight position={[20, 30, 14]} intensity={1.8} castShadow />
  <Terrain />
  <OuterForest />
  <TownBase />
  <TownScenery />
  {/* ...PlaceMarkers, House list, MapLoading stay exactly as they are... */}
  <OrbitControls
    makeDefault
    enableDamping
    dampingFactor={0.08}
    minDistance={5}
    maxDistance={90}
    minPolarAngle={0.2}
    maxPolarAngle={Math.PI / 2.02}
    enablePan
    screenSpacePanning={false}
    panSpeed={0.8}
    zoomSpeed={0.8}
    target={[0, 0, 0]}
  />
</>
  );
}

export function MapCanvas({
  onSelectDistrict,
  onSelectLandmark,
  activeFilter = "all",
  searchTarget,
  playerLocation: _playerLocation,
  eventChips: _eventChips,
  jobLandmarkIds = [],
  billboardMarkers = [],
  onSelectBillboard,
  properties,
}: MapCanvasProps) {
  useEffect(() => {
    if (!searchTarget) return;
    const id = typeof searchTarget === "string" ? searchTarget : searchTarget.id;
    if (townData.landmarks.some((landmark) => landmark.id === id)) {
      onSelectLandmark(id);
      return;
    }
    if (townData.districts.some((district) => district.id === id)) onSelectDistrict(id);
  }, [onSelectDistrict, onSelectLandmark, searchTarget]);

  const availablePlaces = useMemo(
    () =>
      townData.landmarks.filter(
        (place) =>
          activeFilter === "all" ||
          (activeFilter === "jobs"
            ? jobLandmarkIds.includes(place.id)
            : (filterCategories[activeFilter] ?? [activeFilter]).includes(place.category)),
      ),
    [activeFilter, jobLandmarkIds],
  );

  return (
    <section className="map-canvas town-map-canvas" aria-label="Interactive isometric town map">
      <Canvas
        dpr={[1, 2]}
        shadows={false}
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        camera={{ position: [22, 24, 26], fov: 45, near: 0.1, far: 400 }}
        fallback={
          <p className="town-map-webgl-error" role="alert">
            3D requires WebGL. Your browser could not start it.
          </p>
        }
      >
        <TownScene
          properties={properties}
          places={availablePlaces}
          onSelectLandmark={onSelectLandmark}
          onSelectDistrict={onSelectDistrict}
        />
      </Canvas>
      <ul className="town-map-accessible-list" aria-label="Places on the map">
        {properties?.map((property) => (
          <li key={property.id}>
            {property.label ?? "House"}, {houseBadgeText(property)}
          </li>
        ))}
        {availablePlaces.map((place) => (
          <li key={place.id}>
            <button type="button" onClick={() => onSelectLandmark(place.id)}>
              {place.label}, {place.category}
            </button>
          </li>
        ))}
        {billboardMarkers.map((billboard) => (
          <li key={billboard.campaignId}>
            <button type="button" onClick={() => onSelectBillboard?.(billboard.campaignId)}>
              Billboard for {billboard.advertiserName}
            </button>
          </li>
        ))}
      </ul>
      <ul className="town-map-accessible-list" aria-label="Districts on the map">
        {townData.districts.map((district) => (
          <li key={district.id}>
            <button type="button" onClick={() => onSelectDistrict(district.id)}>
              {district.name} district
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
