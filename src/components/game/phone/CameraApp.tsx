import { useEffect, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, Monitor, SwitchCamera, Trash2, X } from "lucide-react";
import { captureGameScreen } from "@/lib/camera-screen-capture";
import { deletePhoto, listPhotos, savePhoto, type CapturedPhoto } from "@/lib/camera-gallery";
import "./camera-app.css";

type CameraFacing = "rear" | "front";
type CaptureMode = "photo" | "screen";
type LiveState = "starting" | "live" | "unavailable";

/** Real device camera preview and capture, with an on-device gallery. Screenshots read the 3D view. */
export function CameraApp() {
  const [facing, setFacing] = useState<CameraFacing>("rear");
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [live, setLive] = useState<LiveState>("starting");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isScreen = mode === "screen";

  const refreshPhotos = () => {
    void listPhotos().then(setPhotos);
  };

  useEffect(() => {
    let cancelled = false;
    void listPhotos().then((items) => {
      if (!cancelled) setPhotos(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const next: Record<string, string> = {};
    for (const photo of photos) next[photo.id] = URL.createObjectURL(photo.blob);
    setThumbs(next);
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
  }, [photos]);

  useEffect(() => {
    if (isScreen) return;
    const devices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!devices?.getUserMedia) {
      setLive("unavailable");
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    setLive("starting");
    devices
      .getUserMedia({ video: { facingMode: facing === "front" ? "user" : "environment" } })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        if (videoRef.current) videoRef.current.srcObject = media;
        setLive("live");
      })
      .catch(() => {
        if (!cancelled) setLive("unavailable");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [facing, isScreen]);

  const flashOnce = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (live !== "live" || !video || !video.videoWidth) {
      setMessage("The camera is not available on this device. Try a screenshot instead.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9),
    );
    if (!blob) {
      setMessage("That photo could not be saved. Please try again.");
      return;
    }
    await savePhoto(blob, facing === "front" ? "Selfie" : "Photo");
    flashOnce();
    setMessage(`${facing === "front" ? "Selfie" : "Photo"} saved to your gallery`);
    refreshPhotos();
  };

  const captureScreen = async () => {
    const blob = await captureGameScreen();
    if (!blob) {
      setMessage("There is no 3D view on this screen to capture.");
      return;
    }
    await savePhoto(blob, "Screenshot");
    flashOnce();
    setMessage("Screenshot saved to your gallery");
    refreshPhotos();
  };

  const remove = async (id: string) => {
    await deletePhoto(id);
    refreshPhotos();
  };

  return (
    <section className="phone-camera-app" aria-label="Camera">
      <header className="phone-camera-heading">
        <span className="phone-camera-heading-icon">
          <Camera aria-hidden="true" />
        </span>
        <div>
          <strong>Camera</strong>
          <p>Take photos around Osogbo</p>
        </div>
        <span className="phone-camera-count" aria-label={`${photos.length} captures`}>
          {photos.length}
        </span>
      </header>

      <div className="phone-camera-preview-wrap">
        <div
          className={[
            "phone-camera-viewfinder",
            isScreen ? "is-screen-mode" : "",
            facing === "front" && !isScreen ? "is-front-camera" : "",
            flash ? "is-capturing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="phone-camera-viewfinder-top">
            <span>
              <i /> {isScreen ? "SCREEN" : facing === "front" ? "FRONT CAMERA" : "CAMERA"}
            </span>
            <span className="phone-camera-resolution">
              {isScreen ? "3D VIEW" : live === "live" ? "LIVE" : live === "starting" ? "…" : "OFF"}
            </span>
          </div>

          <div className="phone-camera-scene">
            {isScreen ? (
              <div className="phone-camera-screen-art">
                <Monitor aria-hidden="true" />
                <strong>Game screen</strong>
                <small>Captures the 3D view on this screen</small>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="phone-camera-video"
                  autoPlay
                  playsInline
                  muted
                  aria-label={`${facing} camera live view`}
                  hidden={live !== "live"}
                />
                {live !== "live" && (
                  <div className="phone-camera-screen-art">
                    <Camera aria-hidden="true" />
                    <strong>
                      {live === "starting" ? "Starting camera…" : "Camera not available"}
                    </strong>
                    <small>Allow camera access in your browser to take photos.</small>
                  </div>
                )}
              </>
            )}
            <span className="phone-camera-focus" />
          </div>

          <div className="phone-camera-viewfinder-bottom">
            <span>{isScreen ? "Capture what is on screen" : "Explore your surroundings"}</span>
            <span>1×</span>
          </div>
        </div>
      </div>

      <div className="phone-camera-modes" role="group" aria-label="Capture mode">
        <button
          type="button"
          className={!isScreen ? "is-active" : ""}
          aria-pressed={!isScreen}
          onClick={() => setMode("photo")}
        >
          <Camera size={15} aria-hidden="true" /> Photo
        </button>
        <button
          type="button"
          className={isScreen ? "is-active" : ""}
          aria-pressed={isScreen}
          onClick={() => setMode("screen")}
        >
          <Monitor size={15} aria-hidden="true" /> Screenshot
        </button>
      </div>

      <div className="phone-camera-controls">
        <button
          type="button"
          className="phone-camera-side-control"
          aria-label={galleryOpen ? "Close gallery" : "Open gallery"}
          aria-expanded={galleryOpen}
          onClick={() => setGalleryOpen((open) => !open)}
        >
          <ImageIcon aria-hidden="true" />
          <small>Gallery</small>
        </button>

        <button
          type="button"
          className="phone-camera-shutter"
          onClick={() => void (isScreen ? captureScreen() : capturePhoto())}
          aria-label={isScreen ? "Take screenshot" : "Take photo"}
        >
          <span />
        </button>

        <button
          type="button"
          className="phone-camera-side-control"
          onClick={() => setFacing((current) => (current === "rear" ? "front" : "rear"))}
          disabled={isScreen}
          aria-label={facing === "rear" ? "Switch to front camera" : "Switch to rear camera"}
        >
          <SwitchCamera aria-hidden="true" />
          <small>{facing === "rear" ? "Front" : "Rear"}</small>
        </button>
      </div>

      {message && (
        <p className="phone-camera-prototype-note" role="status" aria-live="polite">
          <Check size={13} aria-hidden="true" />
          {message}
        </p>
      )}

      {galleryOpen && (
        <section className="phone-camera-gallery" aria-label="Captured photos">
          {photos.length === 0 ? (
            <p className="phone-camera-prototype-note">
              No photos yet. Take one, or hold the camera button on the game screen for a
              screenshot.
            </p>
          ) : (
            <ul className="phone-camera-gallery-grid">
              {photos.map((photo) => (
                <li key={photo.id}>
                  {thumbs[photo.id] ? (
                    <img src={thumbs[photo.id]} alt={`${photo.label} from gallery`} />
                  ) : (
                    <span className="phone-camera-gallery-placeholder">
                      <ImageIcon aria-hidden="true" />
                    </span>
                  )}
                  <small>{photo.label}</small>
                  <button
                    type="button"
                    aria-label={`Delete ${photo.label.toLowerCase()} from gallery`}
                    onClick={() => void remove(photo.id)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="phone-camera-gallery-close"
            onClick={() => setGalleryOpen(false)}
          >
            <X size={13} aria-hidden="true" /> Close
          </button>
        </section>
      )}
    </section>
  );
}

export default CameraApp;
