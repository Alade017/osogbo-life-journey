import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { WorldCamera, WorldLighting, WorldMaterial } from "@/components/3d/WorldScene";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";
import {
  getLocationVenueDesign,
  isTradingOpen,
  type VenueFixture,
} from "@/lib/location-venue-designs";
import { VenueEnvironment } from "@/components/3d/VenueEnvironment";
import { useOptionalGameTime } from "@/components/game/GameTimeProvider";

const SCENE_START_TIMEOUT_MS = 5_000;

class VenueSceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function FixtureModel({
  fixture,
  active,
  accentColor,
  onSelect,
}: {
  fixture: VenueFixture;
  active: boolean;
  accentColor: string;
  onSelect: () => void;
}) {
  const [x, z] = fixture.position;
  const color = active ? accentColor : "#a99c83";
  const clickable = {
    onClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onSelect();
    },
  };

  switch (fixture.kind) {
    case "counter":
      return (
        <group position={[x, 0, z]} {...clickable}>
          <mesh position={[0, 0.48, 0]} castShadow>
            <boxGeometry args={[1.8, 0.9, 0.72]} />
            <WorldMaterial tone="timber" color={color} />
          </mesh>
          <mesh position={[0, 0.97, 0]}>
            <boxGeometry args={[1.94, 0.1, 0.82]} />
            <WorldMaterial tone="linen" />
          </mesh>
        </group>
      );
    case "table":
    case "bench":
    case "seat":
      return (
        <group position={[x, 0, z]} {...clickable}>
          <mesh position={[0, fixture.kind === "table" ? 0.72 : 0.42, 0]} castShadow>
            <boxGeometry args={[fixture.kind === "seat" ? 1.25 : 1.8, 0.16, 0.72]} />
            <WorldMaterial tone="timber" color={color} />
          </mesh>
          {[-0.65, 0.65].map((leg) => (
            <mesh key={leg} position={[leg, fixture.kind === "table" ? 0.35 : 0.2, 0]}>
              <boxGeometry args={[0.12, fixture.kind === "table" ? 0.65 : 0.38, 0.14]} />
              <WorldMaterial tone="timber" />
            </mesh>
          ))}
        </group>
      );
    case "shelf":
      return (
        <group position={[x, 0, z]} {...clickable}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[1.7, 1.7, 0.32]} />
            <WorldMaterial tone="timber" color={color} />
          </mesh>
          {[0.4, 0.9, 1.4].map((height) => (
            <mesh key={height} position={[0, height, 0.21]}>
              <boxGeometry args={[1.78, 0.08, 0.52]} />
              <WorldMaterial tone="linen" />
            </mesh>
          ))}
        </group>
      );
    case "screen":
    case "display":
      return (
        <group position={[x, 0, z]} {...clickable}>
          <mesh position={[0, fixture.kind === "screen" ? 1.35 : 0.7, 0]} castShadow>
            <boxGeometry
              args={fixture.kind === "screen" ? [1.65, 1.08, 0.12] : [1.35, 0.85, 0.8]}
            />
            <WorldMaterial tone={fixture.kind === "screen" ? "slate" : "sign"} color={color} />
          </mesh>
          {fixture.kind === "display" && (
            <mesh position={[0, 0.22, 0]}>
              <boxGeometry args={[0.18, 0.46, 0.18]} />
              <WorldMaterial tone="concrete" />
            </mesh>
          )}
        </group>
      );
    case "planter":
      return (
        <group position={[x, 0, z]} {...clickable}>
          <mesh position={[0, 0.28, 0]}>
            <boxGeometry args={[1.1, 0.52, 0.9]} />
            <WorldMaterial tone="clay" color={color} />
          </mesh>
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.48, 8, 6]} />
            <WorldMaterial tone="foliage" />
          </mesh>
        </group>
      );
  }
}

export function LocationVenueScene({ slug, locationName }: { slug: string; locationName: string }) {
  const venue = useMemo(() => getLocationVenueDesign(slug, locationName), [slug, locationName]);
  const gameTime = useOptionalGameTime();
  // Shops with trading hours show their shutter open or closed for the current game hour.
  const shutterOpen = venue.environment?.trading
    ? isTradingOpen(gameTime?.simulation.gameTime.hour ?? 12, venue.environment.trading)
    : undefined;
  const [selectedFixture, setSelectedFixture] = useState(venue.fixtures[0]?.id ?? "");
  const [sceneStatus, setSceneStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const selected =
    venue.fixtures.find((fixture) => fixture.id === selectedFixture) ?? venue.fixtures[0];

  useEffect(() => {
    setSceneStatus((status) => (status === "ready" ? status : "loading"));
    setSelectedFixture((current) =>
      venue.fixtures.some((fixture) => fixture.id === current)
        ? current
        : (venue.fixtures[0]?.id ?? ""),
    );
    const timer = window.setTimeout(
      () => setSceneStatus((status) => (status === "loading" ? "fallback" : status)),
      SCENE_START_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [slug, venue]);

  return (
    <section className="game-panel space-y-4 p-4 md:p-6" aria-labelledby="location-venue-title">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {locationName} · venue interior
          </p>
          <h2 id="location-venue-title" className="text-2xl font-bold">
            {venue.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{venue.description}</p>
        </div>
        <span className="rounded-full border border-edge px-3 py-1 text-xs font-semibold">
          Explore the space
        </span>
      </header>

      <div className="relative h-64 overflow-hidden rounded-lg border border-edge bg-muted sm:h-80 md:h-[25rem]">
        {sceneStatus !== "fallback" && (
          <VenueSceneBoundary onError={() => setSceneStatus("fallback")}>
            <Canvas
              key={slug}
              shadows
              frameloop="demand"
              dpr={[1, 1.25]}
              gl={{ antialias: false, powerPreference: "low-power" }}
              fallback={
                <p className="p-4 text-sm" role="note">
                  The 3D preview is unavailable. Use the room controls below.
                </p>
              }
              onCreated={() => setSceneStatus("ready")}
              aria-hidden="true"
            >
              <WorldCamera width={10} depth={7} stage target={[0, 1.2, 0]} zoom={1.2} />
              <WorldLighting size={14} />
              {venue.environment ? (
                <VenueEnvironment
                  url={venue.environment.url}
                  open={shutterOpen}
                  fixtures={venue.fixtures}
                  activeId={selectedFixture}
                  accentColor={venue.accentColor}
                  onSelect={setSelectedFixture}
                />
              ) : (
                <>
                  <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[11, 8]} />
                    <WorldMaterial tone="tileLight" color={venue.floorColor} />
                  </mesh>
                  <mesh position={[0, 1.45, -3.95]} receiveShadow>
                    <boxGeometry args={[11, 3, 0.18]} />
                    <WorldMaterial tone="wall" color={venue.wallColor} />
                  </mesh>
                  <mesh position={[-5.42, 1.45, 0]} receiveShadow>
                    <boxGeometry args={[0.18, 3, 8]} />
                    <WorldMaterial tone="wall" color={venue.wallColor} />
                  </mesh>
                  {venue.fixtures.map((fixture) => (
                    <FixtureModel
                      key={fixture.id}
                      fixture={fixture}
                      active={fixture.id === selectedFixture}
                      accentColor={venue.accentColor}
                      onSelect={() => setSelectedFixture(fixture.id)}
                    />
                  ))}
                </>
              )}
            </Canvas>
          </VenueSceneBoundary>
        )}
        {sceneStatus === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 p-4">
            <WorldLoadingIndicator title="Opening the venue" detail="Preparing the interior…" />
          </div>
        )}
        {sceneStatus === "fallback" && (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <h3 className="font-bold">{venue.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The 3D preview did not start. The room guide below is ready to use.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]">
        <div>
          <h3 className="mb-2 text-sm font-bold">Explore a feature</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Venue features">
            {venue.fixtures.map((fixture) => (
              <button
                key={fixture.id}
                type="button"
                aria-pressed={fixture.id === selectedFixture}
                onClick={() => setSelectedFixture(fixture.id)}
                className="rounded-lg border border-edge bg-card px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={
                  fixture.id === selectedFixture
                    ? {
                        borderColor: venue.accentColor,
                        boxShadow: `inset 0 0 0 1px ${venue.accentColor}`,
                      }
                    : undefined
                }
              >
                {fixture.label}
              </button>
            ))}
          </div>
        </div>
        <p className="min-h-12 rounded-lg bg-muted/50 p-3 text-sm" aria-live="polite">
          {selected?.detail}
        </p>
      </div>
    </section>
  );
}
