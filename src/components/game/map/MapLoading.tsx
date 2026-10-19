// src/components/game/map/MapLoading.tsx
import { FC } from "react";
import { Html } from "@react-three/drei";

/**
 * Simple animated loading indicator that appears inside the 3D scene while
 * assets are being lazy‑loaded. Uses Tailwind utilities for a smooth pulse.
 */
export const MapLoading: FC = () => (
  <Html center style={{ pointerEvents: "none" }}>
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="mt-2 text-sm text-primary font-medium">Loading map…</p>
    </div>
  </Html>
);
