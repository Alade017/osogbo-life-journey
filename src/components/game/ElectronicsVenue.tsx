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
import { ElectronicsEnvironment, ElectronicsExterior } from "@/components/3d/ElectronicsEnvironment";
import { electronicsDisplays, electronicsNavigation, electronicsExteriorRoute, electronicsExteriorCanWalk, RETAIL_EXTERIOR, RETAIL_ROOM, type ElectronicsStoreId } from "@/game/electronics-navigation";
import { getShowroomModels } from "@/data/showroom-models";
import type { WalkPoint } from "@/game/grid-walk-path";
import { VenueSceneBoundary } from "./VenueSceneBoundary";

const toRoom = ([x,z]: WalkPoint): [number,number,number] => [x,0.06,z];

export default function ElectronicsVenue({ slug, onExit }: { slug: ElectronicsStoreId; onExit?: () => void }) {
  const { data: character } = useQuery(q.character());
  const { data: equipment } = useQuery(q.equipment());
  const renderQuality = useRenderQuality();
  const quality = WORLD_RENDER_QUALITY[renderQuality];
  const loadRadius = SHOWROOM_LOAD_RADIUS[renderQuality];
  const outfit = useMemo(() => normalizeEquippedItems(equipment), [equipment]);
  const raw = character?.appearance;
  const appearance = useMemo(() => raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Appearance : parseSavedAppearance(raw), [raw]);
  const products = useMemo(() => getShowroomModels(slug), [slug]);
  const displays = useMemo(() => electronicsDisplays(products.length), [products]);
  const navigation = useMemo(() => electronicsNavigation(displays), [displays]);
  const [inside, setInside] = useState(slug === "harvest-tech-hub");
  const walker = useHouseMovement(slug, toRoom(slug === "harvest-tech-hub" ? RETAIL_ROOM.spawn : RETAIL_EXTERIOR.spawn));
  const { attempts, retryAsset, assets, station, setStation, inspection, setInspection, assetReady, assetError, assetUnmounted } = useProductInspection();
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState(slug === "harvest-tech-hub" ? "Tap the floor to walk or approach a product." : "Walk to the store entrance.");
  const request = useRef(0);
  const exiting = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const { cancel } = walker;
  useEffect(() => () => { request.current++; cancel(); }, [cancel]);
  const onError = useCallback(() => { request.current++; cancel(); exiting.current = false; setLeaving(false); setFailed(true); setStation(null); setInspection(false); setMessage("The 3D environment is unavailable."); }, [cancel, setStation, setInspection]);
  function current(): WalkPoint { const [x,,z] = walker.positionRef.current; return [x,z]; }
  function walk(path: WalkPoint[] | null, after?: () => void) {
    if (exiting.current) return;
    const ticket = ++request.current;
    cancel(); setStation(null); setInspection(false);
    if (!character || failed || !path) { setMessage(failed ? "The 3D environment is unavailable." : !character ? "Your character is not ready." : "Choose a clear walking route."); return; }
    setMessage("Walking…");
    void walker.walk(path.map(toRoom)).then(arrived => {
      if (ticket !== request.current) return;
      setMessage(arrived ? "Arrived." : "Walk stopped.");
      if (arrived) after?.();
    });
  }
  async function crossDoor(entering: boolean) {
    if (exiting.current || failed || !character || entering === inside) return;
    const ticket = ++request.current;
    exiting.current = true;
    setLeaving(true);
    cancel();
    setStation(null);
    setInspection(false);
    setMessage(entering ? "Entering store…" : "Leaving store…");
    let settledInside = inside;
    try {
      const path = entering ? electronicsExteriorRoute(current(), RETAIL_EXTERIOR.door) : navigation.route(current(), RETAIL_ROOM.doorway);
      if (!path || !(await walker.walk(path.map(toRoom))) || ticket !== request.current) return;
      if (!(await walker.walk([toRoom(RETAIL_EXTERIOR.threshold)])) || ticket !== request.current) return;
      settledInside = entering;
      setInside(entering);
      if (!(await walker.walk([toRoom(entering ? RETAIL_ROOM.spawn : RETAIL_EXTERIOR.door)])) || ticket !== request.current) return;
      setMessage(entering ? "Tap the floor to walk or approach a product." : "You are outside the store.");
    } finally {
      if (ticket === request.current) {
        if (!(settledInside ? navigation.canWalk(current()) : electronicsExteriorCanWalk(current()))) {
          walker.place(toRoom(settledInside ? RETAIL_ROOM.spawn : RETAIL_EXTERIOR.door));
        }
        exiting.current = false;
        setLeaving(false);
        setMessage(previous => previous === "Entering store…" || previous === "Leaving store…" ? "Walk stopped." : previous);
      }
    }
  }
  function exit() {
    if (failed && onExit) { onExit(); return; }
    if (slug === "post-office-cafe") { void crossDoor(false); return; }
    if (exiting.current || failed || !character) return;
    const path = navigation.route(current(), RETAIL_ROOM.doorway);
    if (!path) { setMessage("Choose a clear walking route."); return; }
    const ticket = ++request.current;
    exiting.current = true;
    setLeaving(true);
    cancel();
    setStation(null);
    setInspection(false);
    setMessage("Walking to the entrance…");
    void walker.walk(path.map(toRoom)).then(arrived => {
      if (ticket !== request.current) return;
      exiting.current = false;
      setLeaving(false);
      if (!arrived) { setMessage("Walk stopped."); return; }
      if (onExit) onExit();
      else setMessage("You are at the store entrance.");
    });
  }
  function select(index: number) {
    if (!products[index]) return;
    walk(navigation.approach(current(), index), () => { setStation(index); setMessage("Product display reached."); });
  }
  const product = station === null ? undefined : products[station];
  const display = station === null ? undefined : displays[station];
  const canInspect = !!product && assets[product.id] === "ready";
  const inspecting = inspection && canInspect;
  const name = slug === "harvest-tech-hub" ? "Harvest Tech Store" : "Electronics World";
  return <section className="destination-venue-root" aria-label={name}>
    <header><h2>{name}</h2></header>
    <div data-venue-viewport>
      <VenueSceneBoundary onError={onError} fallback={<p role="alert">The 3D environment could not load.</p>}>
        <WorldCanvas frameloop="demand" dpr={[1,quality.maxDpr]} gl={{antialias:false,powerPreference:"low-power"}} onSceneError={onError} fallback={<p>WebGL is unavailable.</p>}>
          <WorldCamera width={inspecting && display ? Math.max(display.depth, 1.25) + 0.8 : 10} depth={inspecting && display ? Math.max(display.depth, 1.25) + 0.8 : 10} stage horizontalOrbit={inspecting} verticalOrbit={inspecting} maxZoom={3} zoom={inspecting ? 1.6 : 1.3} target={inspecting && display ? [display.x,1.3,display.z] : [walker.position[0],1.2,walker.position[2]]} />
          <WorldLighting size={18} contactShadows={false} />
          {inside ? <ElectronicsEnvironment viewer={[walker.position[0], walker.position[2]]} loadRadius={loadRadius} displays={displays} products={products} selected={station} computerStore={slug==="harvest-tech-hub"} onWalk={point => {
            if (Math.abs(point[0]) <= RETAIL_ROOM.entranceWidth/2 && point[1] >= RETAIL_ROOM.doorway[1]) exit();
            else walk(navigation.route(current(),point));
          }} onExit={exit} onSelect={select} onAssetReady={assetReady} onAssetError={assetError} onAssetUnmounted={assetUnmounted} attempts={attempts} /> : <ElectronicsExterior onEnter={() => void crossDoor(true)} onWalk={point => walk(electronicsExteriorRoute(current(), point))} />}
          {character && <group position={walker.position}><WorldCharacter position={[0,0,0]} facing={walker.facing} animation={walker.walking?"walk":"idle"} name={character.name} gender={character.gender} appearance={appearance} equipment={outfit}/></group>}
        </WorldCanvas>
      </VenueSceneBoundary>
    </div>
    <div data-venue-controls>
      <p role="status">{message}</p>
      <button type="button" disabled={leaving || ((!character || failed) && !(failed && onExit))} onClick={inside ? exit : () => void crossDoor(true)} className="rounded-full border border-edge px-3 py-1.5 text-sm">{onExit ? (failed ? "Return to workplace" : "Walk back to workplace") : inside ? "Walk to exit" : "Walk to entrance"}</button>
      {product && !walker.walking && !failed && <div className="flex flex-wrap items-center gap-2">
        <span className="capitalize text-sm font-medium">{product.label}</span>
        {canInspect ? <button type="button" aria-pressed={inspecting} onClick={()=>setInspection(v=>!v)} className="rounded-full border border-edge px-3 py-1.5 text-sm">{inspecting?"Return to character":"Inspect product"}</button> : <div className="flex items-center gap-2"><span role="status" className="text-xs">{product && assets[product.id] === "failed" ? "Model unavailable." : "Loading model…"}</span>{product && assets[product.id] === "failed" && <button type="button" className="rounded-full border border-edge px-3 py-1.5 text-sm" onClick={() => { clearFailedShowroomAsset(product.url); retryAsset(product.id); }}>Retry model</button>}</div>}
      </div>}
    </div>
  </section>;
}
