import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import type { Appearance } from "@/game/avatar-appearance";
import { parseSavedAppearance } from "@/game/character-animation";
import { useRenderQuality } from "@/hooks/use-render-quality";
import { WORLD_RENDER_QUALITY } from "@/components/3d/render-quality";
import { WorldCanvas } from "@/components/3d/WorldCanvas";
import { WorldCamera, WorldLighting } from "@/components/3d/WorldScene";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { WorkplaceScene } from "@/components/3d/WorkplaceScene";
import { WORKPLACE_LAYOUT } from "@/game/workplace-layout";
import { workplaceNavigation, workplaceSpawn } from "@/game/workplace-navigation";
import type { WalkPoint } from "@/game/grid-walk-path";
import { useHouseMovement } from "@/hooks/use-house-movement";
import type { LocationVenueDesign, VenueFixture } from "@/lib/location-venue-designs";
import { VenueSceneBoundary } from "./VenueSceneBoundary";

import { commercialVenueLoaders } from "./venue-scene-loaders";

const ElectronicsVenue = lazy(commercialVenueLoaders.electronics);

export default function HarvestTechHubVenue({ venue }: { venue: LocationVenueDesign }) {
  const [inStore, setInStore] = useState(false);
  return inStore ? (
    <Suspense fallback={<p role="status">Opening the computer store…</p>}>
      <ElectronicsVenue slug="harvest-tech-hub" onExit={() => setInStore(false)} />
    </Suspense>
  ) : <HarvestWorkplace venue={venue} onEnterStore={() => setInStore(true)} />;
}

function HarvestWorkplace({ venue, onEnterStore }: { venue: LocationVenueDesign; onEnterStore: () => void }) {
  const { data: character } = useQuery(q.character());
  const { data: equipment } = useQuery(q.equipment());
  const quality = WORLD_RENDER_QUALITY[useRenderQuality()];
  const outfit = useMemo(() => normalizeEquippedItems(equipment), [equipment]);
  const raw = character?.appearance;
  const appearance = useMemo(
    () =>
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Appearance)
        : parseSavedAppearance(raw),
    [raw],
  );
  const walker = useHouseMovement(venue.name, [workplaceSpawn[0], 0.06, workplaceSpawn[1]]);
  const navigation = useMemo(() => workplaceNavigation(venue.fixtures), [venue.fixtures]);
  const [station, setStation] = useState<VenueFixture | null>(null);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("Tap the floor to walk or choose a station.");
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const entering = useRef(false);
  const [enteringStore, setEnteringStore] = useState(false);
  const { cancel } = walker;
  useEffect(() => () => { request.current++; cancel(); }, [cancel]);
  const onError = useCallback(() => {
    request.current++;
    cancel();
    entering.current = false;
    setEnteringStore(false);
    setFailed(true);
  }, [cancel]);
  function go(target: WalkPoint | VenueFixture) {
    if (entering.current) return;
    const ticket = ++request.current;
    walker.cancel();
    const [x, , z] = walker.positionRef.current;
    const fixture = "id" in target ? target : null;
    const path =
      "id" in target ? navigation.approach([x, z], target) : navigation.route([x, z], target);
    setStation(null);
    setSelected(fixture?.id ?? "");
    if (!path) {
      setMessage("That path is blocked. Choose a clear spot.");
      return;
    }
    setMessage(fixture ? "Walking to " + fixture.label + "…" : "Walking…");
    void walker.walk(path.map(([x, z]) => [x, 0.06, z])).then((arrived) => {
      if (ticket !== request.current) return;
      setStation(arrived ? fixture : null);
      setMessage(arrived ? (fixture?.label ?? "Arrived.") : "Walk stopped.");
    });
  }
  function enterStore() {
    if (!character || failed || entering.current) return;
    const ticket = ++request.current;
    walker.cancel();
    setStation(null);
    setSelected("");
    const [x, , z] = walker.positionRef.current;
    const path = navigation.route([x, z], workplaceSpawn);
    if (!path) { setMessage("That path is blocked. Choose a clear spot."); return; }
    entering.current = true;
    setEnteringStore(true);
    void commercialVenueLoaders.electronics().catch(() => undefined);
    setMessage("Walking to the computer store entrance…");
    void walker.walk(path.map(([px, pz]) => [px, 0.06, pz])).then((arrived) => {
      if (ticket !== request.current) return;
      entering.current = false;
      setEnteringStore(false);
      if (arrived) onEnterStore();
      else setMessage("Walk stopped.");
    });
  }
  const feature = station?.workplaceFeature;
  const job = feature === "workstations" || feature === "reception";
  const course = feature === "training" || feature === "presentation";
  const linkStyle =
    "inline-flex min-h-11 items-center rounded-lg bg-primary px-3 font-semibold text-primary-foreground";
  return (
    <section className="destination-venue-root" aria-label={venue.name}>
      <header>
        <h2>{venue.name}</h2>
      </header>
      <div data-venue-viewport>
        <VenueSceneBoundary onError={onError}>
          <WorldCanvas
            frameloop="demand"
            dpr={[1, quality.maxDpr]}
            gl={{ antialias: false, powerPreference: "low-power" }}
            onSceneError={onError}
            fallback={<p>3D unavailable. Choose a station below.</p>}
            aria-label="Walk through Harvest Tech Hub"
          >
            <WorldCamera
              width={WORKPLACE_LAYOUT.cameraWidth}
              depth={WORKPLACE_LAYOUT.cameraDepth}
              stage
              target={[0, 1.2, 0]}
              zoom={1.2}
            />
            <WorldLighting size={14} />
            <WorkplaceScene
              fixtures={venue.fixtures}
              floorColor={venue.floorColor}
              wallColor={venue.wallColor}
              accentColor={venue.accentColor}
              selected={selected}
              onWalk={(point) => {
                if (Math.abs(point[0]) <= WORKPLACE_LAYOUT.entranceWidth / 2 && point[1] >= workplaceSpawn[1]) enterStore();
                else go(point);
              }}
              onSelect={(id) => {
                const fixture = venue.fixtures.find((f) => f.id === id);
                if (fixture) go(fixture);
              }}
            />
            {character && (
              <group position={walker.position}>
                <WorldCharacter
                  position={[0, 0, 0]}
                  facing={walker.facing}
                  animation={walker.walking ? "walk" : "idle"}
                  name={character.name}
                  gender={character.gender}
                  appearance={appearance}
                  equipment={outfit}
                />
              </group>
            )}
          </WorldCanvas>
        </VenueSceneBoundary>
      </div>
      <div data-venue-controls>
        {failed && (
          <p role="alert">The 3D view is unavailable. Station controls are available here.</p>
        )}
        <p role="status">{message}</p>
        <button type="button" disabled={!character || failed || enteringStore} onClick={enterStore} className="rounded-full border border-edge px-3 py-1.5 text-sm">Walk to computer store</button>
        {job && (
          <Link to="/jobs" className={linkStyle}>
            Jobs &amp; shifts
          </Link>
        )}
        {course && (
          <Link to="/education" className={linkStyle}>
            Courses
          </Link>
        )}
        {feature === "equipment" && <p>{station?.detail}</p>}
        <details>
          <summary>Choose a station</summary>
          <div className="flex flex-wrap gap-2">
            {venue.fixtures.map((f) => (
              <button
                className="rounded-lg border border-edge px-3"
                key={f.id}
                type="button"
                disabled={enteringStore}
                onClick={() => go(f)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
