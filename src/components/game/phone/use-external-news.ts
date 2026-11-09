import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Headline feeds the phone can show. Each is cached on the server per region. */
export type PhoneNewsRegion = "nigeria" | "world" | "osun" | "schools";

export type ExternalNewsItem = {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
};

export function useExternalNews(region: PhoneNewsRegion, enabled: boolean) {
  const [items, setItems] = useState<ExternalNewsItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    async function load() {
      setState("loading");
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) throw new Error("No active session");
        const response = await fetch(`/api/news?region=${region}`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (!response.ok) throw new Error("News is unavailable");
        const payload = (await response.json()) as { items?: ExternalNewsItem[] };
        if (live) {
          setItems(payload.items ?? []);
          setState("ready");
        }
      } catch {
        if (live) setState("unavailable");
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [region, enabled]);

  return { items, state };
}
