import { useEffect, useRef, useState } from "react";
import type { HouseRoomRendererProps } from "./house-room-contract";
import type { HomePlayCanvasRuntime, RoomLabel } from "./house-playcanvas-runtime";

export function HouseRoomPlayCanvas(props: HouseRoomRendererProps & { inputBlocked?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<HomePlayCanvasRuntime | null>(null);
  const latest = useRef(props);
  const [labels, setLabels] = useState<RoomLabel[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    latest.current = props;
    runtime.current?.update(props, props.inputBlocked ?? false);
  }, [props]);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let live = true;
    const abort = new AbortController();
    let instance: HomePlayCanvasRuntime | undefined;
    void (async () => {
      try {
        const { createHomePlayCanvas } = await import("./house-playcanvas-runtime");
        if (!live) return;
        instance = await createHomePlayCanvas(target, latest.current, {
          signal: abort.signal,
          labels: (value) => {
            if (live) setLabels(value);
          },
          fatal: (value) => {
            if (live) setError(value);
          },
        });
        if (!live) {
          instance.destroy();
          return;
        }
        runtime.current = instance;
        instance.update(latest.current, latest.current.inputBlocked ?? false);
        setReady(true);
      } catch (value) {
        if (live) setError(value instanceof Error ? value : new Error("The room could not start."));
      }
    })();
    return () => {
      live = false;
      abort.abort();
      instance?.destroy();
      runtime.current = null;
    };
  }, []);
  if (error) throw error;
  return (
    <div
      className="house-3d-scene house-playcanvas-scene"
      aria-label={`${props.houseTypeId.replaceAll("-", " ")} 3D room`}
    >
      <canvas ref={canvas} aria-label="Home interior" />
      {!ready && (
        <div className="house-3d-loading" role="status">
          Loading room…
        </div>
      )}
      {props.editMode &&
        labels.map((label) => (
          <button
            key={label.key}
            type="button"
            className="house-3d-slot-label house-playcanvas-label"
            style={{ left: label.x, top: label.y }}
            aria-label={label.text}
            title={label.text}
            disabled={props.inputBlocked || !ready}
            onPointerDown={(event) => {
              event.stopPropagation();
              runtime.current?.cancel();
            }}
            onClick={() => runtime.current?.select(label.hit)}
          >
            {label.hit.kind === "placement" ? "•••" : "+"}
          </button>
        ))}
      {props.editMode && (
        <div className="house-3d-arrange-hint" role="status">
          {props.moveEnabled
            ? "Drag an accessory to a blue spot"
            : "Finish saving before moving another accessory"}
        </div>
      )}
    </div>
  );
}
