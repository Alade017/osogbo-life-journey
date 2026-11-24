import { useState } from "react";
import { showroomDestinations, type ShowroomLandmarkId } from "@/data/showroom-destinations";
import { getShowroomModels } from "@/data/showroom-models";

export function ShowroomPreviewPanel() {
  const [selected, setSelected] = useState<ShowroomLandmarkId | null>(null);
  return (
    <details className="rounded-lg border bg-background p-3">
      <summary className="cursor-pointer text-sm font-medium">Showroom previews</summary>
      <p className="my-2 text-xs text-muted-foreground">
        Browse planned showrooms. Preview only; your location, inventory and balance will not change.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Showrooms">
        {(Object.keys(showroomDestinations) as ShowroomLandmarkId[]).map((id) => (
          <button key={id} type="button" aria-pressed={selected === id}
            className="rounded-full border px-3 py-1.5 text-xs aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            onClick={() => setSelected(id)}>
            {showroomDestinations[id].name}
          </button>
        ))}
      </div>
      {selected && (
        <section className="mt-3" aria-label={showroomDestinations[selected].name}>
          <h3 className="text-sm font-semibold">{showroomDestinations[selected].name}</h3>
          <p className="text-xs text-muted-foreground">{showroomDestinations[selected].description}</p>
          <ul className="mt-2 grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {getShowroomModels(selected).map((model) => (
              <li key={model.id} className="rounded border px-2 py-1 text-xs capitalize">{model.label}</li>
            ))}
          </ul>
        </section>
      )}
    </details>
  );
}
