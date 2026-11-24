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
import { DealershipExterior, DealershipInterior } from "@/components/3d/DealershipEnvironment";
import { SHOWROOM_LAYOUT as layout, showroomNavigation, showroomExteriorRoute } from "@/game/showroom-navigation";
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
  const quality = WORLD_RENDER_QUALITY[useRenderQuality()];
  const outfit = useMemo(() => normalizeEquippedItems(equipment), [equipment]);
  const raw = character?.appearance;
  const appearance = useMemo(() => raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Appearance : parseSavedAppearance(raw), [raw]);
  const models = useMemo(() => getShowroomModels(slug), [slug]);
  const navigation = useMemo(showroomNavigation, []);
  const walker = useHouseMovement(slug, toRoom(layout.exteriorSpawn));
  const [inside, setInside] = useState(false);
  const [message, setMessage] = useState("Walk to the entrance to enter.");
  const [station, setStation] = useState<number | null>(null);
  const request = useRef(0);
  const { cancel } = walker;
  useEffect(() => () => { request.current++; cancel(); }, [cancel]);
  const onError = useCallback(() => {
    request.current++;
    cancel();
    setMessage("The 3D environment is unavailable.");
  }, [cancel]);

  function walk(path: WalkPoint[] | null, after?: () => void) {
    const ticket = ++request.current;
    walker.cancel();
    setStation(null);
    if (!character || !path) {
      setMessage(character ? "Choose a clear walking route." : "Your character is not ready.");
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
  function enter() {
    if (inside) return;
    walk(showroomExteriorRoute(current(), layout.exteriorDoor), () => {
      walker.place(toRoom(layout.entrance));
      setInside(true);
      setMessage("Tap the floor to walk or approach a vehicle.");
    });
  }
  function exit() {
    if (!inside) return;
    walk(navigation.route(current(), layout.entrance), () => {
      walker.place(toRoom(layout.exteriorDoor));
      setInside(false);
      setMessage("You are outside the dealership.");
    });
  }
  function go(point: WalkPoint) {
    if (!inside && Math.abs(point[0]) <= layout.entranceWidth / 2 && point[1] <= layout.exteriorDoor[1] + 0.35) {
      enter();
    } else if (inside && Math.abs(point[0]) <= layout.entranceWidth / 2 && point[1] >= layout.entrance[1]) {
      exit();
    } else {
      walk(inside ? navigation.route(current(), point) : showroomExteriorRoute(current(), point));
    }
  }
  function approach(index: number) {
    const model = models[index];
    if (!inside || !model) return;
    walk(navigation.approach(current(), index), () => {
      setStation(index);
      setMessage(model.label);
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
            <WorldCamera width={12} depth={12} stage target={[walker.position[0], 1.2, walker.position[2]]} zoom={1.5} />
            <WorldLighting size={24} />
            {inside ? <DealershipInterior models={models} onWalk={go} onSelect={approach} onExit={exit} />
              : <DealershipExterior onEnter={enter} onWalk={go} />}
            {character && <group position={walker.position}>
              <WorldCharacter position={[0, 0, 0]} facing={walker.facing} animation={walker.walking ? "walk" : "idle"}
                name={character.name} gender={character.gender} appearance={appearance} equipment={outfit} />
            </group>}
          </WorldCanvas>
        </VenueSceneBoundary>
      </div>
      <div data-venue-controls>
        <p role="status">{message}</p>
        <button type="button" disabled={!character} onClick={inside ? exit : enter}
          className="rounded-full border border-edge px-3 py-1.5 text-sm">{inside ? "Walk to exit" : "Walk to entrance"}</button>
        {inside && station !== null && <p className="text-sm capitalize">{models[station]?.label}</p>}
      </div>
    </section>
  );
}
