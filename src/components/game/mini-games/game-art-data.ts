import type { Shape } from "@/lib/mini-games/whot";

/** Colours and names for the Whot shapes, shared by the card art and the shape picker. */
export const SHAPE_COLORS: Record<Shape, string> = {
  circle: "#e5484d",
  triangle: "#2f7de1",
  cross: "#1f9d55",
  square: "#e8a317",
  star: "#8b5cf6",
};

export const SHAPE_LABELS: Record<Shape, string> = {
  circle: "Circle",
  triangle: "Triangle",
  cross: "Cross",
  square: "Square",
  star: "Star",
};
