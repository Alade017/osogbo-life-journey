import { useEffect, useRef, useState } from "react";
import type {
  MapBillboardMarker,
  MapPlayerLocation,
  MapProperty,
} from "@/components/map/MapCanvas";

type Place = {
  id: string;
  label: string;
  category: string;
  grid: { x: number; z: number };
};

export type PhaserMapData = {
  places: readonly Place[];
  properties: readonly MapProperty[] | undefined;
  playerLocation: MapPlayerLocation | null | undefined;
  billboardMarkers: readonly MapBillboardMarker[];
};

export type PhaserMapCallbacks = {
  onSelectLandmark: (id: string) => void;
  onSelectDistrict: (id: string) => void;
  onSelectBillboard: ((campaignId: string) => void) | undefined;
};

export type PhaserMapSceneHandle = {
  drawMap: (data: PhaserMapData) => void;
  setZoom: (factor: number) => void;
  resetView: () => void;
};

type Props = PhaserMapData &
  PhaserMapCallbacks & {
    onReady: () => void;
    onUnavailable: () => void;
  };

/** React owns lifecycle and state; Phaser is loaded only in the browser effect. */
export function PhaserMapSurface({
  places,
  properties,
  playerLocation,
  billboardMarkers,
  onSelectLandmark,
  onSelectDistrict,
  onSelectBillboard,
  onReady,
  onUnavailable,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PhaserMapSceneHandle | null>(null);
  const latestDataRef = useRef<PhaserMapData>({
    places,
    properties,
    playerLocation,
    billboardMarkers,
  });
  const callbacksRef = useRef<PhaserMapCallbacks>({
    onSelectLandmark,
    onSelectDistrict,
    onSelectBillboard,
  });
  const [zoom, setZoom] = useState(1);

  latestDataRef.current = { places, properties, playerLocation, billboardMarkers };
  callbacksRef.current = { onSelectLandmark, onSelectDistrict, onSelectBillboard };

  useEffect(() => {
    if (typeof window === "undefined" || !hostRef.current) {
      onUnavailable();
      return;
    }

    let active = true;
    let game: import("phaser").Game | null = null;
    let canvas: HTMLCanvasElement | null = null;
    const host = hostRef.current;

    void import("@/components/map/phaser-town-map")
      .then(({ createPhaserTownMap }) => {
        if (!active) return;
        const mounted = createPhaserTownMap({
          host,
          dataRef: latestDataRef,
          callbacksRef,
          onReady: () => {
            if (active) onReady();
          },
          onGame: (instance, scene) => {
            if (!active) {
              instance.destroy(true);
              return;
            }
            game = instance;
            sceneRef.current = scene;
            canvas = instance.canvas;
          },
        });
        if (!mounted && active) onUnavailable();
      })
      .catch(() => {
        if (active) onUnavailable();
      });

    return () => {
      active = false;
      sceneRef.current = null;
      if (game) game.destroy(true);
      if (canvas?.parentNode === host) canvas.remove();
      host.replaceChildren();
    };
  }, [onReady, onUnavailable]);

  useEffect(() => {
    sceneRef.current?.drawMap(latestDataRef.current);
  }, [places, properties, playerLocation, billboardMarkers]);

  const changeZoom = (factor: number) => {
    sceneRef.current?.setZoom(factor);
    setZoom((current) => Math.min(2.4, Math.max(0.8, current * factor)));
  };

  const resetView = () => {
    sceneRef.current?.resetView();
    setZoom(1);
  };

  return (
    <div className="town-map-phaser-layer">
      <div className="town-map-phaser-host" ref={hostRef} aria-hidden="true" />
      <div className="town-map-zoom-controls" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" onClick={() => changeZoom(1.2)} title="Zoom in">
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => changeZoom(1 / 1.2)}
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset map view"
          onClick={resetView}
          title="Reset map view"
        >
          ⌂
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        Map zoom {Math.round(zoom * 100)} percent
      </span>
    </div>
  );
}
