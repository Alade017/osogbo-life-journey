import { createContext } from "react";
import type { WorldSceneRegistry } from "./world-scene-registry";
export const HostContext = createContext<WorldSceneRegistry | null>(null);
