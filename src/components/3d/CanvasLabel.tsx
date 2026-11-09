import { useEffect, useMemo } from "react";
import { CanvasTexture } from "three";

const LABEL_ASPECT = 4;
const LABEL_WIDTH_PX = 512;
const LABEL_HEIGHT_PX = 128;

/**
 * A flat text label drawn on a canvas with the device's own fonts. Unlike drei's Text,
 * it downloads no font files at runtime, so the 3D town works offline and loads less.
 */
export function CanvasLabel({
  text,
  position,
  fontSize,
  color = "#ffffff",
}: {
  text: string;
  position: [number, number, number];
  /** Height of the label in world units. */
  fontSize: number;
  color?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = LABEL_WIDTH_PX;
    canvas.height = LABEL_HEIGHT_PX;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = color;
      context.font = `700 ${LABEL_HEIGHT_PX * 0.66}px system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, LABEL_WIDTH_PX / 2, LABEL_HEIGHT_PX / 2, LABEL_WIDTH_PX * 0.94);
    }
    return new CanvasTexture(canvas);
  }, [text, color]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={position}>
      <planeGeometry args={[fontSize * LABEL_ASPECT, fontSize]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
