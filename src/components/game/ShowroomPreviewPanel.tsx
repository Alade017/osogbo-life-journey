import { lazy, Suspense, useState } from "react";

const MotorsScene = lazy(() => import("./MotorsShowroomScene").then((module) => ({ default: module.MotorsShowroomScene })));
const ProductViewer = lazy(() => import("./ShowroomProductViewer").then((module) => ({ default: module.ShowroomProductViewer })));
import { showroomDestinations, type ShowroomLandmarkId } from "@/data/showroom-destinations";
import { getShowroomModels } from "@/data/showroom-models";

export function ShowroomPreviewPanel() {
  const [selected, setSelected] = useState<ShowroomLandmarkId | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const model = selected && modelId ? getShowroomModels(selected).find((item) => item.id === modelId) : undefined;
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded-lg border bg-background p-3">
      <summary className="cursor-pointer text-sm font-medium">Showroom previews</summary>
      <p className="my-2 text-xs text-muted-foreground">
        Browse planned showrooms. Preview only; your location, inventory and balance will not change.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Showrooms">
        {(Object.keys(showroomDestinations) as ShowroomLandmarkId[]).map((id) => (
          <button key={id} type="button" aria-pressed={selected === id}
            className="rounded-full border px-3 py-1.5 text-xs aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            onClick={() => { setSelected(id); setModelId(null); }}>
            {showroomDestinations[id].name}
          </button>
        ))}
      </div>
      {selected && (
        <section className="mt-3" aria-label={showroomDestinations[selected].name}>
          <h3 className="text-sm font-semibold">{showroomDestinations[selected].name}</h3>
          <p className="text-xs text-muted-foreground">{showroomDestinations[selected].description}</p>
          {open && selected === "fuel-station" && (
            <Suspense fallback={<p role="status" className="p-2 text-xs">Opening showroom…</p>}>
              <MotorsScene models={getShowroomModels(selected)} onSelect={setModelId} />
            </Suspense>
          )}
          <ul className="mt-2 grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {getShowroomModels(selected).map((model) => (
              <li key={model.id}><button type="button" aria-pressed={modelId === model.id} onClick={() => setModelId(model.id)} className="w-full rounded-full border px-3 py-1.5 text-left text-xs capitalize aria-pressed:bg-primary aria-pressed:text-primary-foreground">{model.label}</button></li>
            ))}
          </ul>
          {open && model && (
            <Suspense fallback={<p role="status" className="p-2 text-xs">Opening 3D viewer…</p>}>
              <ProductViewer key={model.id} url={model.url} label={model.label} />
            </Suspense>
          )}
        </section>
      )}
    </details>
  );
}
