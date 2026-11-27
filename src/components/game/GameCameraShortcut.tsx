import { useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { captureGameScreen } from "@/lib/camera-screen-capture";
import { savePhoto } from "@/lib/camera-gallery";
import "./game-camera-shortcut.css";

/** Holding the shortcut this long takes a screenshot of the 3D view instead of opening the app. */
export const CAMERA_HOLD_MS = 3000;

/** Opens the in-game Camera app on tap; press and hold for a screenshot of the current screen. */
export function GameCameraShortcut() {
  const timer = useRef<number | null>(null);
  const heldFired = useRef(false);

  const cancelHold = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => cancelHold, []);

  return (
    <button
      type="button"
      className="game-camera-shortcut"
      aria-label="Open camera"
      aria-describedby="game-camera-shortcut-hint"
      title="Open camera. Hold for a screenshot."
      onPointerDown={() => {
        heldFired.current = false;
        cancelHold();
        timer.current = window.setTimeout(async () => {
          timer.current = null;
          heldFired.current = true;
          const blob = await captureGameScreen();
          if (!blob) {
            toast.error("No 3D view to capture on this screen");
            return;
          }
          await savePhoto(blob, "Screenshot");
          navigator.vibrate?.(40);
          toast.success("Screenshot saved to your gallery");
        }, CAMERA_HOLD_MS);
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onClick={() => {
        if (heldFired.current) {
          heldFired.current = false;
          return;
        }
        window.dispatchEvent(
          new CustomEvent("osogbo-open-phone-app", { detail: { app: "Camera" } }),
        );
      }}
    >
      <Camera size={19} strokeWidth={2.3} aria-hidden="true" />
      <span id="game-camera-shortcut-hint" className="sr-only">
        Hold for 3 seconds to take a screenshot
      </span>
    </button>
  );
}

export default GameCameraShortcut;
