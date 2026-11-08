export type Vector3Tuple = [number, number, number];
export type CharacterAppearance3D = {
  skinTone?: string;
  hairColor?: string;
  hairStyle?: "short" | "afro" | "braids" | "locs" | "bald";
  outfitColor?: string;
};
export const DRACO_PATH = "/models/draco/";
export const DEVELOPMENT_MODELS = {
  room: "/models/rooms/development-room.glb",
} as const;
