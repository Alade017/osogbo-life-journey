import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { parseSavedAppearance } from "@/game/character-animation";
import type { Appearance } from "@/game/avatar-appearance";
import { useHouseMovement } from "@/hooks/use-house-movement";
import { useRenderQuality } from "@/hooks/use-render-quality";
import { WORLD_RENDER_QUALITY } from "@/components/3d/render-quality";
import { WorldCanvas } from "@/components/3d/WorldCanvas";
import { WorldCamera, WorldLighting } from "@/components/3d/WorldScene";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { ElectronicsEnvironment } from "@/components/3d/ElectronicsEnvironment";
import { electronicsDisplays, electronicsNavigation, RETAIL_ROOM, type ElectronicsStoreId } from "@/game/electronics-navigation";
import { getShowroomModels } from "@/data/showroom-models";
import type { WalkPoint } from "@/game/grid-walk-path";
import { VenueSceneBoundary } from "./VenueSceneBoundary";

const toRoom = ([x,z]: WalkPoint): [number,number,number] => [x,0.06,z];

export default function ElectronicsVenue({ slug, onExit }: { slug: ElectronicsStoreId; onExit?: () => void }) {
  const { data: character } = useQuery(q.character());
  const { data: equipment } = useQuery(q.equipment());
  const quality = WORLD_RENDER_QUALITY[useRenderQuality()];
  const outfit = useMemo(() => normalizeEquippedItems(equipment), [equipment]);
  const raw = character?.appearance;
  const appearance = useMemo(() => raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Appearance : parseSavedAppearance(raw), [raw]);
  const products = useMemo(() => getShowroomModels(slug), [slug]);
  const displays = useMemo(() => electronicsDisplays(products.length), [products]);
  const navigation = useMemo(() => electronicsNavigation(displays), [displays]);
  const walker = useHouseMovement(slug, toRoom(RETAIL_ROOM.spawn));
  const [station, setStation] = useState<number | null>(null);
  const [inspection, setInspection] = useState(false);
  const [failed, setFailed] = useState(false);
  const [assets, setAssets] = useState<Record<string,"ready"|"failed">>({});
  const [message, setMessage] = useState("Tap the floor to walk or approach a product.");
  const request = useRef(0);
  const { cancel } = walker;
  useEffect(() => () => { request.current++; cancel(); }, [cancel]);
  const onError = useCallback(() => { request.current++; cancel(); setFailed(true); setStation(null); setInspection(false); setMessage("The 3D environment is unavailable."); }, [cancel]);
  const assetReady = useCallback((id: string) => setAssets(old => old[id] === "ready" ? old : {...old,[id]:"ready"}), []);
  const assetError = useCallback((id: string) => setAssets(old => old[id] === "failed" ? old : {...old,[id]:"failed"}), []);
  function current(): WalkPoint { const [x,,z] = walker.positionRef.current; return [x,z]; }
  function walk(path: WalkPoint[] | null, after?: () => void) {
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
  function exit() {
    walk(navigation.route(current(),RETAIL_ROOM.doorway), () => {
      if(onExit) onExit(); else setMessage("You are at the store entrance.");
    });
  }
  function select(index: number) {
    if (!products[index]) return;
    walk(navigation.approach(current(), index), () => { setStation(index); setMessage("Product display reached."); });
  }
  const product = station === null ? undefined : products[station];
  const display = station === null ? undefined : displays[station];
  const canInspect = !!product && assets[product.id] === "ready";
  const name = slug === "harvest-tech-hub" ? "Harvest Tech Store" : "Electronics World";
  return <section className="destination-venue-root" aria-label={name}>
    <header><h2>{name}</h2></header>
    <div data-venue-viewport>
      <VenueSceneBoundary onError={onError} fallback={<p role="alert">The 3D environment could not load.</p>}>
        <WorldCanvas frameloop="demand" dpr={[1,quality.maxDpr]} gl={{antialias:false,powerPreference:"low-power"}} onSceneError={onError} fallback={<p>WebGL is unavailable.</p>}>
          <WorldCamera width={10} depth={10} stage horizontalOrbit={inspection} verticalOrbit={inspection} maxZoom={3} zoom={inspection ? 2.8 : 1.3} target={inspection && display ? [display.x,1.3,display.z] : [walker.position[0],1.2,walker.position[2]]} />
          <WorldLighting size={18} />
          <ElectronicsEnvironment displays={displays} products={products} selected={station} computerStore={slug==="harvest-tech-hub"} onWalk={point => {
            if (Math.abs(point[0]) <= RETAIL_ROOM.entranceWidth/2 && point[1] >= RETAIL_ROOM.doorway[1]) exit();
            else walk(navigation.route(current(),point));
          }} onExit={exit} onSelect={select} onAssetReady={assetReady} onAssetError={assetError} />
          {character && <group position={walker.position}><WorldCharacter position={[0,0,0]} facing={walker.facing} animation={walker.walking?"walk":"idle"} name={character.name} gender={character.gender} appearance={appearance} equipment={outfit}/></group>}
        </WorldCanvas>
      </VenueSceneBoundary>
    </div>
    <div data-venue-controls>
      <p role="status">{message}</p>
      <button type="button" disabled={!character||failed} onClick={exit} className="rounded-full border border-edge px-3 py-1.5 text-sm">{onExit?"Walk back to workplace":"Walk to entrance"}</button>
      {product && !walker.walking && !failed && <div className="flex flex-wrap items-center gap-2">
        <span className="capitalize text-sm font-medium">{product.label}</span>
        {canInspect ? <button type="button" aria-pressed={inspection} onClick={()=>setInspection(v=>!v)} className="rounded-full border border-edge px-3 py-1.5 text-sm">{inspection?"Return to character":"Inspect product"}</button> : <span role="status" className="text-xs">{assets[product.id]==="failed"?"Product model unavailable.":"Loading product model…"}</span>}
      </div>}
    </div>
  </section>;
}
