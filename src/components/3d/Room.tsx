import type { ReactNode } from "react";
import { Model } from "./Model";
export function Room({ modelPath, children }: { modelPath: string; children?: ReactNode }) {
  return (
    <group>
      <Model modelPath={modelPath} />
      {children}
    </group>
  );
}
