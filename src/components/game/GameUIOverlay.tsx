// src/components/game/GameUIOverlay.tsx
import { FC } from "react";
import type { POI } from "@/store/mapSlice";

/**
 * Full‑screen UI overlay that sits above the 3D map canvas.
 * It contains a top header (game title) and a bottom drawer that shows details
 * for the currently selected POI.
 */
export const GameUIOverlay: FC<{ selectedPoi?: POI | null; onClose?: () => void }> = ({
  selectedPoi = null,
  onClose,
}) => {
  const handleClose = () => {
    onClose?.();
  };

  const handleStartMission = () => {
    if (selectedPoi) {
      // Replace with real mission start logic – for now we just log.
      console.log("Start mission for POI", selectedPoi.id);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
      {/* Top Header – clickable, so we re‑enable pointer events */}
      <header className="pointer-events-auto flex items-center bg-black/70 px-4 py-2 backdrop-blur-sm">
        <h1 className="text-xl font-extrabold text-white">Osogbo Explorer</h1>
      </header>

      {/* Bottom Drawer – only visible when a POI is selected */}
      {selectedPoi && (
        <section className="pointer-events-auto mx-4 mb-4 rounded-lg bg-black/80 p-4 backdrop-blur-md text-white">
          <h2 className="text-lg font-bold mb-2">{selectedPoi.name}</h2>
          <p className="mb-4 text-sm">{selectedPoi.description}</p>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 rounded bg-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-500 transition"
            >
              Close
            </button>
            <button
              onClick={handleStartMission}
              className="flex-1 rounded bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition"
            >
              Start Mission
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
