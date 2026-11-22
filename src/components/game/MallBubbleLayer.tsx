import { useEffect, useRef } from "react";
import type { Camera } from "three";
import { Vector3 } from "three";
import type { MallSim } from "@/components/3d/OsunMall3D";
import {
  bubbleAnchor,
  MALL_BUBBLE_SECONDS,
  splitSpeaker,
  type MallBubble,
} from "@/game/mall-bubbles";

/** Height of a bubble's tail above the character's feet, in scene units. */
const BUBBLE_HEIGHT = 1.8;

/**
 * Speech bubbles drawn as ordinary HTML on top of the 3D view. Each frame, every bubble is placed
 * above its character's current position, so it follows people as they walk. A bubble hides when
 * its character is off screen, and it never blocks a click on the floor or a shelf.
 */
export function MallBubbleLayer({
  bubbles,
  sim,
  cameraRef,
}: {
  bubbles: readonly MallBubble[];
  sim: { readonly current: MallSim };
  cameraRef: { readonly current: Camera | null };
}) {
  const host = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<number, HTMLDivElement>());
  const latest = useRef(bubbles);

  useEffect(() => {
    latest.current = bubbles;
  }, [bubbles]);

  useEffect(() => {
    let frame = 0;
    const point = new Vector3();
    const tick = () => {
      const camera = cameraRef.current;
      const area = host.current;
      if (camera && area) {
        const width = area.clientWidth;
        const height = area.clientHeight;
        for (const bubble of latest.current) {
          const el = cards.current.get(bubble.id);
          if (!el) continue;
          const at = bubbleAnchor(bubble.targetId, sim.current);
          if (!at) {
            el.style.display = "none";
            continue;
          }
          point.set(at[0], BUBBLE_HEIGHT, at[1]).project(camera);
          const onScreen = point.z < 1 && Math.abs(point.x) <= 1.1 && Math.abs(point.y) <= 1.1;
          if (!onScreen) {
            el.style.display = "none";
            continue;
          }
          el.style.display = "";
          const half = el.offsetWidth / 2;
          const edge = 4;
          // Centre the bubble over the character, but keep it fully inside the view.
          const centred = ((point.x + 1) / 2) * width;
          const x = Math.min(Math.max(centred, half + edge), width - half - edge);
          const y = ((1 - point.y) / 2) * height;
          // Lift the bubble so its tail sits just above the head.
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 8px))`;
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [cameraRef, sim]);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      <style>{`@keyframes mall-bubble-fade { 0%, 80% { opacity: 1 } 100% { opacity: 0 } }`}</style>
      {bubbles.map((bubble) => {
        const { speaker, line } = splitSpeaker(bubble.text);
        return (
          <div
            key={bubble.id}
            ref={(el) => {
              if (el) cards.current.set(bubble.id, el);
              else cards.current.delete(bubble.id);
            }}
            className="absolute left-0 top-0 max-w-[15rem] rounded-lg border-2 border-[#c2410c] bg-[#fbf6ea] px-2 py-1 text-xs leading-snug text-[#1c1917] shadow-md"
            style={{ animation: `mall-bubble-fade ${MALL_BUBBLE_SECONDS}s linear forwards` }}
          >
            {speaker ? <span className="font-bold">{speaker}: </span> : null}
            {line}
            <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-[#c2410c] bg-[#fbf6ea]" />
          </div>
        );
      })}
    </div>
  );
}
