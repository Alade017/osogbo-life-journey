import { useEffect, useMemo, useRef } from "react";
import { Vector3, OrthographicCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { overviewDistrictId, overviewPlacePosition } from "./overview-district-routing";
import type { MapSearchTarget, MapEventChip, MapBillboardMarker } from "./MapCanvas";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import catalog from "@/data/osogbo-district-catalog.json";
import layout from "@/data/osogbo-overview-layout.json";
import { TownBrandBillboards3D } from "./TownBrandBillboards3D";
import { OverviewLandmarkModel } from "./OverviewLandmarkModel";
import { OverviewPropertyModel } from "./OverviewPropertyModel";

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
  searchTarget?: MapSearchTarget | null | undefined;
  selectedLandmarkId?: string | null | undefined;
  eventChips?: readonly MapEventChip[] | undefined;
  billboardMarkers?: readonly MapBillboardMarker[] | undefined;
  onSelectEvent?: ((id: string) => void) | undefined;
  onSelectBillboard?: ((id: string) => void) | undefined;
};

/** Static overview geometry only. Navigation coordinates never enter this scene. */
export function DistrictOverviewWorld({ availableLandmarkIds, onSelectDistrict, onSelectLandmark, searchTarget, selectedLandmarkId, eventChips = [], billboardMarkers = [], onSelectEvent, onSelectBillboard }: DistrictOverviewProps) {
  const available = useMemo(() => new Set(availableLandmarkIds), [availableLandmarkIds]);
  const { size, camera, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const initialized = useRef(false);
  const fit = Math.max(0.01, Math.min(size.width, size.height) / (Math.hypot(layout.meta.width, layout.meta.depth) * 1.12));
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera) || !controls.current) return;
    if (!initialized.current) {
      camera.position.set(75, 100, 95);
      controls.current.target.set(0, 0, 0);
      camera.zoom = fit;
      initialized.current = true;
    } else camera.zoom = Math.max(fit * 0.65, Math.min(fit * 5, camera.zoom));
    camera.updateProjectionMatrix();
    controls.current.update();
    invalidate();
  }, [camera, fit, invalidate]);
  useEffect(() => {
    const id = selectedLandmarkId ?? (typeof searchTarget === "string" ? searchTarget : searchTarget?.id);
    if (!id || !controls.current || !(camera instanceof OrthographicCamera)) return;
    const districtOnly = !selectedLandmarkId && typeof searchTarget === "object" && searchTarget?.kind === "district";
    const p = (districtOnly ? undefined : overviewPlacePosition(id)) ?? layout.districts.find(d => d.districtId === overviewDistrictId(id))?.center;
    if (!p) return;
    const next = new Vector3(...world(p));
    camera.position.add(next.clone().sub(controls.current.target));
    controls.current.target.copy(next);
    camera.zoom = fit * 2.5;
    camera.updateProjectionMatrix();
    controls.current.update();
    invalidate();
  }, [camera, fit, invalidate, searchTarget, selectedLandmarkId]);
  const brands = layout.districts.filter(d => d.districtId === "olaiya" || d.districtId === "ogo-oluwa")
    .map(d => ({ position: [d.bounds.x - layout.meta.width / 2 + 0.35, d.center.z - layout.meta.depth / 2] as const }));
  return (
    <>
      <OrbitControls ref={controls} makeDefault enableRotate enablePan enableZoom minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.25} minZoom={fit * 0.65} maxZoom={fit * 5} />
      <hemisphereLight args={["#fff7e8", "#657554", 2]} />
      <directionalLight position={[35, 65, 25]} intensity={2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[layout.meta.width, layout.meta.depth]} />
        <meshStandardMaterial color="#9aa77c" />
      </mesh>
      {layout.districts.map(d => {
        const district = catalog.districts.find(item => item.id === d.districtId);
        return (
          <mesh key={d.districtId} position={[...world(d.center)]} rotation={[-Math.PI / 2, 0, 0]}
            onClick={event => { event.stopPropagation(); if (event.delta < 6) onSelectDistrict(d.districtId); }}>
            <planeGeometry args={[d.bounds.width, d.bounds.depth]} />
            <meshStandardMaterial color={palette[district?.identity ?? ""] ?? "#b4ac92"} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
        );
      })}
      {layout.places.map(entry => {
        const district = catalog.districts.find(d => d.id === entry.districtId);
        return (
          <group key={entry.placeId} position={world(entry.position)} rotation={[0, entry.rotationY, 0]}
            onClick={event => { event.stopPropagation(); if (event.delta < 6 && entry.status === "existing-reference" && available.has(entry.placeId)) onSelectLandmark(entry.placeId); }}>
            <OverviewLandmarkModel profile={entry.profile} {...entry.footprint} color={palette[district?.identity ?? ""] ?? "#d4c7af"} />
          </group>
        );
      })}
      {[...layout.residentialParcels, ...layout.commercialParcels].map(parcel => (
        <group key={parcel.id} position={world(parcel.position)}>
          <OverviewPropertyModel profile={parcel.profile} {...parcel.footprint} />
        </group>
      ))}
      {layout.terrain.river.centerline.slice(1).map((end, index) => {
        const start = layout.terrain.river.centerline[index]!;
        const a = world(start), b = world(end);
        const dx = b[0] - a[0], dz = b[2] - a[2];
        return (
          <mesh key={index} position={[(a[0]+b[0])/2, 0.035, (a[2]+b[2])/2]} rotation={[0, Math.atan2(dx, dz), 0]}>
            <boxGeometry args={[layout.terrain.river.width, 0.04, Math.hypot(dx, dz) + layout.terrain.river.width / 2]} />
            <meshStandardMaterial color="#568b9b" roughness={0.35} />
          </mesh>
        );
      })}
      {eventChips.map(event => {
        const p = overviewPlacePosition(event.id);
        if (!p) return null;
        const [x, , z] = world(p);
        return <mesh key={event.id} position={[x, 3.8, z]} onClick={e => { e.stopPropagation(); if (e.delta < 6) onSelectEvent?.(event.id); }}><sphereGeometry args={[0.36, 12, 8]}/><meshStandardMaterial color="#e4a23c"/></mesh>;
      })}
      {billboardMarkers.map(marker => {
        const p = overviewPlacePosition(marker.landmarkId);
        if (!p) return null;
        const [x, , z] = world(p);
        return <mesh key={marker.campaignId} position={[x+0.7, 3.2, z]} onClick={e => { e.stopPropagation(); if (e.delta < 6) onSelectBillboard?.(marker.campaignId); }}><boxGeometry args={[0.8,0.5,0.15]}/><meshStandardMaterial color="#38577d"/></mesh>;
      })}
      <TownBrandBillboards3D positions={brands} cell={2} />
    </>
  );
}
