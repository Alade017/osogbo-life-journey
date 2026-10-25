import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const navigate = useNavigate();
  useEffect(() => {
    const inactivityLimitMs = 15 * 60 * 1000;
    let lastActivityAt = Date.now();
    let timeout = 0;
    let ended = false;
    const signOutForInactivity = async () => {
      if (ended) return;
      ended = true;
      await supabase.auth.signOut();
      await navigate({ to: "/login", replace: true });
    };
    const checkInactivity = () => {
      if (ended) return;
      window.clearTimeout(timeout);
      const remaining = inactivityLimitMs - (Date.now() - lastActivityAt);
      if (remaining <= 0) {
        void signOutForInactivity();
        return;
      }
      timeout = window.setTimeout(checkInactivity, remaining);
    };
    const recordActivity = () => {
      if (ended) return;
      if (Date.now() - lastActivityAt >= inactivityLimitMs) {
        void signOutForInactivity();
        return;
      }
      lastActivityAt = Date.now();
      checkInactivity();
    };
    const checkWhenVisible = () => {
      if (!document.hidden) checkInactivity();
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "wheel"];
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener("focus", checkInactivity);
    window.addEventListener("pageshow", checkInactivity);
    document.addEventListener("visibilitychange", checkWhenVisible);
    checkInactivity();
    return () => {
      ended = true;
      window.clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("focus", checkInactivity);
      window.removeEventListener("pageshow", checkInactivity);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [navigate]);
  return <Outlet />;
}
