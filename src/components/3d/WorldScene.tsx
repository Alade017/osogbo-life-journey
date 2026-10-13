import type { ReactNode } from "react";
import { Scene } from "./Scene";
import { CityMap } from "./CityMap";
import { Room } from "./Room";
import { Character } from "./Character";
import type { CharacterModel, CityLocationModel, SceneView } from "@/types/models";
export function WorldScene({
  view,
  character,
  cityPaths,
  locations,
  onLocationSelect,
  children,
}: {
  view: SceneView;
  character: CharacterModel;
  cityPaths: readonly string[];
  locations: readonly CityLocationModel[];
  onLocationSelect: (id: string) => void;
  children?: ReactNode;
}) {
  return (
    <Scene animated={!!character.currentAnimation}>
      {view.kind === "city" ? (
        <CityMap modelPaths={cityPaths} locations={locations} onLocationSelect={onLocationSelect} />
      ) : (
        <Room modelPath={view.modelPath} />
      )}
      <Character {...character} />
      {children}
    </Scene>
  );
}
