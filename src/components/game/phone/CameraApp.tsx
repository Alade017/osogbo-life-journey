import { useState } from "react";
import {
  Camera,
  Check,
  Image as ImageIcon,
  Monitor,
  RotateCcw,
  Smartphone,
  Sparkles,
  SwitchCamera,
  Zap,
} from "lucide-react";
import "./camera-app.css";

type CameraFacing = "rear" | "front";
type CaptureMode = "world" | "screen";

/**
 * UI prototype only. No getUserMedia, screen capture, file writes or camera permissions.
 * The capture state is deliberately simulated until the media pipeline is implemented.
 */
export function CameraApp() {
  const [facing, setFacing] = useState<CameraFacing>("rear");
  const [mode, setMode] = useState<CaptureMode>("world");
  const [captureCount, setCaptureCount] = useState(0);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const capture = () => {
    const nextCount = captureCount + 1;
    const label = mode === "screen" ? "Screen capture" : facing === "front" ? "Selfie" : "World photo";
    setCaptureCount(nextCount);
    setLastCapture(label);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
  };

  const isScreen = mode === "screen";

  return (
    <section className="phone-camera-app" aria-label="Camera">
      <header className="phone-camera-heading">
        <span className="phone-camera-heading-icon"><Camera aria-hidden="true" /></span>
        <div>
          <strong>Camera</strong>
          <p>Capture your moments around Osogbo</p>
        </div>
        <span className="phone-camera-count" aria-label={`${captureCount} captures`}>
          {captureCount}
        </span>
      </header>

      <div className="phone-camera-preview-wrap">
        <div
          className={[
            "phone-camera-viewfinder",
            isScreen ? "is-screen-mode" : "",
            facing === "front" && !isScreen ? "is-front-camera" : "",
            flash ? "is-capturing" : "",
          ].filter(Boolean).join(" ")}
          role="img"
          aria-label={isScreen ? "Illustrative screen capture preview" : `Illustrative ${facing} camera preview`}
        >
          <div className="phone-camera-viewfinder-top">
            <span><i /> {isScreen ? "SCREEN" : facing === "front" ? "FRONT CAMERA" : "WORLD CAMERA"}</span>
            <span className="phone-camera-resolution">UI PREVIEW</span>
          </div>
          <div className="phone-camera-scene">
            {isScreen ? (
              <div className="phone-camera-screen-art">
                <Monitor aria-hidden="true" />
                <strong>Game screen</strong>
                <small>Screenshot framing preview</small>
              </div>
            ) : (
              <>
                <div className="phone-camera-sky" />
                <div className="phone-camera-sun" />
                <div className="phone-camera-horizon" />
                <div className="phone-camera-building building-one" />
                <div className="phone-camera-building building-two" />
                <div className="phone-camera-building building-three" />
                <div className="phone-camera-person" />
                <span className="phone-camera-location">OSOGBO · NIGERIA</span>
              </>
            )}
            <span className="phone-camera-focus" />
          </div>
          <div className="phone-camera-viewfinder-bottom">
            <span>{isScreen ? "Capture what is on screen" : facing === "front" ? "Self portrait" : "Explore your surroundings"}</span>
            <span>1×</span>
          </div>
        </div>
        <p className="phone-camera-prototype-note">
          <Sparkles size={13} aria-hidden="true" />
          Preview interface only — device camera and screen capture are not connected yet.
        </p>
      </div>

      <div className="phone-camera-modes" role="group" aria-label="Capture mode">
        <button type="button" className={!isScreen ? "is-active" : ""} aria-pressed={!isScreen} onClick={() => setMode("world")}>
          <Camera size={15} aria-hidden="true" /> Photo
        </button>
        <button type="button" className={isScreen ? "is-active" : ""} aria-pressed={isScreen} onClick={() => setMode("screen")}>
          <Monitor size={15} aria-hidden="true" /> Screenshot
        </button>
      </div>

      <div className="phone-camera-controls">
        <button
          type="button"
          className="phone-camera-side-control"
          aria-label="Open captured previews"
          disabled={!lastCapture}
        >
          <ImageIcon aria-hidden="true" />
          <small>{captureCount ? "Preview" : "Gallery"}</small>
        </button>
        <button type="button" className="phone-camera-shutter" onClick={capture} aria-label={isScreen ? "Capture screenshot preview" : "Capture photo preview"}>
          <span />
        </button>
        <button
          type="button"
          className="phone-camera-side-control"
          onClick={() => setFacing((current) => current === "rear" ? "front" : "rear")}
          disabled={isScreen}
          aria-label={facing === "rear" ? "Switch to front camera" : "Switch to rear camera"}
        >
          <SwitchCamera aria-hidden="true" />
          <small>{facing === "rear" ? "Front" : "Rear"}</small>
        </button>
      </div>

      <div className="phone-camera-footer">
        <span><Zap size={14} aria-hidden="true" /> Flash off</span>
        <span><Smartphone size={14} aria-hidden="true" /> {isScreen ? "Screen mode" : facing === "front" ? "Front lens" : "Rear lens"}</span>
        <button type="button" onClick={() => { setCaptureCount(0); setLastCapture(null); }} disabled={!captureCount}>
          <RotateCcw size={13} aria-hidden="true" /> Reset
        </button>
      </div>

      {lastCapture && (
        <div className="phone-camera-captured" role="status" aria-live="polite">
          <span className="phone-camera-captured-icon"><Check size={16} aria-hidden="true" /></span>
          <span><strong>{lastCapture} preview captured</strong><small>Capture #{captureCount} · UI state only, not saved as a file</small></span>
        </div>
      )}
    </section>
  );
}

export default CameraApp;
