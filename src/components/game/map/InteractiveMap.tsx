// src/components/game/map/InteractiveMap.tsx
import { Canvas } from "@react-three/fiber";
import { Suspense, useReducer } from "react";
import { ACESFilmicToneMapping } from "three";
import { MapCamera } from "./MapCamera";
import { MapPin } from "./MapPin";
import mapReducer, {
  initialMapState,
  setSelectedPoi,
  setHoveredPoiId,
  type POI,
} from "@/store/mapSlice";
import { MapLoading } from "./MapLoading";

// Sample POIs for Osogbo
const samplePois: POI[] = [
  {
    id: "sacred-grove",
    name: "Osun-Osogbo Sacred Grove",
    category: "Cultural",
    position: [0, 0, 0],
    description:
      "A UNESCO‑listed sacred forest with shrines, sculptures, and rituals dedicated to the river goddess Osun.",
  },
  {
    id: "ataoja-palace",
    name: "Ataoja Palace",
    category: "Historical",
    position: [5, 0, -3],
    description:
      "The traditional residence of the Ataoja, the monarch of Osogbo, showcasing Yoruba architecture.",
  },
  {
    id: "iro-park",
    name: "Iro Park",
    category: "Recreation",
    position: [-4, 0, 4],
    description: "A modern leisure park offering green space, playgrounds, and a tranquil lake.",
  },
];

export const InteractiveMap = () => {
  const [state, dispatch] = useReducer(mapReducer, initialMapState);
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        shadows
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
        camera={{ position: [0, 15, 15], fov: 45, near: 0.1, far: 200 }}
        className="w-full h-full"
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          castShadow
          intensity={0.9}
          position={[10, 20, 10]}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        {/* Ground plane */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#2c3e50" roughness={0.8} />
        </mesh>
        {/* Camera controller */}
        <MapCamera selectedPoi={state.selectedPoi} />
        {/* POI pins */}
        <Suspense fallback={<MapLoading />}>
          {samplePois.map((poi) => (
            <MapPin
              key={poi.id}
              poi={poi}
              selectedPoi={state.selectedPoi}
              hoveredPoiId={state.hoveredPoiId}
              onSelect={(selected) => dispatch(setSelectedPoi(selected))}
              onHover={(id) => dispatch(setHoveredPoiId(id))}
            />
          ))}
        </Suspense>
        {/* Optional debug controls – remove for production */}
        {/* <OrbitControls /> */}
      </Canvas>
    </div>
  );
};
