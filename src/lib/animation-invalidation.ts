import type { AnimationAction } from "three";

type AnimationInvalidationOptions = {
  action: AnimationAction;
  invalidate: () => void;
  fadeSeconds: number;
};

const ANIMATION_FPS = 30;
const SAFETY_GRACE_MS = 1_000;

export function startAnimationInvalidation({
  action,
  invalidate,
  fadeSeconds,
}: AnimationInvalidationOptions): () => void {
  const mixer = action.getMixer();
  const durationMs = action.getClip().duration * 1000;
  const fadeMs = fadeSeconds * 1000;

  let stopped = false;
  let finished = false;

  let fadeTimer: number | undefined;

  function cleanup() {
    if (stopped) return;
    stopped = true;

    window.clearInterval(interval);
    window.clearTimeout(timeout);
    window.clearTimeout(fadeTimer);

    mixer.removeEventListener("finished", onFinished);
  }

  function onFinished(event: { action: AnimationAction }) {
    if (stopped || finished || event.action !== action) {
      return;
    }

    finished = true;

    fadeTimer = window.setTimeout(() => {
      invalidate();
      cleanup();
    }, fadeMs);
  }

  mixer.addEventListener("finished", onFinished);

  const interval = window.setInterval(invalidate, 1000 / ANIMATION_FPS);

  const timeout = window.setTimeout(cleanup, durationMs + fadeMs + SAFETY_GRACE_MS);

  invalidate();

  return cleanup;
}
