import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { enterHomeFromAnywhere } from "@/lib/home-entry";

/** A link to the house that enters the house on the server first, then opens it. */
export function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <Link
      to="/house"
      {...(className ? { className } : {})}
      onClick={(event) => {
        event.preventDefault();
        void enterHomeFromAnywhere(queryClient).then((entered) => {
          if (entered) void navigate({ to: "/house" });
        });
      }}
    >
      {children}
    </Link>
  );
}
