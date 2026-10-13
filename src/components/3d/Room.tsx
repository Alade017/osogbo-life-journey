import type { ReactNode } from "react";
import { Model } from "./CityMap";
export function Room({ modelPath, children }: { modelPath: string; children?: ReactNode }) {
  return (
    <group>
      <Model modelPath={modelPath} />
      {children}
    </group>
  );
}
