import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "@/components/game/AuthCard";

const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  setSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
  prime: vi.fn(),
  mute: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@/lib/game-audio", () => ({
  primeGameAudioForLogin: auth.prime,
  disableGameAudio: auth.mute,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => auth.navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { error: auth.error } }));

describe("account sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("does not offer new guest sessions and reveals the password on request", () => {
    render(<AuthCard mode="login" />);
    expect(screen.queryByRole("button", { name: "Continue as guest" })).not.toBeInTheDocument();
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("creates a username account without requiring email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "access", refresh_token: "refresh" }),
      }),
    );
    auth.setSession.mockResolvedValue({ error: null });
    render(<AuthCard mode="signup" />);
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "osogbo_player" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(auth.navigate).toHaveBeenCalledWith({ to: "/create-character" }));
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/username/register",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });

  it("keeps existing email and password accounts working", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthCard mode="login" />);
    fireEvent.change(screen.getByLabelText("Username or email"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(auth.navigate).toHaveBeenCalledWith({ to: "/enter" }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "password123",
    });
  });

  it("supports Google sign-in", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: null });
    render(<AuthCard mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() =>
      expect(auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/login` },
      }),
    );
  });
});
