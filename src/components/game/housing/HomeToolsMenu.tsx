import { useEffect, useRef, type ReactNode } from "react";
import { Menu, Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

/** Native disclosure keeps the light, rearrange and wall controls reachable by keyboard. */
export function HomeToolsMenu({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const element = menu.current;
    if (!element) return;
    const dismiss = () => {
      element.open = false;
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) dismiss();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("osogbo-hud-dismiss-panels", dismiss);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("osogbo-hud-dismiss-panels", dismiss);
    };
  }, []);

  return (
    <details
      ref={menu}
      className="home-tools-menu"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !event.currentTarget.open) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }}
    >
      <summary aria-label="Home tools" title="Home tools">
        <Menu size={24} aria-hidden="true" />
      </summary>
      <div
        className="home-tools-content"
        role="group"
        aria-label="Home tools"
        onClick={(event) => {
          if (!(event.target instanceof Element) || !event.target.closest("button")) return;
          if (menu.current) {
            menu.current.open = false;
            menu.current.querySelector("summary")?.focus();
          }
        }}
      >
        {children}
        <button className="home-settings-menu-item" type="button" onClick={() => void navigate({ to: "/settings" })}>
          <span className="home-settings-menu-icon" aria-hidden="true"><Settings size={19} /></span>
          <span className="home-settings-menu-copy"><strong>Settings</strong><small>Game preferences and account</small></span>
          <span className="home-settings-menu-arrow" aria-hidden="true">›</span>
        </button>
      </div>
    </details>
  );
}
