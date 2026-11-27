import { fireEvent, render, screen } from "@testing-library/react";
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
            data: { id: "p1", display_name: "Adeyemi", music_enabled: true },
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
  it("renders its content once the profile loads", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SettingsPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByDisplayValue("Adeyemi")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Display" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: "Reduce motion" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(screen.getByRole("switch", { name: "Allow friend visits" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sound & play" }));
    expect(screen.getByRole("switch", { name: "Background music on or off" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("supports embedded mode without duplicating the player hub identity header", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <SettingsPage embedded />
      </QueryClientProvider>,
    );
    expect(await screen.findByDisplayValue("Adeyemi")).toBeTruthy();
    expect(container.querySelector(".sx-hero")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Settings categories" })).toBeInTheDocument();
  });
});
