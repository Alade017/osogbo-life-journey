import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { WorldScene } from "@/components/3d/WorldScene";
import { DEVELOPMENT_MODELS, type SceneView, type CityLocationModel } from "@/types/models";
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
  const [animation, setAnimation] = useState("Idle");
  return (
    <section>
      <h1 className="text-2xl font-bold">3D model lab</h1>
      <p>
        Original development fixtures. This view does not move your saved character or grant
        building access.
      </p>
      <div className="flex gap-3 py-3">
        <button onClick={() => setView({ kind: "city" })}>City</button>
        <button
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
        <button onClick={() => setAnimation((value) => (value === "Idle" ? "Walk" : "Idle"))}>
          Toggle idle/walk
        </button>
      </div>
      <div style={{ height: "min(70vh,640px)", minHeight: 320 }}>
        <WorldScene
          view={view}
          character={{ modelPath: DEVELOPMENT_MODELS.character, currentAnimation: animation }}
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
