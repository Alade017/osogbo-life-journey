import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { parseSavedAppearance } from "@/game/character-animation";
import type { Appearance } from "@/game/avatar-appearance";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { WorldCanvas } from "@/components/3d/WorldCanvas";
import { WorldSceneReady } from "@/components/3d/WorldSceneReady";
import { WorldCamera, WorldLighting } from "@/components/3d/WorldScene";
import { ResidentialCompoundScene } from "@/components/3d/ResidentialCompoundScene";
import {
  RESIDENTIAL_COMPOUND,
  compoundFeatures,
  residentialHomePresentation,
  type CompoundFeatureId,
} from "@/game/residential-compound";
import { residentialCompoundNavigation, RESIDENTIAL_COMPOUND_SPAWN } from "@/game/residential-compound-navigation";
import { useHouseMovement } from "@/hooks/use-house-movement";
import { VenueSceneBoundary } from "./VenueSceneBoundary";
import { WorldLoadingIndicator } from "./WorldLoadingIndicator";

/** Local courtyard inspection. Only the caller's existing, server-guarded home action can enter a house. */
export function ResidentialCompoundVenue({
  homeTypeId,
  onEnterHome,
  enteringHome = false,
}: {
  homeTypeId?: string | null;
  onEnterHome?: () => void;
  enteringHome?: boolean;
}) {
  const home = useMemo(() => residentialHomePresentation(homeTypeId), [homeTypeId]);
  const { data: character } = useQuery(q.character());
  const { data: equipment } = useQuery(q.equipment());
  const playerEquipment = useMemo(() => normalizeEquippedItems(equipment), [equipment]);
  const rawAppearance = character?.appearance;
  const playerAppearance = useMemo(
    () =>
      rawAppearance && typeof rawAppearance === "object" && !Array.isArray(rawAppearance)
        ? (rawAppearance as Appearance)
        : parseSavedAppearance(rawAppearance),
    [rawAppearance],
  );
  const features = compoundFeatures(home?.sharedFacilities ?? false);
  const [selected, setSelected] = useState<CompoundFeatureId>("courtyard");
  const [movementMessage, setMovementMessage] = useState("Tap the courtyard to walk, or choose a facility.");
  const walker = useHouseMovement(home?.id ?? "residential-compound", [RESIDENTIAL_COMPOUND_SPAWN[0], 0.06, RESIDENTIAL_COMPOUND_SPAWN[1]]);
  const navigation = useMemo(() => residentialCompoundNavigation(), []);
  const movementRequest = useRef(0);
  const walkTo = useCallback((point: readonly [number, number]) => {
    const target = navigation.nearest([point[0], point[1]]);
    const current: [number, number] = [walker.positionRef.current[0], walker.positionRef.current[2]];
    const path = target ? navigation.route(current, target) : null;
    const ticket = ++movementRequest.current;
    walker.cancel();
    if (!path) {
      setMovementMessage("That part of the compound is blocked. Choose another point.");
      return;
    }
    setMovementMessage("Walking through the courtyard…");
    void walker.walk(path.map(([x, z]) => [x, 0.06, z] as [number, number, number])).then((arrived) => {
      if (ticket === movementRequest.current) setMovementMessage(arrived ? "You reached that spot." : "Movement stopped.");
    });
  }, [navigation, walker]);
  const handleFeatureSelect = useCallback((id: CompoundFeatureId) => {
    setSelected(id);
    const path = navigation.approach(
      [walker.positionRef.current[0], walker.positionRef.current[2]],
      id,
    );
    const ticket = ++movementRequest.current;
    walker.cancel();
    if (!path) {
      setMovementMessage("There is no clear approach to that facility.");
      return;
    }
    setMovementMessage("Walking to the selected facility…");
    void walker.walk(path.map(([x, z]) => [x, 0.06, z] as [number, number, number])).then((arrived) => {
      if (ticket === movementRequest.current) setMovementMessage(arrived ? "You reached the selected facility." : "Movement stopped.");
    });
  }, [navigation, walker]);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const heading = useId();
  const unavailable = useCallback(() => setStatus("fallback"), []);
  const ready = useCallback(
    () => setStatus((status) => (status === "loading" ? "ready" : status)),
    [],
  );
  const feature = features.find((item) => item.id === selected) ?? features[0]!;
  const canEnter = !!home && !!onEnterHome;
  useEffect(() => {
    const timer = window.setTimeout(
      () => setStatus((previous) => (previous === "loading" ? "fallback" : previous)),
      5000,
    );
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <section className="space-y-3" aria-labelledby={heading}>
      <header>
        <h2 id={heading} className="text-xl font-bold">
          Residential compound
        </h2>
        <p className="text-sm text-muted-foreground">
          {home
            ? "Saved home · " + home.name
            : "Courtyard, shared outdoor facilities and private house entrances"}
        </p>
      </header>
      <div
        data-venue-viewport
        className="relative h-[55svh] min-h-72 overflow-hidden rounded-lg border border-edge bg-muted"
      >
        {status !== "fallback" && (
          <VenueSceneBoundary resetKey={homeTypeId ?? "default"} onError={unavailable}>
            <WorldCanvas
              onSceneError={unavailable}
              shadows="percentage"
              frameloop="demand"
              dpr={[1, 1.25]}
              gl={{ antialias: false, powerPreference: "low-power" }}
              aria-label="Interactive 3D residential compound"
              fallback={
                <p className="p-4">WebGL is unavailable. Use the compound controls below.</p>
              }
            >
              <WorldCamera
                width={RESIDENTIAL_COMPOUND.cameraWidth}
                depth={RESIDENTIAL_COMPOUND.cameraDepth}
                stage
                target={[0, 1.2, 0]}
                zoom={1}
              />
              <WorldLighting size={RESIDENTIAL_COMPOUND.width} />
              <ResidentialCompoundScene home={home} selected={feature.id} onSelect={handleFeatureSelect} onWalk={walkTo} />
              {character && (
                <WorldCharacter
                  name={character.name}
                  gender={character.gender}
                  appearance={playerAppearance}
                  equipment={playerEquipment}
                  position={walker.position}
                  facing={walker.facing}
                  animation={walker.walking ? "walk" : "idle"}
                />
              )}
              <WorldSceneReady onReady={ready} />
            </WorldCanvas>
          </VenueSceneBoundary>
        )}
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <WorldLoadingIndicator title="Opening the compound" detail="Preparing the courtyard…" />
          </div>
        )}
        {status === "fallback" && (
          <p role="note" className="p-4">
            The 3D scene is unavailable. Compound details and your confirmed home entrance remain
            available below.
          </p>
        )}
      </div>
      <div data-venue-controls>
        <details>
          <summary className="cursor-pointer rounded-lg border border-edge p-3 text-sm font-semibold">
            Explore compound facilities
          </summary>
          <div role="group" aria-label="Compound features" className="mt-2 flex flex-wrap gap-2">
            {features.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={feature.id === item.id}
                onClick={() => setSelected(item.id)}
                className="rounded-lg border border-edge bg-card px-3 py-3 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {item.label}
              </button>
            ))}
          </div>
        </details>
        <p aria-live="polite" className="text-sm">
          {feature.detail}
        </p>
        <p aria-live="polite" role="status" className="text-xs text-muted-foreground">
          {movementMessage}
        </p>
        {canEnter ? (
          <button
            type="button"
            disabled={enteringHome}
            aria-busy={enteringHome}
            onClick={onEnterHome}
            className="rounded-lg border border-edge bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {enteringHome ? "Heading home…" : "Enter my home"}
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Other residents' homes are private. Home entry is available only through your confirmed
            home.
          </p>
        )}
      </div>
    </section>
  );
}
