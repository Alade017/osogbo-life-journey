import { useRenderQuality } from "@/hooks/use-render-quality";
import { useQuery } from "@tanstack/react-query";
import { q } from "@/lib/game";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { parseSavedAppearance } from "@/game/character-animation";
import type { Appearance } from "@/game/avatar-appearance";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { WORLD_RENDER_QUALITY } from "@/components/3d/render-quality";
import { Link } from "@tanstack/react-router";
import { BANK_INTERIORS } from "@/game/bank-interiors";
import { TRAVEL_MODES, TRAVEL_MODE_DETAILS, type TravelMode } from "@/lib/transport-service";
import { transportMapHref } from "@/lib/transport-park";
import {
  Component,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { resolveVenueScene } from "@/lib/venue-scene-resolver";
import { VenueSceneBoundary } from "./VenueSceneBoundary";
import { SpecializedVenueFallback } from "./SpecializedVenueFallback";

import { venueSceneLoaders } from "./venue-scene-loaders";

const CivicServiceScene = lazy(venueSceneLoaders.civic);
const BankInteriorScene = lazy(venueSceneLoaders.bank);
const TransitParkScene = lazy(venueSceneLoaders.transport);
const HealthcareScene = lazy(venueSceneLoaders.healthcare);
const HarvestTechHubVenue = lazy(() => import("./HarvestTechHubVenue"));
const WorkplaceScene = lazy(venueSceneLoaders.workplace);
const RetailInteriorScene = lazy(venueSceneLoaders.retail);
const BukaInteriorScene = lazy(venueSceneLoaders.food);
const MarketTradingHall = lazy(venueSceneLoaders.market);
const ClinicVenue = lazy(venueSceneLoaders.clinic);
const OsunMallVenue = lazy(venueSceneLoaders.mall);
const WorshipVenue = lazy(venueSceneLoaders.worship);
const SchoolCampusVenue = lazy(venueSceneLoaders.campus);
import { WorldSceneReady } from "@/components/3d/WorldSceneReady";
import { WorldCanvas } from "@/components/3d/WorldCanvas";
import { WorldCamera, WorldLighting, WorldMaterial } from "@/components/3d/WorldScene";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";
import {
  getLocationVenueDesign,
  isTradingOpen,
  type VenueFixture,
  type LocationVenueDesign,
} from "@/lib/location-venue-designs";
import { VenueEnvironment } from "@/components/3d/VenueEnvironment";
import { VenueFurnitureModel } from "@/components/3d/VenueFurniture";
import { useOptionalGameTime } from "@/components/game/GameTimeProvider";
import { VENUE_FURNITURE } from "@/lib/venue-furniture-assets";
import {
  getFurnitureKey,
  summarizeFurnitureReadiness,
  type FurnitureResult,
} from "@/lib/venue-furniture-readiness";
import {
  getFurnitureResults,
  registerFurniture,
  reportFurnitureResult,
  unregisterFurniture,
  type FurnitureRegistry,
  type FurnitureRegistration,
} from "@/lib/venue-furniture-lifecycle";
import { VenueFurnitureStatus } from "./VenueFurnitureStatus";
import { getVenueSceneIdentity } from "@/lib/venue-scene-identity";

const SCENE_START_TIMEOUT_MS = 5_000;

function getVenuePlayerSpawn(
  width: number,
  depth: number,
  fixtures: readonly VenueFixture[],
): [number, number, number] {
  const xLimit = Math.max(0.8, width / 2 - 0.85);
  const zLimit = Math.max(0.8, depth / 2 - 0.85);
  const candidates: Array<[number, number]> = [];
  for (const z of [zLimit, zLimit - 0.9, zLimit - 1.8, 0.4, -0.4]) {
    for (const x of [0, -0.9, 0.9, -1.8, 1.8]) {
      if (Math.abs(x) <= xLimit) candidates.push([x, Math.max(-zLimit, z)]);
    }
  }
  const clearance = (point: [number, number]) =>
    fixtures.reduce((nearest, fixture) => {
      const dx = point[0] - fixture.position[0];
      const dz = point[1] - fixture.position[1];
      return Math.min(nearest, Math.hypot(dx, dz));
    }, Number.POSITIVE_INFINITY);
  const preferred = candidates.find((point) => clearance(point) >= 1.35);
  const selected = preferred ?? candidates.reduce((best, point) =>
    clearance(point) > clearance(best) ? point : best,
  );
  return [selected[0], 0.06, selected[1]];
}

const FixtureModel = memo(function FixtureModel({
  fixture,
  active,
  accentColor,
  onSelect,
  onRegister,
  onResult,
  onUnregister,
}: {
  fixture: VenueFixture;
  active: boolean;
  accentColor: string;
  onSelect: (fixtureId: string) => void;
  onRegister: (key: string, registration: FurnitureRegistration) => void;
  onResult: (key: string, token: symbol, result: FurnitureResult) => void;
  onUnregister: (key: string, token: symbol) => void;
}) {
  const [x, z] = fixture.position;
  const furnitureKey = getFurnitureKey(fixture);
  const supported = Boolean(VENUE_FURNITURE[fixture.kind]);
  const [token] = useState(() => Symbol("venue-furniture"));
  const latestResult = useRef<FurnitureResult | undefined>(undefined);

  const handleReady = useCallback(() => {
    latestResult.current = "ready";
    onResult(furnitureKey, token, "ready");
  }, [furnitureKey, token, onResult]);

  const handleError = useCallback(() => {
    latestResult.current = "failed";
    onResult(furnitureKey, token, "failed");
  }, [furnitureKey, token, onResult]);

  useEffect(() => {
    if (!supported) return;
    onRegister(furnitureKey, {
      token,
      ...(latestResult.current !== undefined ? { result: latestResult.current } : {}),
    });
    return () => {
      onUnregister(furnitureKey, token);
    };
  }, [furnitureKey, supported, token, onRegister, onUnregister]);

  const handleClick = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onSelect(fixture.id);
    },
    [onSelect, fixture.id],
  );

  if (!supported) return null;

  return (
    <group position={[x, 0, z]}>
      <VenueSceneBoundary key={furnitureKey} onError={handleError}>
        <Suspense fallback={null}>
          <VenueFurnitureModel
            kind={fixture.kind}
            active={active}
            accentColor={accentColor}
            onClick={handleClick}
          />
          <WorldSceneReady onReady={handleReady} />
        </Suspense>
      </VenueSceneBoundary>
    </group>
  );
});

function BasicLocationVenueScene({
  slug,
  locationName,
  design,
  onBrowseMarket,
  onBankServices,
  immersive = false,
}: {
  slug: string;
  locationName: string;
  design?: LocationVenueDesign;
  onBrowseMarket?: () => void;
  onBankServices?: () => void;
  immersive?: boolean;
}) {
  const quality = WORLD_RENDER_QUALITY[useRenderQuality()];
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
  const venue = useMemo(
    () => design ?? getLocationVenueDesign(slug, locationName),
    [design, slug, locationName],
  );
  const sceneKind = resolveVenueScene(slug, venue);
  const bankLayout = venue.bankInterior ? BANK_INTERIORS[venue.bankInterior] : null;
  const playerSpawn = useMemo(
    () =>
      getVenuePlayerSpawn(
        bankLayout?.width ?? venue.sceneBounds?.width ?? venue.sceneSize?.width ?? 11,
        bankLayout?.depth ?? venue.sceneBounds?.depth ?? venue.sceneSize?.depth ?? 8,
        venue.fixtures,
      ),
    [bankLayout, venue.sceneBounds, venue.sceneSize, venue.fixtures],
  );
  const gameTime = useOptionalGameTime();
  // Shops with trading hours show their shutter open or closed for the current game hour.
  const shutterOpen = venue.environment?.trading
    ? isTradingOpen(gameTime?.simulation.gameTime.hour ?? 12, venue.environment.trading)
    : undefined;
  const [preferredMode, setPreferredMode] = useState<TravelMode | null>(null);
  const [selectedFixture, setSelectedFixture] = useState(venue.fixtures[0]?.id ?? "");
  const [sceneStatus, setSceneStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [slowLoading, setSlowLoading] = useState(false);
  const [furnitureRegistry, setFurnitureRegistry] = useState<FurnitureRegistry>(() => new Map());

  const furnitureReadiness = useMemo(() => {
    if (sceneKind !== "generic" || sceneStatus !== "ready") return null;
    return summarizeFurnitureReadiness(venue.fixtures, getFurnitureResults(furnitureRegistry));
  }, [sceneKind, sceneStatus, venue.fixtures, furnitureRegistry]);

  const handleFurnitureRegister = useCallback(
    (key: string, registration: FurnitureRegistration) => {
      setFurnitureRegistry((current) => registerFurniture(current, key, registration));
    },
    [],
  );

  const handleFurnitureResult = useCallback(
    (key: string, token: symbol, result: FurnitureResult) => {
      setFurnitureRegistry((current) => reportFurnitureResult(current, key, token, result));
    },
    [],
  );

  const handleFurnitureUnregister = useCallback((key: string, token: symbol) => {
    setFurnitureRegistry((current) => unregisterFurniture(current, key, token));
  }, []);
  const handleSceneReady = useCallback(() => {
    setSceneStatus((status) => (status === "loading" ? "ready" : status));
  }, []);
  const selected =
    venue.fixtures.find((fixture) => fixture.id === selectedFixture) ?? venue.fixtures[0];
  const selectedAction =
    sceneKind === "bank" && venue.bankInterior
      ? { label: "Open bank services", href: `/bank/${slug}` }
      : sceneKind === "market" || sceneKind === "retail"
        ? { label: "Browse available goods", href: "/market" }
        : sceneKind === "workplace"
          ? { label: "View jobs and shifts", href: "/jobs" }
          : sceneKind === "campus"
            ? { label: "Explore courses", href: "/education" }
            : null;

  useEffect(() => {
    setSelectedFixture((current) =>
      venue.fixtures.some((fixture) => fixture.id === current)
        ? current
        : (venue.fixtures[0]?.id ?? ""),
    );
  }, [venue]);

  useEffect(() => {
    if (sceneStatus !== "loading") {
      setSlowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setSlowLoading(true), SCENE_START_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [sceneStatus]);

  return (
    <section
      className={immersive ? "destination-venue-root" : "game-panel space-y-4 p-4 md:p-6"}
      aria-labelledby="location-venue-title"
    >
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
      </header>

      <div
        data-venue-viewport
        className="relative h-64 overflow-hidden rounded-lg border border-edge bg-muted sm:h-80 md:h-[25rem]"
      >
        {sceneStatus !== "fallback" && (
          <VenueSceneBoundary resetKey={slug} onError={() => setSceneStatus("fallback")}>
            <WorldCanvas
              key={slug}
              onSceneError={() => setSceneStatus("fallback")}
              shadows="percentage"
              frameloop="demand"
              dpr={[1, Math.min(1.25, quality.maxDpr)]}
              gl={{ antialias: false, powerPreference: "low-power" }}
              fallback={
                <p className="p-4 text-sm" role="note">
                  The scene is unavailable. Your controls remain available.
                </p>
              }
              aria-hidden="true"
            >
              <WorldCamera
                width={
                  bankLayout?.width ?? venue.sceneBounds?.width ?? venue.sceneSize?.width ?? 10
                }
                depth={bankLayout?.depth ?? venue.sceneBounds?.depth ?? venue.sceneSize?.depth ?? 7}
                stage
                target={[0, 1.2, 0]}
                zoom={1.2}
              />
              <WorldLighting size={14} />
              <Suspense fallback={null}>
                {sceneKind === "civic" && venue.civicService ? (
                  <CivicServiceScene
                    variant={venue.civicService}
                    fixtures={venue.fixtures}
                    selected={selectedFixture}
                    onSelect={setSelectedFixture}
                    floorColor={venue.floorColor}
                    wallColor={venue.wallColor}
                    accentColor={venue.accentColor}
                  />
                ) : sceneKind === "bank" && venue.bankInterior ? (
                  <BankInteriorScene
                    variant={venue.bankInterior}
                    fixtures={venue.fixtures}
                    selected={selectedFixture}
                    onSelect={setSelectedFixture}
                    floorColor={venue.floorColor}
                    wallColor={venue.wallColor}
                    accentColor={venue.accentColor}
                  />
                ) : sceneKind === "transport" ? (
                  <TransitParkScene
                    fixtures={venue.fixtures}
                    selected={selectedFixture}
                    onSelect={setSelectedFixture}
                    onSelectMode={setPreferredMode}
                  />
                ) : sceneKind === "healthcare" ? (
                  <HealthcareScene
                    fixtures={venue.fixtures}
                    selected={selectedFixture}
                    onSelect={setSelectedFixture}
                  />
                ) : sceneKind === "market" ? (
                  <MarketTradingHall
                    fixtures={venue.fixtures}
                    selected={selectedFixture}
                    onSelect={setSelectedFixture}
                  />
                ) : sceneKind === "workplace" ? (
                  <WorkplaceScene
                    fixtures={venue.fixtures}
                    selected={selectedFixture}
                    onSelect={setSelectedFixture}
                    floorColor={venue.floorColor}
                    wallColor={venue.wallColor}
                    accentColor={venue.accentColor}
                  />
                ) : sceneKind === "retail" ? (
                  <RetailInteriorScene
                    fixtures={venue.fixtures}
                    selected={selectedFixture}
                    onSelect={setSelectedFixture}
                    floorColor={venue.floorColor}
                    wallColor={venue.wallColor}
                    accentColor={venue.accentColor}
                  />
                ) : sceneKind === "food" && venue.foodInterior ? (
                  <BukaInteriorScene
                    variant={venue.foodInterior}
                    fixtures={venue.fixtures}
                    selected={selectedFixture}
                    onSelect={setSelectedFixture}
                    floorColor={venue.floorColor}
                    wallColor={venue.wallColor}
                    accentColor={venue.accentColor}
                  />
                ) : sceneKind === "environment" && venue.environment ? (
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
                        key={getFurnitureKey(fixture)}
                        fixture={fixture}
                        active={fixture.id === selectedFixture}
                        accentColor={venue.accentColor}
                        onSelect={setSelectedFixture}
                        onRegister={handleFurnitureRegister}
                        onResult={handleFurnitureResult}
                        onUnregister={handleFurnitureUnregister}
                      />
                    ))}
                  </>
                )}
                {character && (
                  <WorldCharacter
                    name={character.name}
                    gender={character.gender}
                    appearance={playerAppearance}
                    equipment={playerEquipment}
                    position={playerSpawn}
                    facing="north"
                    animation="idle"
                  />
                )}
                <WorldSceneReady onReady={handleSceneReady} />
              </Suspense>
            </WorldCanvas>
          </VenueSceneBoundary>
        )}
        {sceneStatus === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 p-4">
            <WorldLoadingIndicator
              title="Opening the venue"
              detail={
                slowLoading
                  ? "The interior is taking longer than expected."
                  : "Preparing the interior…"
              }
              action={
                <button
                  type="button"
                  className="rounded-lg border border-edge px-3 py-2 text-sm font-semibold"
                  onClick={() => setSceneStatus("fallback")}
                >
                  Continue without 3D
                </button>
              }
            />
          </div>
        )}
        {sceneStatus === "fallback" && (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <h3 className="font-bold">{venue.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The scene could not load. Your controls remain available.
              </p>
            </div>
          </div>
        )}
      </div>

      <details
        data-venue-controls
        name={immersive ? "destination-panels" : undefined}
        open={!immersive}
      >
        <summary>Scene actions</summary>
        <div>
          {furnitureReadiness && (
            <VenueFurnitureStatus
              pending={furnitureReadiness.pending}
              failed={furnitureReadiness.failed}
            />
          )}

          {venue.transportPark && (
            <section aria-label="Plan a journey" className="space-y-3">
              <details>
                <summary className="cursor-pointer rounded-lg border border-edge p-3 text-sm font-semibold">
                  Preferred transport
                  {preferredMode ? " · " + TRAVEL_MODE_DETAILS[preferredMode].label : ""}
                </summary>
                <div
                  role="group"
                  aria-label="Preferred transport"
                  className="mt-2 flex flex-wrap gap-2"
                >
                  {TRAVEL_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={preferredMode === mode}
                      onClick={() => setPreferredMode(mode)}
                      className="rounded-lg border border-edge bg-card px-3 py-3 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    >
                      {TRAVEL_MODE_DETAILS[mode].label}
                    </button>
                  ))}
                </div>
              </details>
              <p className="text-sm text-muted-foreground">
                Choose a destination to check routes, transport availability and fares before
                confirming.
              </p>
              <a
                href={transportMapHref(preferredMode)}
                className="inline-flex rounded-lg border border-edge bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Choose destination
              </a>
            </section>
          )}
          {venue.scene === "workplace" && (
            <nav aria-label="Workplace links" className="flex flex-wrap gap-2">
              <Link
                to="/jobs"
                className="rounded-lg border border-edge bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Jobs & shifts
              </Link>
              <Link
                to="/education"
                className="rounded-lg border border-edge bg-card px-4 py-3 text-sm font-semibold"
              >
                Courses
              </Link>
            </nav>
          )}
          {venue.bankInterior && onBankServices && (
            <button
              type="button"
              onClick={onBankServices}
              className="rounded-lg border border-edge bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Access bank services
            </button>
          )}
          {(venue.scene === "market" || venue.retailInterior) && onBrowseMarket && (
            <button
              type="button"
              onClick={onBrowseMarket}
              className="rounded-lg border border-edge bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              {venue.retailInterior ? "Browse shop catalogue" : "Browse market offers"}
            </button>
          )}
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
            <div className="space-y-2">
              <p className="min-h-12 rounded-lg bg-muted/50 p-3 text-sm" aria-live="polite">
                {selected?.detail}
              </p>
              {selectedAction ? (
                <Link
                  to={selectedAction.href}
                  className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {selectedAction.label}
                </Link>
              ) : sceneKind === "transport" ? (
                <a
                  href={transportMapHref(preferredMode)}
                  className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Choose destination and transport
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Information only — no direct action is configured for this feature yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

export function LocationVenueScene(props: {
  slug: string;
  locationName: string;
  immersive?: boolean;
  /** The server location id; the Osun Mall room needs it to confirm the visitor is inside. */
  locationId?: string;
  /** A venue design supplied by the caller, such as the neighbourhood Buka interior. */
  design?: LocationVenueDesign;
  /** The shop the visitor is inside, when the venue is a sub-building stall. */
  shopSlug?: string | null;
  onBrowseMarket?: () => void;
  onBankServices?: () => void;
}) {
  const venue = props.design ?? getLocationVenueDesign(props.slug, props.locationName);
  const sceneKind = resolveVenueScene(props.slug, venue, props.locationId);
  const sceneIdentity = getVenueSceneIdentity({
    slug: props.slug,
    locationId: props.locationId,
    shopSlug: props.shopSlug,
    sceneKind,
    venue,
  });
  const specializedFallback = (
    <SpecializedVenueFallback locationName={props.locationName} venue={venue} />
  );
  if (sceneKind === "workplace" && props.immersive && props.locationId) {
    return (
      <VenueSceneBoundary key={sceneIdentity} fallback={specializedFallback}>
        <Suspense
          fallback={
            <WorldLoadingIndicator title="Entering the Tech Hub" detail="Opening the workplace…" />
          }
        >
          <HarvestTechHubVenue venue={venue} />
        </Suspense>
      </VenueSceneBoundary>
    );
  }
  if (sceneKind === "mall" && props.locationId) {
    return (
      <VenueSceneBoundary key={sceneIdentity} fallback={specializedFallback}>
        <Suspense
          fallback={
            <WorldLoadingIndicator title="Entering the mall" detail="Opening the shopping hall…" />
          }
        >
          <OsunMallVenue locationId={props.locationId} locationName={props.locationName} />
        </Suspense>
      </VenueSceneBoundary>
    );
  }

  if (sceneKind === "clinic") {
    return (
      <VenueSceneBoundary key={sceneIdentity} fallback={specializedFallback}>
        <Suspense
          fallback={
            <WorldLoadingIndicator title="Opening the clinic" detail="Preparing the rooms…" />
          }
        >
          <ClinicVenue
            slug={props.slug}
            locationName={props.locationName}
            immersive={props.immersive}
          />
        </Suspense>
      </VenueSceneBoundary>
    );
  }

  if (sceneKind === "worship") {
    return (
      <VenueSceneBoundary key={sceneIdentity} fallback={specializedFallback}>
        <Suspense
          fallback={
            <WorldLoadingIndicator title="Entering the prayer hall" detail="Preparing the hall…" />
          }
        >
          <WorshipVenue slug={props.slug} locationName={props.locationName} />
        </Suspense>
      </VenueSceneBoundary>
    );
  }

  if (sceneKind === "campus") {
    return (
      <VenueSceneBoundary key={sceneIdentity} fallback={specializedFallback}>
        <Suspense
          fallback={
            <WorldLoadingIndicator title="Opening the campus" detail="Preparing the grounds…" />
          }
        >
          <SchoolCampusVenue
            slug={props.slug}
            locationName={props.locationName}
            immersive={props.immersive}
          />
        </Suspense>
      </VenueSceneBoundary>
    );
  }

  return <BasicLocationVenueScene key={sceneIdentity} {...props} />;
}
