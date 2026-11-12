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
  patterned = false,
}: {
  variant: BodyVariant;
  height: number;
  colours: ClothingColours;
  show: { shirt: boolean; trousers: boolean; shoes: boolean };
  patterned?: boolean;
}) {
  const body = useBodyGeometry(variant);
  const shirt = useGarment(body, "shirt");
  const trousers = useGarment(body, "trousers");
  const shoes = useGarment(body, "shoes");
  const cap = useGarment(body, "cap");
  return (
    <group name="garments">
      {show.shirt ? (
        <group name="tailored-shirt">
          <mesh geometry={shirt} scale={height} castShadow receiveShadow>
            <WorldMaterial color={colours.shirt} />
          </mesh>
          {/* A raised collar, centre placket, buttons and pocket make the top read as clothing. */}
          <mesh position={[0, height * 0.815, height * 0.018]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[height * 0.047, height * 0.009, 5, 16]} />
            <WorldMaterial color="#e9e1d2" />
          </mesh>
          <mesh position={[0, height * 0.665, height * 0.113]}>
            <boxGeometry args={[height * 0.012, height * 0.19, height * 0.008]} />
            <WorldMaterial color="#d8c8a8" />
          </mesh>
          {[0.72, 0.67, 0.62].map((y) => (
            <mesh key={y} position={[height * 0.009, height * y, height * 0.12]}>
              <sphereGeometry args={[height * 0.009, 6, 5]} />
              <WorldMaterial color="#e9e1d2" />
            </mesh>
          ))}
          <mesh position={[-height * 0.075, height * 0.65, height * 0.115]}>
            <boxGeometry args={[height * 0.075, height * 0.07, height * 0.009]} />
            <WorldMaterial color={colours.shirt} />
          </mesh>
          <mesh position={[-height * 0.075, height * 0.65, height * 0.121]}>
            <boxGeometry args={[height * 0.055, height * 0.003, height * 0.003]} />
            <WorldMaterial color="#d8c8a8" />
          </mesh>
          {patterned
            ? Array.from({ length: 12 }, (_, index) => {
                const column = index % 4;
                const row = Math.floor(index / 4);
                return (
                  <mesh
                    key={index}
                    position={[
                      height * (-0.075 + column * 0.05),
                      height * (0.57 + row * 0.055),
                      height * 0.116,
                    ]}
                    rotation={[0, 0, Math.PI / 4]}
                  >
                    <boxGeometry args={[height * 0.018, height * 0.018, height * 0.004]} />
                    <WorldMaterial color="#e9e2d0" />
                  </mesh>
                );
              })
            : null}
        </group>
      ) : null}
      {show.trousers ? (
        <group name="tailored-trousers">
          <mesh geometry={trousers} scale={height} castShadow receiveShadow>
            <WorldMaterial color={colours.trousers} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * height * 0.105, height * 0.29, height * 0.09]}>
              <boxGeometry args={[height * 0.006, height * 0.31, height * 0.004]} />
              <WorldMaterial color="#b8aa91" />
            </mesh>
          ))}
        </group>
      ) : null}
      {show.shoes ? (
        <group name="finished-shoes">
          <mesh geometry={shoes} scale={height} castShadow receiveShadow>
            <WorldMaterial color={colours.shoes} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * height * 0.075, height * 0.014, height * 0.025]}>
              <boxGeometry args={[height * 0.12, height * 0.018, height * 0.19]} />
              <WorldMaterial color="#242321" />
            </mesh>
          ))}
        </group>
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
