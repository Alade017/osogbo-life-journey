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
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);
  return <AuthCard mode="login" />;
}
