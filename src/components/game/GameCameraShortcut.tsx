import { Camera } from "lucide-react";
import "./game-camera-shortcut.css";

/** Opens the in-game Camera app from any authenticated game location. */
export function GameCameraShortcut() {
  return (
    <button
      type="button"
      className="game-camera-shortcut"
      aria-label="Open camera"
      title="Open camera"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("osogbo-open-phone-app", { detail: { app: "Camera" } }),
        )
      }
    >
      <Camera size={19} strokeWidth={2.3} aria-hidden="true" />
    </button>
  );
}

export default GameCameraShortcut;
