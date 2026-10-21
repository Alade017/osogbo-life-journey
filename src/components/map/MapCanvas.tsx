import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import townData from "@/data/osogbo-town.json";
import { DRACO_PATH } from "@/types/models";
import "./map-canvas.css";

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
  return (
    <group>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[32, 0.3, 24]} />
        <meshStandardMaterial color="#8bbf76" roughness={1} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.2, 24]} />
        <meshStandardMaterial color="#d2b78f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[5.2, 32]} />
        <meshStandardMaterial color="#d2b78f" roughness={1} />
      </mesh>
    </group>
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
      <color attach="background" args={["#dce7dc"]} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[8, 13, 7]} intensity={1.6} />
      <Terrain />
      <TownBase />
      <PlaceMarkers
        places={places}
        onSelectLandmark={onSelectLandmark}
        onSelectDistrict={onSelectDistrict}
      />
      {properties?.map((property) => (
        <House key={property.id} property={property} />
      ))}
      {properties === undefined ? <MapLoading /> : null}
      <OrbitControls
        makeDefault
        enableDamping={false}
        minDistance={10}
        maxDistance={28}
        minPolarAngle={Math.PI / 4.4}
        maxPolarAngle={Math.PI / 2.15}
        minAzimuthAngle={-Math.PI / 3}
        maxAzimuthAngle={Math.PI / 3}
        target={[0, 0, 0]}
        enablePan
        panSpeed={0.65}
        zoomSpeed={0.65}
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
        camera={{ position: [15, 15, 17], fov: 42, near: 0.1, far: 100 }}
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
