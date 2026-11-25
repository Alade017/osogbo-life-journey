import { useProductInspection } from "@/hooks/use-product-inspection";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { parseSavedAppearance } from "@/game/character-animation";
import type { Appearance } from "@/game/avatar-appearance";
import { useHouseMovement } from "@/hooks/use-house-movement";
import { useRenderQuality } from "@/hooks/use-render-quality";
import { WORLD_RENDER_QUALITY } from "@/components/3d/render-quality";
import { SHOWROOM_LOAD_RADIUS, clearFailedShowroomAsset } from "@/components/3d/ShowroomAsset";
import { WorldCanvas } from "@/components/3d/WorldCanvas";
import { WorldCamera, WorldLighting } from "@/components/3d/WorldScene";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { DealershipExterior, DealershipInterior } from "@/components/3d/DealershipEnvironment";
import { createShowroomLayout, showroomNavigation, showroomExteriorRoute } from "@/game/showroom-navigation";
import type { WalkPoint } from "@/game/grid-walk-path";
import { getShowroomModels } from "@/data/showroom-models";
import { showroomDestinations } from "@/data/showroom-destinations";
import { VenueSceneBoundary } from "./VenueSceneBoundary";

type DealershipId = "fuel-station" | "cinema-event-hall";
const height = 0.06;
const toRoom = ([x, z]: WalkPoint): [number, number, number] => [x, height, z];

export default function DealershipVenue({ slug }: { slug: DealershipId }) {
  const { data: character } = useQuery(q.character());
  const { data: equipment } = useQuery(q.equipment());
  const renderQuality = useRenderQuality();
  const quality = WORLD_RENDER_QUALITY[renderQuality];
  const loadRadius = SHOWROOM_LOAD_RADIUS[renderQuality];
  const outfit = useMemo(() => normalizeEquippedItems(equipment), [equipment]);
  const raw = character?.appearance;
  const appearance = useMemo(() => raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Appearance : parseSavedAppearance(raw), [raw]);
  const models = useMemo(() => getShowroomModels(slug), [slug]);
  const layout = useMemo(() => createShowroomLayout(models.length), [models.length]);
  const navigation = useMemo(() => showroomNavigation(layout), [layout]);
  const walker = useHouseMovement(slug, toRoom(layout.exteriorSpawn));
  const [inside, setInside] = useState(false);
  const crossing = useRef(false);
  const [transitioning, setTransitioning] = useState(false);
  const [message, setMessage] = useState("Walk to the entrance to enter.");
  const { attempts, retryAsset, assets, station, setStation, inspection, setInspection, assetReady, assetError, assetUnmounted } = useProductInspection();
  const product = station === null ? undefined : models[station];
  const canInspect = !!product && assets[product.id] === "ready";
  const inspecting = inspection && canInspect;
  const [sceneFailed, setSceneFailed] = useState(false);
  const style = slug === "cinema-event-hall" ? "exotic" : "standard";
  const request = useRef(0);
  const { cancel } = walker;
  useEffect(() => () => { request.current++; cancel(); }, [cancel]);
  const onError = useCallback(() => {
    request.current++;
    cancel();
    crossing.current = false;
    setTransitioning(false);
    setSceneFailed(true);
    setStation(null);
    setInspection(false);
    setMessage("The 3D environment is unavailable.");
  }, [cancel, setStation, setInspection]);

  function walk(path: WalkPoint[] | null, after?: () => void) {
    const ticket = ++request.current;
    walker.cancel();
    setStation(null);
    setInspection(false);
    if (!character || !path || sceneFailed) {
      setMessage(sceneFailed ? "The 3D environment is unavailable." : character ? "Choose a clear walking route." : "Your character is not ready.");
      return;
    }
    setMessage("Walking…");
    void walker.walk(path.map(toRoom)).then((arrived) => {
      if (ticket !== request.current) return;
      setMessage(arrived ? "Arrived." : "Walk stopped.");
      if (arrived) after?.();
    });
  }
  function current(): WalkPoint {
    const [x, , z] = walker.positionRef.current;
    return [x, z];
  }
  async function crossDoor(entering: boolean) {
    if (crossing.current || !character || sceneFailed || entering === inside) return;
    const ticket = ++request.current;
    crossing.current = true;
    setTransitioning(true);
    cancel();
    setStation(null);
    setInspection(false);
    setMessage(entering ? "Entering showroom…" : "Leaving showroom…");
    let crossed = false;
    try {
      const path = entering
        ? showroomExteriorRoute(current(), layout.exteriorDoor, layout)
        : navigation.route(current(), layout.entrance);
      if (!path || !await walker.walk(path.map(toRoom)) || ticket !== request.current) return;
      if (!await walker.walk([toRoom(layout.threshold)]) || ticket !== request.current) return;
      crossed = true;
      setInside(entering);
      const destination = entering ? layout.entrance : layout.exteriorDoor;
      if (!await walker.walk([toRoom(destination)]) || ticket !== request.current) {
        if (ticket === request.current) walker.place(toRoom(destination));
        return;
      }
      setMessage(entering ? "Tap the floor to walk or approach a vehicle." : "You are outside the dealership.");
    } finally {
      if (ticket === request.current) {
        // A cancelled crossing must not strand the avatar on the non-walkable threshold.
        const position = current();
        const settledInside = crossed ? entering : inside;
        const valid = settledInside ? navigation.canWalk(position) : !!showroomExteriorRoute(position, layout.exteriorDoor, layout);
        if (!valid) walker.place(toRoom(settledInside ? layout.entrance : layout.exteriorDoor));
        crossing.current = false;
        setTransitioning(false);
        setMessage(previous => previous === "Entering showroom…" || previous === "Leaving showroom…" ? "Walk stopped." : previous);
      }
    }
  }
  function enter() { void crossDoor(true); }
  function exit() { void crossDoor(false); }
  function go(point: WalkPoint) {
    if (crossing.current) return;
    if (!inside && Math.abs(point[0]) <= layout.entranceWidth / 2 && point[1] <= layout.exteriorDoor[1] + 0.35) {
      enter();
    } else if (inside && Math.abs(point[0]) <= layout.entranceWidth / 2 && point[1] >= layout.entrance[1]) {
      exit();
    } else {
      walk(inside ? navigation.route(current(), point) : showroomExteriorRoute(current(), point, layout));
    }
  }
  function approach(index: number) {
    const model = models[index];
    if (crossing.current || !inside || !model) return;
    walk(navigation.approach(current(), index), () => {
      setStation(index);
      setMessage("Vehicle display reached.");
    });
  }

  return (
    <section className="destination-venue-root" aria-label={showroomDestinations[slug].name}>
      <header><h2>{showroomDestinations[slug].name}</h2></header>
      <div data-venue-viewport>
        <VenueSceneBoundary onError={onError} fallback={<p role="alert">The 3D environment could not load.</p>}>
          <WorldCanvas frameloop="demand" dpr={[1, quality.maxDpr]}
            gl={{ antialias: false, powerPreference: "low-power" }}
            onSceneError={onError} fallback={<p>WebGL is unavailable.</p>}>
            <WorldCamera width={inspecting ? layout.displayWidth + 1 : 12} depth={inspecting ? layout.displayDepth + 1 : 12} stage horizontalOrbit={inspecting} verticalOrbit={inspecting} maxZoom={3} target={inspecting && station !== null ? [layout.bays[station]!.x, 0.9, layout.bays[station]!.z] : [walker.position[0], 1.2, walker.position[2]]} zoom={inspecting ? 1.65 : 1.5} />
            <WorldLighting size={Math.max(layout.width, layout.depth) / 2 + 8} contactShadows={false} />
            {inside ? <DealershipInterior loadRadius={loadRadius} layout={layout} viewer={[walker.position[0], walker.position[2]]} style={style} activeBay={station} models={models} onWalk={go} onSelect={approach} onExit={exit} onAssetReady={assetReady} onAssetError={assetError} onAssetUnmounted={assetUnmounted} attempts={attempts} />
              : <DealershipExterior layout={layout} style={style} onEnter={enter} onWalk={go} />}
            {character && <group position={walker.position}>
              <WorldCharacter position={[0, 0, 0]} facing={walker.facing} animation={walker.walking ? "walk" : "idle"}
                name={character.name} gender={character.gender} appearance={appearance} equipment={outfit} />
            </group>}
          </WorldCanvas>
        </VenueSceneBoundary>
      </div>
      <div data-venue-controls>
        <p role="status">{message}</p>
        <button type="button" disabled={!character || sceneFailed || transitioning} onClick={inside ? exit : enter}
          className="rounded-full border border-edge px-3 py-1.5 text-sm">{inside ? "Walk to exit" : "Walk to entrance"}</button>
        {inside && station !== null && !walker.walking && !sceneFailed && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Vehicle interactions">
            <span className="text-sm font-medium capitalize">{models[station]?.label}</span>
            {canInspect ? <button type="button" aria-pressed={inspecting} onClick={() => setInspection((value) => !value)}
              className="rounded-full border border-edge px-3 py-1.5 text-sm">
              {inspecting ? "Return to character" : "Inspect vehicle"}
            </button> : <div className="flex items-center gap-2"><span role="status" className="text-xs">{product && assets[product.id] === "failed" ? "Model unavailable." : "Loading model…"}</span>{product && assets[product.id] === "failed" && <button type="button" className="rounded-full border border-edge px-3 py-1.5 text-sm" onClick={() => { clearFailedShowroomAsset(product.url); retryAsset(product.id); }}>Retry model</button>}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
