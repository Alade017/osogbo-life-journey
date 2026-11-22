import { Link } from "@tanstack/react-router";
import { BANK_INTERIORS } from "@/game/bank-interiors";
import { TRAVEL_MODES, TRAVEL_MODE_DETAILS, type TravelMode } from "@/lib/transport-service";
import { transportMapHref } from "@/lib/transport-park";
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { resolveVenueScene } from "@/lib/venue-scene-resolver";
import { VenueSceneBoundary } from "./VenueSceneBoundary";

import { venueSceneLoaders } from "./venue-scene-loaders";

const CivicServiceScene = lazy(venueSceneLoaders.civic);
const BankInteriorScene = lazy(venueSceneLoaders.bank);
const TransitParkScene = lazy(venueSceneLoaders.transport);
const HealthcareScene = lazy(venueSceneLoaders.healthcare);
const WorkplaceScene = lazy(venueSceneLoaders.workplace);
const RetailInteriorScene = lazy(venueSceneLoaders.retail);
const BukaInteriorScene = lazy(venueSceneLoaders.food);
const MarketTradingHall = lazy(venueSceneLoaders.market);
const ClinicVenue = lazy(venueSceneLoaders.clinic);
const OsunMallVenue = lazy(venueSceneLoaders.mall);
const WorshipVenue = lazy(venueSceneLoaders.worship);
const SchoolCampusVenue = lazy(venueSceneLoaders.campus);
import { Canvas } from "@react-three/fiber";
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

function VenueSceneReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function FixtureModel({
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
  onSelect: () => void;
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
      ...(latestResult.current !== undefined
        ? { result: latestResult.current }
        : {}),
    });
    return () => {
      onUnregister(furnitureKey, token);
    };
  }, [furnitureKey, supported, token, onRegister, onUnregister]);

  if (!supported) return null;

  return (
    <group position={[x, 0, z]}>
      <VenueSceneBoundary key={furnitureKey} onError={handleError}>
        <Suspense fallback={null}>
          <VenueFurnitureModel
            kind={fixture.kind}
            active={active}
            accentColor={accentColor}
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
          />
          <VenueSceneReady onReady={handleReady} />
        </Suspense>
      </VenueSceneBoundary>
    </group>
  );
}

function BasicLocationVenueScene({
  slug,
  locationName,
  design,
  onBrowseMarket,
  onBankServices,
}: {
  slug: string;
  locationName: string;
  design?: LocationVenueDesign;
  onBrowseMarket?: () => void;
  onBankServices?: () => void;
}) {
  const venue = useMemo(
    () => design ?? getLocationVenueDesign(slug, locationName),
    [design, slug, locationName],
  );
  const sceneKind = resolveVenueScene(slug, venue);
  const bankLayout = venue.bankInterior ? BANK_INTERIORS[venue.bankInterior] : null;
  const gameTime = useOptionalGameTime();
  // Shops with trading hours show their shutter open or closed for the current game hour.
  const shutterOpen = venue.environment?.trading
    ? isTradingOpen(gameTime?.simulation.gameTime.hour ?? 12, venue.environment.trading)
    : undefined;
  const [preferredMode, setPreferredMode] = useState<TravelMode | null>(null);
  const [selectedFixture, setSelectedFixture] = useState(venue.fixtures[0]?.id ?? "");
  const [sceneStatus, setSceneStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [slowLoading, setSlowLoading] = useState(false);
  const [furnitureRegistry, setFurnitureRegistry] =
    useState<FurnitureRegistry>(() => new Map());

  const furnitureReadiness = useMemo(() => {
    if (sceneKind !== "generic" || sceneStatus !== "ready") return null;
    return summarizeFurnitureReadiness(
      venue.fixtures,
      getFurnitureResults(furnitureRegistry),
    );
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

  const handleFurnitureUnregister = useCallback(
    (key: string, token: symbol) => {
      setFurnitureRegistry((current) => unregisterFurniture(current, key, token));
    },
    [],
  );
  const handleSceneReady = useCallback(() => {
    setSceneStatus((status) => (status === "loading" ? "ready" : status));
  }, []);
  const selected =
    venue.fixtures.find((fixture) => fixture.id === selectedFixture) ?? venue.fixtures[0];

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
    const timer = window.setTimeout(
      () => setSlowLoading(true),
      SCENE_START_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [sceneStatus]);

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
                        onSelect={() => setSelectedFixture(fixture.id)}
                        onRegister={handleFurnitureRegister}
                        onResult={handleFurnitureResult}
                        onUnregister={handleFurnitureUnregister}
                      />
                    ))}
                  </>
                )}
                <VenueSceneReady onReady={handleSceneReady} />
              </Suspense>
            </Canvas>
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
                The 3D preview did not start. The room guide below is ready to use.
              </p>
            </div>
          </div>
        )}
      </div>

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
        <p className="min-h-12 rounded-lg bg-muted/50 p-3 text-sm" aria-live="polite">
          {selected?.detail}
        </p>
      </div>
    </section>
  );
}

export function LocationVenueScene(props: {
  slug: string;
  locationName: string;
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
  if (sceneKind === "mall" && props.locationId)
    return (
      <Suspense
        key={sceneIdentity}
        fallback={
          <WorldLoadingIndicator title="Entering the mall" detail="Opening the shopping hall…" />
        }
      >
        <OsunMallVenue locationId={props.locationId} locationName={props.locationName} />
      </Suspense>
    );
  if (sceneKind === "clinic")
    return (
      <Suspense
        key={sceneIdentity}
        fallback={
          <WorldLoadingIndicator title="Opening the clinic" detail="Preparing the rooms…" />
        }
      >
        <ClinicVenue key={props.slug} slug={props.slug} locationName={props.locationName} />
      </Suspense>
    );
  if (sceneKind === "worship")
    return (
      <Suspense
        key={sceneIdentity}
        fallback={
          <WorldLoadingIndicator title="Entering the prayer hall" detail="Preparing the hall…" />
        }
      >
        <WorshipVenue key={props.slug} slug={props.slug} locationName={props.locationName} />
      </Suspense>
    );
  return sceneKind === "campus" ? (
    <Suspense
      key={sceneIdentity}
      fallback={
        <WorldLoadingIndicator title="Opening the campus" detail="Preparing the grounds…" />
      }
    >
      <SchoolCampusVenue key={props.slug} slug={props.slug} locationName={props.locationName} />
    </Suspense>
  ) : (
    <BasicLocationVenueScene key={sceneIdentity} {...props} />
  );
}
