/**
 * The 3D scene registers how to read its current frame. The game canvas only renders on demand,
 * so the registered function renders first and then reads the frame in the same step.
 */
export type ScreenCapture = () => Promise<Blob | null>;

let activeCapture: ScreenCapture | null = null;

export function registerScreenCapture(capture: ScreenCapture): () => void {
  activeCapture = capture;
  return () => {
    if (activeCapture === capture) activeCapture = null;
  };
}

export function hasScreenCapture(): boolean {
  return activeCapture !== null;
}

/** The 3D view on the current screen as a PNG, or null when the screen has no 3D scene. */
export async function captureGameScreen(): Promise<Blob | null> {
  if (!activeCapture) return null;
  try {
    return await activeCapture();
  } catch {
    return null;
  }
}
