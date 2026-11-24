import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/game/AuthCard";

import { afterLogin, loginDestination } from "@/lib/login-destination";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { destination?: string } => {
    const destination = loginDestination(search["destination"]);
    return destination ? { destination } : {};
  },
  head: () => ({
    meta: [
      { title: "Log in — OSUN LIFE" },
      { name: "robots", content: "noindex, follow" },
      { name: "description", content: "Log in to continue your life in the city of Osogbo." },
      { property: "og:title", content: "Log in — OSUN LIFE" },
      {
        property: "og:description",
        content: "Log in to continue your life in the city of Osogbo.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { destination } = Route.useSearch();
  const navigate = useNavigate();
  // Continue existing authenticated sessions while preserving password recovery.
  useEffect(() => {
    // A recovery session must stay on the form until the password is changed.
    if (
      new URLSearchParams(window.location.search).has("reset") ||
      window.location.hash.includes("type=recovery")
    )
      return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate(afterLogin(destination));
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && event === "SIGNED_IN") void navigate(afterLogin(destination));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate, destination]);
  return <AuthCard mode="login" destination={destination} />;
}
