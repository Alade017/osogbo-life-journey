import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { SceneHtml } from "@/components/3d/SceneHtml";
import { Vector3, OrthographicCamera } from "three";
import { overviewDistrictId, overviewPlacePosition } from "./overview-district-routing";
import type { MapSearchTarget, MapEventChip, MapBillboardMarker, MapProperty } from "./MapCanvas";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { MapPointerGesture } from "./map-pointer-gesture";
import catalog from "@/data/osogbo-district-catalog.json";
import layout from "@/data/osogbo-overview-layout.json";
import { TownBrandBillboards3D } from "./TownBrandBillboards3D";
import { OverviewLandmarkModel } from "./OverviewLandmarkModel";
import { OverviewPropertyModel } from "./OverviewPropertyModel";
import { OverviewLandscape } from "./OverviewLandscape";
import { OverviewRiver } from "./OverviewRiver";
import { OverviewTerrain } from "./OverviewTerrain";

type Position = { x: number; z: number };

const world = ({ x, z }: Position): [number, number, number] => [
  x - layout.meta.width / 2, 0, z - layout.meta.depth / 2,
];
const palette: Record<string, string> = {
  "commercial-transit": "#c5a478", "royal-heritage": "#b68c62",
  "traditional-residential": "#b9a17e", "modern-commercial": "#b4b9ae",
  "mixed-transit": "#c0b69c", "automotive-transit": "#a99b82",
  administrative: "#c5c7ba", "industrial-education": "#b7b49b",
  "cultural-nature": "#789366", "residential-education": "#b5ac88",
};

export type DistrictOverviewProps = {
  availableLandmarkIds: readonly string[];
  onSelectDistrict: (id: string) => void;
  onSelectLandmark: (id: string) => void;
  onSelectUnavailable?: ((id: string, reason: "locked" | "reserved") => void) | undefined;
  searchTarget?: MapSearchTarget | null | undefined;
  selectedLandmarkId?: string | null | undefined;
  resetVersion?: number | undefined;
  zoomRequest?: { step: number; version: number } | undefined;
  eventChips?: readonly MapEventChip[] | undefined;
  billboardMarkers?: readonly MapBillboardMarker[] | undefined;
  onSelectEvent?: ((id: string) => void) | undefined;
  onSelectBillboard?: ((id: string) => void) | undefined;
  properties?: readonly MapProperty[] | undefined;
  onSelectProperty?: ((property: MapProperty) => void) | undefined;
};

/** Static overview geometry only. Navigation coordinates never enter this scene. */
export function DistrictOverviewWorld({ availableLandmarkIds, onSelectDistrict, onSelectLandmark, onSelectUnavailable, searchTarget, selectedLandmarkId, resetVersion = 0, zoomRequest, eventChips = [], billboardMarkers = [], onSelectEvent, onSelectBillboard, properties = [], onSelectProperty }: DistrictOverviewProps) {
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(null);
  const available = useMemo(() => new Set(availableLandmarkIds), [availableLandmarkIds]);
  const propertyByParcel = useMemo(() => {
    const result = new Map<string, MapProperty>();
    for (const anchor of layout.housingListingAnchors) {
      const matches = properties.filter(p => p.houseTypeId === anchor.houseTypeId);
      if (matches.length === 1 && matches[0]) result.set(anchor.parcelId, matches[0]);
    }
    return result;
  }, [properties]);
  const { size, camera, invalidate, gl } = useThree();
  const gesture = useRef(new MapPointerGesture());
  useEffect(() => {
    const canvas = gl.domElement;
    const down = (e: PointerEvent) => gesture.current.down(e.pointerId, e.clientX, e.clientY);
    const move = (e: PointerEvent) => gesture.current.move(e.clientX, e.clientY);
    const up = (e: PointerEvent) => gesture.current.up(e.pointerId);
    const cancel = (e: PointerEvent) => gesture.current.cancel(e.pointerId);
    canvas.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    return () => {
      canvas.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
    };
  }, [gl]);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const initialized = useRef(false);
  const previousFit = useRef(0);
  const panCorrection = useMemo(() => new Vector3(), []);
  const lastReset = useRef(0);
  const lastZoom = useRef(0);
  const lastFocus = useRef<{ target: typeof searchTarget; landmark: typeof selectedLandmarkId }>({ target: undefined, landmark: undefined });
  const [focusedDistrict, setFocusedDistrict] = useState<string | null>(null);
  const fit = Math.max(0.01, Math.min(size.width, size.height) / (Math.hypot(layout.meta.width, layout.meta.depth) * 1.12));
  const constrainCamera = useCallback(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const target = orbit.target;
    panCorrection.set(
      Math.max(-layout.meta.width / 2, Math.min(layout.meta.width / 2, target.x)) - target.x,
      -target.y,
      Math.max(-layout.meta.depth / 2, Math.min(layout.meta.depth / 2, target.z)) - target.z,
    );
    if (panCorrection.lengthSq() > 0) {
      target.add(panCorrection);
      camera.position.add(panCorrection);
    }
    invalidate();
  }, [camera, invalidate, panCorrection]);
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera) || !controls.current) return;
    if (!initialized.current) {
      camera.position.set(75, 100, 95);
      controls.current.target.set(0, 0, 0);
      camera.zoom = fit;
      initialized.current = true;
    } else {
      const relativeZoom = previousFit.current > 0 ? camera.zoom / previousFit.current : 1;
      camera.zoom = Math.max(fit, Math.min(fit * 5, fit * relativeZoom));
    }
    previousFit.current = fit;
    camera.updateProjectionMatrix();
    controls.current.update();
    invalidate();
  }, [camera, fit, invalidate]);
  useEffect(() => {
    if (!controls.current || !(camera instanceof OrthographicCamera)) return;
    const previous = lastFocus.current;
    const changedTarget = previous.target !== searchTarget;
    const changedLandmark = previous.landmark !== selectedLandmarkId;
    lastFocus.current = { target: searchTarget, landmark: selectedLandmarkId };
    if (lastReset.current !== resetVersion) {
      lastReset.current = resetVersion;
      camera.position.set(75,100,95);
      controls.current.target.set(0,0,0);
      camera.zoom = fit;
      setFocusedDistrict(null);
    } else {
      const target = changedTarget ? searchTarget : changedLandmark && selectedLandmarkId ? {id:selectedLandmarkId,kind:"landmark"} : null;
      if (!target) return;
      const id = typeof target === "string" ? target : target.id;
      const districtOnly = typeof target === "object" && target.kind === "district";
      const districtId = districtOnly ? overviewDistrictId(id) : overviewDistrictId(id, id);
      const p = (districtOnly ? undefined : overviewPlacePosition(id)) ?? layout.districts.find(d => d.districtId === districtId)?.center;
      if (!p) return;
      const next = new Vector3(...world(p));
      camera.position.add(next.clone().sub(controls.current.target));
      controls.current.target.copy(next);
      camera.zoom = fit * 2.5;
      setFocusedDistrict(districtId ?? layout.places.find(p => p.placeId === id)?.districtId ?? null);
    }
    camera.updateProjectionMatrix();
    controls.current.update();
    invalidate();
  }, [camera, fit, invalidate, searchTarget, selectedLandmarkId, resetVersion]);
  useEffect(() => {
    if (!zoomRequest || zoomRequest.version === lastZoom.current || !(camera instanceof OrthographicCamera)) return;
    lastZoom.current = zoomRequest.version;
    camera.zoom = Math.max(fit, Math.min(fit * 5, camera.zoom * Math.pow(1.25, zoomRequest.step)));
    camera.updateProjectionMatrix();
    controls.current?.update();
    invalidate();
  }, [camera, fit, invalidate, zoomRequest]);
  const brands = layout.districts.filter(d => d.districtId === "olaiya" || d.districtId === "ogo-oluwa")
    .map(d => ({ position: [d.bounds.x - layout.meta.width / 2 + 0.35, d.center.z - layout.meta.depth / 2] as const }));
  return (
    <>
      <OrbitControls ref={controls} makeDefault enableRotate enablePan enableZoom minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.25} minZoom={fit} maxZoom={fit * 5} onChange={constrainCamera} />
      <hemisphereLight args={["#fff7e8", "#657554", 2]} />
      <directionalLight position={[35, 65, 25]} intensity={2} />
      <OverviewTerrain />
      {layout.districts.map(d => {
        const district = catalog.districts.find(item => item.id === d.districtId);
        return (
          <group key={d.districtId} name={`overview-district:${d.districtId}`}>
          <mesh position={[...world(d.center)]} rotation={[-Math.PI / 2, 0, 0]}
            onClick={event => { event.stopPropagation(); if (!gesture.current.moved && event.delta < 6) onSelectDistrict(d.districtId); }}>
            <planeGeometry args={[d.bounds.width, d.bounds.depth]} />
            <meshStandardMaterial color={palette[district?.identity ?? ""] ?? "#b4ac92"} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
          {(size.width >= 640 || (focusedDistrict ? focusedDistrict === d.districtId : d.districtId === "olaiya" || d.districtId === "oja-oba" || d.districtId === "ogo-oluwa")) && <SceneHtml position={[d.center.x - layout.meta.width / 2, 0.35, d.bounds.z + 0.5 - layout.meta.depth / 2]} center pointerEvents="none" zIndexRange={[10, 0]}>
            <span className="district-label">{district?.name}</span>
          </SceneHtml>}
          </group>
        );
      })}
      {layout.places.map(entry => {
        const district = catalog.districts.find(d => d.id === entry.districtId);
        const place = catalog.places.find(p => p.id === entry.placeId) ?? catalog.pendingLandmarks.find(p => p.id === entry.placeId);
        return (
          <group key={entry.placeId} name={`overview-landmark:${entry.placeId}`} position={world(entry.position)} rotation={[0, entry.rotationY, 0]}
            onPointerOver={event => { event.stopPropagation(); setHoveredPlace(entry.placeId); }}
            onPointerOut={() => setHoveredPlace(old => old === entry.placeId ? null : old)}
            onClick={event => { event.stopPropagation(); if (gesture.current.moved || event.delta >= 6) return; if (entry.status === "existing-reference" && available.has(entry.placeId)) onSelectLandmark(entry.placeId); else onSelectUnavailable?.(entry.placeId, entry.status === "reserved" ? "reserved" : "locked"); }}>
            <OverviewLandmarkModel profile={entry.profile} {...entry.footprint} color={palette[district?.identity ?? ""] ?? "#d4c7af"} />
            {place && (hoveredPlace === entry.placeId || selectedLandmarkId === entry.placeId) && (
              <SceneHtml position={[0, Math.min(entry.footprint.width, entry.footprint.depth) * 0.85, 0]} center pointerEvents="none" zIndexRange={[20, 11]}>
                <span className="district-label">{place.label}{entry.status === "reserved" ? " · Not yet open" : !available.has(entry.placeId) ? " · Locked" : ""}</span>
              </SceneHtml>
            )}
          </group>
        );
      })}
      {[...layout.residentialParcels, ...layout.commercialParcels].map(parcel => {
        const property = propertyByParcel.get(parcel.id);
        const color = property?.status === "overdue" || property?.status === "rent_due" ? "#b96840" : property?.status === "vacant" ? "#8c9692" : "#327c59";
        return (
          <group key={parcel.id} position={world(parcel.position)}
            onClick={event => { if (property) { event.stopPropagation(); if (!gesture.current.moved && event.delta < 6) onSelectProperty?.(property); } }}>
            <OverviewPropertyModel profile={parcel.profile} {...parcel.footprint} />
            {property && <mesh position={[0, Math.min(parcel.footprint.width, parcel.footprint.depth) * 0.85, 0]}>
              <sphereGeometry args={[0.32, 12, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>}
          </group>
        );
      })}
      <OverviewRiver />
      {eventChips.map(event => {
        const p = overviewPlacePosition(event.id);
        if (!p) return null;
        const [x, , z] = world(p);
        return <mesh key={event.id} position={[x, 3.8, z]} onClick={e => { e.stopPropagation(); if (!gesture.current.moved && e.delta < 6) onSelectEvent?.(event.id); }}><sphereGeometry args={[0.36, 12, 8]}/><meshStandardMaterial color="#e4a23c"/></mesh>;
      })}
      {billboardMarkers.map(marker => {
        const p = overviewPlacePosition(marker.landmarkId);
        if (!p) return null;
        const [x, , z] = world(p);
        return <mesh key={marker.campaignId} position={[x+0.7, 3.2, z]} onClick={e => { e.stopPropagation(); if (!gesture.current.moved && e.delta < 6) onSelectBillboard?.(marker.campaignId); }}><boxGeometry args={[0.8,0.5,0.15]}/><meshStandardMaterial color="#38577d"/></mesh>;
      })}
      <OverviewLandscape />
      <TownBrandBillboards3D positions={brands} cell={2} />
    </>
  );
}
