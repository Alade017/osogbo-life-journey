# Three.js scene performance benchmark (O8.3E.6)

This is the **current R3F/Three.js** benchmarking procedure. The historical PlayCanvas results in `docs/playcanvas-home-benchmark.md` are not a baseline for this renderer.

## Purpose and constraints

Collect repeatable **observations**, not performance claims, for representative scenes on real devices. Do not add a permanently running render loop or production telemetry to collect measurements. Record both the `standard` and `performance` quality modes where supported. A browser running software WebGL is **not** a substitute for a budget Android device.

## Reproducible run

1. Check out the exact commit and record its SHA, Node version, browser version, operating system, and device model. Install dependencies with `npm ci`.
2. Start the game with `npm run dev`. Use the same test account, scene, camera angle, viewport dimensions, device pixel ratio and NPC count on every run. Avoid publishing account identifiers or game data in benchmark artifacts.
3. Measure at least the city/neighbourhood view, a populated venue, and a house interior. For each, capture **idle**, **camera interaction**, and **active NPC animation** separately. Capture a warm load after assets have completed loading; separately label cold-load measurements.
4. Open Chrome DevTools → Performance. Record at least 30 seconds per scenario; repeat three times. Capture long tasks, frame-duration distribution, JavaScript and rendering activity, and memory where available. Record the median of repeated runs and the per-run values.
5. In DevTools' WebGL tooling or a temporary **development-only R3F component**, sample `useThree().gl.info.render.calls`, `gl.info.render.triangles`, `gl.info.memory.geometries`, and `gl.info.memory.textures`. `gl.info` counters are renderer estimates, **not GPU memory bytes**. Draw-call/triangle counters refer to rendered frames and may reset each frame.
6. Test on a real budget Android phone and on desktop, using the same scene configurations. Record thermal throttling, network constraints, battery saver mode and device pixel ratio. Record failures and blank scenes as failures rather than excluding the samples.
7. Run `npm run typecheck`, `npm test -- --run src/test/render-quality.test.ts`, `npm run lint`, and `npm run build` in a compatible Node 24 environment. Report each command's actual result; existing repo-wide lint debt must not be described as a passing check.

## Optional development-only frame sampler

The following example is a **manual diagnostic**, not automatically mounted in production. Temporarily render it **inside** the R3F Canvas being measured, under a development-only guard, and remove it after capturing results. Its values describe observed `useFrame` callback intervals, **not GPU timer-query measurements**. Demand-rendered scenes have intentionally sparse callbacks when idle: do not interpret sparse frames as poor FPS.

```tsx
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export function DevelopmentFrameSampler() {
  const { gl } = useThree();
  const samples = useRef<number[]>([]);
  const lastCounters = useRef({ calls: 0, triangles: 0, geometries: 0, textures: 0 });
  useFrame((_state, delta) => {
    if (Number.isFinite(delta) && delta > 0) samples.current.push(delta * 1000);
    if (samples.current.length > 1800) samples.current.shift();
    lastCounters.current = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    };
  });
  useEffect(() => {
    return () => {
      const data = [...samples.current].sort((a, b) => a - b);
      const percentile = (p: number) => data.length
        ? data[Math.min(data.length - 1, Math.ceil(data.length * p) - 1)]
        : null;
      console.table({ renderedCallbacks: data.length, p50IntervalMs: percentile(0.5),
        p95IntervalMs: percentile(0.95), ...lastCounters.current });
    };
  }, []);
  return null;
}
```

For better accuracy, use the DevTools Performance recording as the primary frame-time evidence. The snippet's final renderer counters reflect a recent sampled callback; they are not maxima or averages.

## Recording template

| Commit | Device / browser | Scene | Quality | Viewport / DPR | NPCs | Scenario | 30 s frame p50 / p95 (ms) | Draw calls | Triangles | Geometries | Textures | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| (SHA) | (device) | (scene) | (mode) | (size / DPR) | (count) | (idle / interaction / animation) | (measured) | (measured) | (measured) | (measured) | (measured) | (issues) |

## Acceptance and interpretation

Compare with an **existing measured baseline on the same device** before claiming an improvement. No benchmark results are recorded by creating this document. Prefer lower p95 frame time and stable device memory over average FPS alone. Review animation correctness, shadows, responsiveness and scene navigation alongside performance. If the performance mode reduces visual quality, label that tradeoff rather than reporting it as a free speedup.
