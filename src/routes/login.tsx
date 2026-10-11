import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/game/AuthCard";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — OSOGBO LIFE" },
      { name: "description", content: "Log in to continue your life in the city of Osogbo." },
      { property: "og:title", content: "Log in — OSOGBO LIFE" },
      {
        property: "og:description",
        content: "Log in to continue your life in the city of Osogbo.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  // Returning from Google sign-in lands here; continue once the session exists.
  useEffect(() => {
    // A recovery session must stay on the form until the password is changed.
    if (
      new URLSearchParams(window.location.search).has("reset") ||
      window.location.hash.includes("type=recovery")
    )
      return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/home", search: { visit: undefined } });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && event === "SIGNED_IN")
        void navigate({ to: "/home", search: { visit: undefined } });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);
  return <AuthCard mode="login" />;
}
