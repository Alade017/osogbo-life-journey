import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "@/components/game/AuthCard";

const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
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

  it("returns email confirmation to the public login route", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCard mode="signup" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "osogbo_player" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(auth.signUp).toHaveBeenCalledWith({
        email: "player@example.com",
        password: "password123",
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { username: "osogbo_player" },
        },
      }),
    );
    expect(await screen.findByText(/You’ll return to the game/)).toBeInTheDocument();
  });

  it("routes successful password login through the authenticated game shell", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthCard mode="login" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(auth.navigate).toHaveBeenCalledWith({ to: "/home" }));
  });

  it("does not redirect a password-recovery session away from the reset form", async () => {
    window.history.replaceState({}, "", "/login#access_token=temporary&type=recovery");
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "player" } } } });
    render(<AuthCard mode="login" />);
    expect(
      await screen.findByRole("heading", { name: "Choose a new password" }),
    ).toBeInTheDocument();
    expect(auth.navigate).not.toHaveBeenCalled();
    window.history.replaceState({}, "", "/");
  });
});
