export type Vector3Tuple = [number, number, number];
export type ModelPart = { modelPath: string; socket?: string };
export type CharacterModel = {
  modelPath: string;
  parts?: readonly ModelPart[];
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: number | Vector3Tuple;
  currentAnimation?: string;
  animationNames?: Readonly<Record<string, string>>;
};
export type CityLocationModel = {
  id: string;
  name: string;
  modelPath: string;
  position: Vector3Tuple;
  scale?: number | Vector3Tuple;
  roomPath?: string;
};
export type SceneView = { kind: "city" } | { kind: "room"; locationId: string; modelPath: string };
export const DRACO_PATH = "/models/draco/";
export const DEVELOPMENT_MODELS = {
  character: "/models/characters/development-character.glb",
  city: "/models/city/development-city.glb",
  building: "/models/city/development-building.glb",
  room: "/models/rooms/development-room.glb",
} as const;
