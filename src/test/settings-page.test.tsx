import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

// The slider uses ResizeObserver, which jsdom does not provide.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "p1",
              display_name: "Adeyemi",
              music_enabled: true,
              effects_enabled: true,
              reduced_motion: false,
              app_tile_style: "rounded",
            },
            error: null,
          }),
        }),
      }),
    }),
    auth: { getUser: async () => ({ data: { user: { id: "p1" } }, error: null }) },
    rpc: async () => ({ data: null, error: null }),
  },
}));

import { SettingsPage } from "@/routes/_authenticated/_game/settings";

describe("settings page", () => {
  it("renders all settings sections together without a category filter", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SettingsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByDisplayValue("Adeyemi")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sound" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "App tiles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Display" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Life simulation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Home privacy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Reduce motion" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Allow friend visits" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Settings categories" })).not.toBeInTheDocument();
  });
});
