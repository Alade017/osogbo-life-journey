import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "@/components/game/AuthCard";

const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  onAuthStateChange: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => auth.navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { error: auth.error } }));

describe("direct Supabase Google authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });
  it("sends Google sign-in directly to Supabase with the current local callback", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://example.test/oauth" },
      error: null,
    });
    render(<AuthCard mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() =>
      expect(auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/login` },
      }),
    );
    expect(auth.navigate).not.toHaveBeenCalled();
  });
  it("reports provider failures and re-enables the login button", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: new Error("Google provider is disabled") });
    render(<AuthCard mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(auth.error).toHaveBeenCalledWith("Google provider is disabled"));
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });
});
