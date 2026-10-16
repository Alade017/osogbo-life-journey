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
    let timeout = 0;
    let ended = false;
    const signOutForInactivity = async () => {
      if (ended) return;
      ended = true;
      await supabase.auth.signOut();
      await navigate({ to: "/login", replace: true });
    };
    const refresh = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => void signOutForInactivity(), 30 * 60 * 1000);
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "wheel"];
    events.forEach((event) => window.addEventListener(event, refresh, { passive: true }));
    refresh();
    return () => {
      ended = true;
      window.clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, refresh));
    };
  }, [navigate]);
  return <Outlet />;
}
