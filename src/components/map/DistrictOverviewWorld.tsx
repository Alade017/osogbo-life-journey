import { useMemo } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import catalog from "@/data/osogbo-district-catalog.json";
import layout from "@/data/osogbo-overview-layout.json";
import { TownBrandBillboards3D } from "./TownBrandBillboards3D";
import { OverviewLandmarkModel } from "./OverviewLandmarkModel";

type Position = { x: number; z: number };
type Footprint = { width: number; depth: number };

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

function Block({ width, depth, height, color }: Footprint & { height: number; color: string }) {
  return (
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function House({ footprint }: { footprint: Footprint }) {
  const width = footprint.width * 0.68, depth = footprint.depth * 0.68;
  const height = Math.min(width, depth) * 0.48;
  return (
    <group>
      <Block width={width} depth={depth} height={height} color="#d9c4a5" />
      <mesh position={[0, height + width * 0.18, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[width * 0.76, width * 0.46, 4]} />
        <meshStandardMaterial color="#855b45" />
      </mesh>
    </group>
  );
}

export type DistrictOverviewProps = {
  availableLandmarkIds: readonly string[];
  onSelectDistrict: (id: string) => void;
  onSelectLandmark: (id: string) => void;
};

/** Static overview geometry only. Navigation coordinates never enter this scene. */
export function DistrictOverviewWorld({ availableLandmarkIds, onSelectDistrict, onSelectLandmark }: DistrictOverviewProps) {
  const available = useMemo(() => new Set(availableLandmarkIds), [availableLandmarkIds]);
  const { size } = useThree();
  const fit = Math.min(size.width / layout.meta.width, size.height / layout.meta.depth);
  const brands = layout.districts.filter(d => d.districtId === "olaiya" || d.districtId === "ogo-oluwa")
    .map(d => ({ position: [d.bounds.x - layout.meta.width / 2 + 0.35, d.center.z - layout.meta.depth / 2] as const }));
  return (
    <>
      <OrbitControls makeDefault enableRotate enablePan enableZoom minPolarAngle={0.25}
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
      {layout.residentialParcels.map(parcel => (
        <group key={parcel.id} position={world(parcel.position)}>
          <House footprint={parcel.footprint} />
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
      <TownBrandBillboards3D positions={brands} cell={2} />
    </>
  );
}
