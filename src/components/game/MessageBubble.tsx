import { useEffect, useRef, type ReactNode } from "react";

/** Gestures never consume taps on playback, links, or other message controls. */
export function MessageBubble({
  children,
  className,
  messageId,
  label,
  onActions,
  onReply,
  onStar,
}: {
  children: ReactNode;
  className: string;
  messageId: string;
  label: string;
  onActions: () => void;
  onReply: () => void;
  onStar: () => void;
}) {
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const click = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const consumed = useRef(false);
  const lastTap = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(hold.current);
      clearTimeout(click.current);
    },
    [],
  );
  const control = (target: EventTarget) =>
    target instanceof Element && !!target.closest("button, input, a, audio");
  return (
    <li
      className={className}
      data-message-id={messageId}
      tabIndex={0}
      aria-label={label}
      aria-haspopup="dialog"
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActions();
        }
      }}
      onContextMenu={(event) => {
        if (!control(event.target)) {
          event.preventDefault();
          onActions();
        }
      }}
      onPointerDown={(event) => {
        if (control(event.target) || event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        consumed.current = false;
        clearTimeout(click.current);
        start.current = { x: event.clientX, y: event.clientY, moved: false };
        clearTimeout(hold.current);
        hold.current = setTimeout(() => {
          consumed.current = true;
          clearTimeout(click.current);
          onActions();
        }, 500);
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 12) {
          start.current.moved = true;
          clearTimeout(hold.current);
        }
      }}
      onPointerCancel={() => {
        clearTimeout(hold.current);
        start.current = null;
        consumed.current = true;
      }}
      onPointerUp={(event) => {
        clearTimeout(hold.current);
        const origin = start.current;
        start.current = null;
        if (!origin || consumed.current) return;
        const dx = event.clientX - origin.x,
          dy = event.clientY - origin.y;
        if (origin.moved || Math.hypot(dx, dy) > 12) {
          consumed.current = true;
          clearTimeout(click.current);
          if (dx >= 60 && Math.abs(dy) < 24) onReply();
        } else if (event.pointerType === "touch") {
          consumed.current = true;
          const now = Date.now();
          clearTimeout(click.current);
          if (lastTap.current && now - lastTap.current < 320) {
            lastTap.current = 0;
            onStar();
          } else {
            lastTap.current = now;
            click.current = setTimeout(onActions, 320);
          }
        }
      }}
      onClick={(event) => {
        if (control(event.target) || consumed.current || window.getSelection()?.toString()) return;
        clearTimeout(click.current);
        click.current = setTimeout(onActions, 260);
      }}
      onDoubleClick={(event) => {
        if (control(event.target) || consumed.current) return;
        clearTimeout(click.current);
        onStar();
      }}
    >
      {children}
    </li>
  );
}
