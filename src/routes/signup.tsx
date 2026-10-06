import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/game/AuthCard";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — OSOGBO LIFE" },
      { name: "description", content: "Create your OSOGBO LIFE account and start a new life in the city." },
      { property: "og:title", content: "Sign up — OSOGBO LIFE" },
      { property: "og:description", content: "Create your OSOGBO LIFE account and start a new life in the city." },
    ],
  }),
  component: () => <AuthCard mode="signup" />,
});
