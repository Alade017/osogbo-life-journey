import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "@/components/game/AuthCard";

const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  success: vi.fn(),
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
vi.mock("sonner", () => ({ toast: { error: auth.error, success: auth.success } }));

describe("account sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/login");
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

  it.each(["login", "signup"] as const)("does not offer Google sign-in in %s", (mode) => {
    render(<AuthCard mode={mode} />);
    expect(screen.queryByRole("button", { name: /Google/i })).not.toBeInTheDocument();
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("switches account forms with keyboard navigation", () => {
    render(<AuthCard mode="login" />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Log in" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Sign up" }), { key: "Home" });
    expect(screen.getByLabelText("Username or email")).toBeInTheDocument();
  });

  it("keeps email password recovery working", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<AuthCard mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() =>
      expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("player@example.com", {
        redirectTo: `${window.location.origin}/login?reset=1`,
      }),
    );
  });

  it("updates matching new passwords from the recovery link", async () => {
    window.history.replaceState({}, "", "/login?reset=1");
    auth.updateUser.mockResolvedValue({ error: null });
    render(<AuthCard mode="login" />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "new-password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "new-password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() =>
      expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password123" }),
    );
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });
});

it("preserves the destination when a player logs in from a venue link", async () => {
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  render(<AuthCard mode="login" destination="harvest-tech-hub" />);
  fireEvent.change(screen.getByLabelText("Username or email"), {
    target: { value: "player@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
  await waitFor(() =>
    expect(auth.navigate).toHaveBeenCalledWith({
      to: "/location/$slug",
      params: { slug: "harvest-tech-hub" },
    }),
  );
});

it("keeps a failed login visible on the form", async () => {
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });
  render(<AuthCard mode="login" />);
  fireEvent.change(screen.getByLabelText("Username or email"), {
    target: { value: "player@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
});
