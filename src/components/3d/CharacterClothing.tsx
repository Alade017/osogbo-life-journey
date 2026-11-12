import { useMemo } from "react";
import { type BufferGeometry } from "three";
import { CHARACTER_CLOTH } from "./character-config";
import { garmentShell, GARMENT_BANDS, type GarmentName } from "./character-garments";
import { useBodyGeometry, type BodyVariant } from "./CharacterBody";
import { WorldMaterial } from "./WorldScene";

/** Shells are cut once per body and garment, then reused by every character that wears them. */
const shells = new WeakMap<BufferGeometry, Map<GarmentName, BufferGeometry>>();

function useGarment(body: BufferGeometry, name: GarmentName): BufferGeometry {
  return useMemo(() => {
    let cache = shells.get(body);
    if (!cache) {
      cache = new Map();
      shells.set(body, cache);
    }
    const cached = cache.get(name);
    if (cached) return cached;
    const shell = garmentShell(body, GARMENT_BANDS[name]);
    cache.set(name, shell);
    return shell;
  }, [body, name]);
}

export type ClothingColours = {
  shirt: string;
  trousers: string;
  shoes: string;
  /** Headwear colour, or null when nothing is worn on the head. */
  cap: string | null;
};

/**
 * The saved outfit, cut from the body's own surface so it fits every base body exactly. Set a
 * part to false when an equipped item provides its own model for that slot.
 */
export function CharacterClothing({
  variant,
  height,
  colours,
  show,
}: {
  variant: BodyVariant;
  height: number;
  colours: ClothingColours;
  show: { shirt: boolean; trousers: boolean; shoes: boolean };
}) {
  const body = useBodyGeometry(variant);
  const shirt = useGarment(body, "shirt");
  const trousers = useGarment(body, "trousers");
  const shoes = useGarment(body, "shoes");
  const cap = useGarment(body, "cap");
  return (
    <group name="garments">
      {show.shirt ? (
        <mesh geometry={shirt} scale={height} castShadow receiveShadow>
          <WorldMaterial color={colours.shirt} />
        </mesh>
      ) : null}
      {show.trousers ? (
        <mesh geometry={trousers} scale={height} castShadow receiveShadow>
          <WorldMaterial color={colours.trousers} />
        </mesh>
      ) : null}
      {show.shoes ? (
        <mesh geometry={shoes} scale={height} castShadow receiveShadow>
          <WorldMaterial color={colours.shoes} />
        </mesh>
      ) : null}
      {colours.cap ? (
        <mesh geometry={cap} scale={height} castShadow receiveShadow>
          <WorldMaterial color={colours.cap} />
        </mesh>
      ) : null}
    </group>
  );
}

/** The fabric colour for an outfit: the Adire base for patterned outfits, since the base bodies have no UVs. */
export function outfitFabric(outfitIndex: number, outfits: readonly string[]): string {
  return CHARACTER_CLOTH.patternedOutfits.includes(outfitIndex)
    ? CHARACTER_CLOTH.adire.base
    : outfits[outfitIndex]!;
}
