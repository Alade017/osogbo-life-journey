import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { WorldScene } from "@/components/3d/WorldScene";
import {
  DEVELOPMENT_MODELS,
  type CharacterAnimationState,
  type SceneView,
  type CityLocationModel,
} from "@/types/models";
import {
  HAIR_COLORS,
  HAIR_STYLES_BY_GENDER,
  OUTFITS,
  SKIN_TONES,
  type Appearance,
} from "@/game/avatar-appearance";
import { characterAppearance3D } from "@/game/character-3d-appearance";
import { pageMeta } from "@/lib/seo";
const locations: CityLocationModel[] = [
  {
    id: "fixture-home",
    name: "Development room",
    modelPath: DEVELOPMENT_MODELS.building,
    position: [3, 0, -2],
    roomPath: DEVELOPMENT_MODELS.room,
  },
];
export const Route = createFileRoute("/_authenticated/_game/models")({
  head: () => pageMeta("3D model lab", "Inspect development assets and city/interior switching."),
  component: ModelLab,
});
function ModelLab() {
  const [view, setView] = useState<SceneView>({ kind: "city" });
  const [animation, setAnimation] = useState<CharacterAnimationState>("idle");
  const [appearance, setAppearance] = useState<Appearance>({
    skin: 1,
    hair: 1,
    hairColor: 0,
    outfit: 0,
  });
  const updateAppearance = (key: keyof Appearance, value: string) =>
    setAppearance((current) => ({ ...current, [key]: Number(value) }));
  return (
    <section>
      <h1 className="text-2xl font-bold">3D model lab</h1>
      <p>
        Development fixtures only. This preview does not change saved character data or grant
        access.
      </p>
      <div className="flex flex-wrap gap-3 py-3">
        <button type="button" onClick={() => setView({ kind: "city" })}>
          City
        </button>
        <button
          type="button"
          onClick={() =>
            setView({
              kind: "room",
              locationId: "fixture-home",
              modelPath: DEVELOPMENT_MODELS.room,
            })
          }
        >
          Room
        </button>
        <label>
          Animation
          <select
            aria-label="Preview animation"
            value={animation}
            onChange={(event) => setAnimation(event.target.value as CharacterAnimationState)}
          >
            {(["idle", "walk", "sit", "work", "wave"] as const).map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label>
          Skin tone
          <select
            aria-label="Preview skin tone"
            value={appearance.skin ?? 1}
            onChange={(event) => updateAppearance("skin", event.target.value)}
          >
            {SKIN_TONES.map((_, index) => (
              <option key={index} value={index}>
                Tone {index + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hair style
          <select
            aria-label="Preview hair style"
            value={appearance.hair ?? 1}
            onChange={(event) => updateAppearance("hair", event.target.value)}
          >
            {HAIR_STYLES_BY_GENDER["female"]?.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hair color
          <select
            aria-label="Preview hair color"
            value={appearance.hairColor ?? 0}
            onChange={(event) => updateAppearance("hairColor", event.target.value)}
          >
            {HAIR_COLORS.map((_, index) => (
              <option key={index} value={index}>
                Color {index + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Outfit
          <select
            aria-label="Preview outfit"
            value={appearance.outfit ?? 0}
            onChange={(event) => updateAppearance("outfit", event.target.value)}
          >
            {OUTFITS.map((_, index) => (
              <option key={index} value={index}>
                Outfit {index + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ height: "min(70vh,640px)", minHeight: 320 }}>
        <WorldScene
          view={view}
          character={{
            modelPath: DEVELOPMENT_MODELS.character,
            currentAnimation: animation,
            appearance: characterAppearance3D(appearance, "female"),
          }}
          cityPaths={[DEVELOPMENT_MODELS.city]}
          locations={locations}
          onLocationSelect={() =>
            setView({
              kind: "room",
              locationId: "fixture-home",
              modelPath: DEVELOPMENT_MODELS.room,
            })
          }
        />
      </div>
    </section>
  );
}
