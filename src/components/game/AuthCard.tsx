import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import cityPhoto from "@/assets/osogbo-city.jpg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "./Logo";
import { primeGameAudioForLogin, disableGameAudio } from "@/lib/game-audio";
import "./auth-switch.css";
import "./auth-redesign.css";

type Mode = "login" | "signup";

export function AuthCard({ mode: initialMode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (mode !== "login") return;
    if (
      new URLSearchParams(window.location.search).has("reset") ||
      new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery"
    )
      setResettingPassword(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setResettingPassword(true);
    });
    return () => data.subscription.unsubscribe();
  }, [mode]);

  function switchMode(next: Mode) {
    if (next === mode || busy || resettingPassword) return;
    setDirection(next === "signup" ? 1 : -1);
    setMode(next);
    setRecoverySent(false);
    setPassword("");
    setConfirmPassword("");
    window.history.replaceState({}, "", next === "signup" ? "/signup" : "/login");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      const cleanUsername = username.trim();
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanUsername)) {
        toast.error("Username must be 3-24 characters using letters, numbers or underscores.");
        return;
      }
    }
    if (resettingPassword && password !== confirmPassword) {
      toast.error("Your passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (resettingPassword) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setResettingPassword(false);
        window.history.replaceState({}, "", "/login");
        toast.success("Password updated. You can now log in with your new password.");
      } else if (recoverySent) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?reset=1`,
        });
        if (error) throw error;
        toast.success("Password reset email sent.");
      } else if (mode === "signup") {
        primeGameAudioForLogin();
        const response = await fetch("/api/auth/username/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not create account.");
        const { error } = await supabase.auth.setSession(result);
        if (error) throw error;
        navigate({ to: "/create-character" });
      } else {
        primeGameAudioForLogin();
        if (username.includes("@")) {
          const { error } = await supabase.auth.signInWithPassword({
            email: username.trim(),
            password,
          });
          if (error) throw error;
        } else {
          const response = await fetch("/api/auth/username/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Username or password is incorrect.");
          const { error } = await supabase.auth.setSession(result);
          if (error) throw error;
        }
        navigate({ to: "/enter" });
      }
    } catch (err) {
      void disableGameAudio();
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const paneStyle = { "--dir": direction } as CSSProperties;
  const showSwitch = !resettingPassword && !recoverySent;
  const formKey = `${mode}-${recoverySent ? "recover" : resettingPassword ? "reset" : "form"}`;

  return (
    <div className="auth-screen relative isolate min-h-screen overflow-hidden bg-ink">
      <img
        src={cityPhoto}
        alt="Osogbo city panorama"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 auth-screen-scrim" />
      <div className="auth-layout relative mx-auto grid min-h-screen max-w-7xl lg:grid-cols-2">
        <section className="auth-story-panel flex min-h-57.5 flex-col justify-end px-5 pb-7 pt-8 text-white sm:px-8 lg:min-h-screen lg:justify-between lg:px-12 lg:py-12">
          <Link to="/" className="auth-story-brand" aria-label="OSUN LIFE home">
            <Logo small /> <span>OSUN LIFE</span>
          </Link>
          <div key={mode} className="auth-pane max-w-lg" style={paneStyle}>
            <p className="auth-story-kicker">Your next chapter starts here</p>
            <h1 className="auth-story-title">
              {mode === "signup" ? "Make a life in Osogbo." : "Good to have you back."}
            </h1>
            <p className="auth-story-copy">
              Explore the city, find work and build your own way forward.
            </p>
            <div className="auth-features-card">
              <p className="auth-features-title">Features</p>
              <ul className="auth-story-points" aria-label="Game highlights">
                <li>
                  <Check size={15} aria-hidden="true" /> Build your own story
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> Find work and community
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> Play at your own pace
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="auth-form-panel flex items-center justify-center px-4 py-8 sm:px-8 lg:my-6 lg:rounded-l-2xl lg:px-10">
          <div className="auth-form-card game-panel pop-in w-full max-w-md p-6 sm:p-8">
            <Link to="/" className="auth-form-logo" aria-label="OSUN LIFE home">
              <Logo />
            </Link>
            <p className="auth-form-eyebrow">
              <ShieldCheck size={14} aria-hidden="true" /> Secure player access
            </p>

            {showSwitch && (
              <div
                className="auth-switch"
                role="tablist"
                aria-label="Log in or sign up"
                style={{ "--pos": mode === "login" ? 0 : 1 } as CSSProperties}
              >
                <span className="auth-switch-thumb" aria-hidden="true" />
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  className="auth-switch-option"
                  onClick={() => switchMode("login")}
                  disabled={busy}
                >
                  Log in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  className="auth-switch-option"
                  onClick={() => switchMode("signup")}
                  disabled={busy}
                >
                  Sign up
                </button>
              </div>
            )}

            <div key={formKey} className="auth-pane" style={paneStyle}>
              {recoverySent ? (
                <>
                  <h2 className="text-2xl font-bold">Reset your password</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Enter your account email and we’ll send a secure reset link.
                  </p>
                  <form onSubmit={submit} className="mt-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 border bg-card"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="default"
                      size="lg"
                      className="auth-submit-button w-full"
                      disabled={busy}
                      aria-busy={busy}
                    >
                      {busy ? "Sending…" : "Send reset link"}
                    </Button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setRecoverySent(false)}
                    className="auth-text-link mt-5 w-full text-center"
                  >
                    Back to log in
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-bold">
                    {resettingPassword
                      ? "Choose a new password"
                      : mode === "signup"
                        ? "Create your account"
                        : "Welcome back"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {resettingPassword
                      ? "Use at least 8 characters for your new password."
                      : mode === "signup"
                        ? "Start your new life in Osogbo."
                        : "Log in to continue your life in the city."}
                  </p>

                  <form onSubmit={submit} className="mt-6 space-y-4">
                    {!resettingPassword && (
                      <div className="space-y-1.5">
                        <Label htmlFor="username">
                          {mode === "signup" ? "Username" : "Username or email"}
                        </Label>
                        <Input
                          id="username"
                          autoComplete="username"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="h-11 border bg-card"
                        />
                        {mode === "signup" && (
                          <p className="text-xs text-muted-foreground">
                            3-24 letters, numbers or underscores. Email can be added later in
                            Settings.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-11 border bg-card pr-12"
                          autoComplete={
                            mode === "signup" || resettingPassword
                              ? "new-password"
                              : "current-password"
                          }
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center text-muted-foreground focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                        </button>
                      </div>
                      {(mode === "signup" || resettingPassword) && (
                        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                      )}
                    </div>

                    {resettingPassword && (
                      <div className="space-y-1.5">
                        <Label htmlFor="confirm-password">Confirm password</Label>
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={8}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-11 border bg-card"
                          autoComplete="new-password"
                        />
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="default"
                      size="lg"
                      className="auth-submit-button w-full"
                      disabled={busy}
                      aria-busy={busy}
                    >
                      {busy
                        ? "Please wait…"
                        : resettingPassword
                          ? "Update password"
                          : mode === "signup"
                            ? "Create account"
                            : "Log in"}
                    </Button>
                  </form>

                  {!resettingPassword && mode === "login" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRecoverySent(true)}
                        className="auth-text-link mt-4"
                      >
                        Forgot password?
                      </button>
                      <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                        <span className="h-px flex-1 bg-border" /> OR{" "}
                        <span className="h-px flex-1 bg-border" />
                      </div>
                      <Button
                        variant="plain"
                        size="lg"
                        className="auth-submit-button auth-google-button w-full"
                        onClick={google}
                        disabled={busy}
                        aria-busy={busy}
                      >
                        <svg className="auth-google-mark" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.73z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.09A12 12 0 0 0 12 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.28a12 12 0 0 0 0 10.78z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.94 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.61L5.29 9.7C6.23 6.86 8.88 4.75 12 4.75z"
                          />
                        </svg>
                        Continue with Google
                      </Button>
                      <p className="mt-6 text-center text-sm">
                        New to Osogbo?{" "}
                        <button
                          type="button"
                          className="auth-text-link"
                          onClick={() => switchMode("signup")}
                        >
                          Create an account
                        </button>
                      </p>
                    </>
                  )}

                  {!resettingPassword && mode === "signup" && (
                    <p className="mt-6 text-center text-sm">
                      Already playing?{" "}
                      <button
                        type="button"
                        className="auth-text-link"
                        onClick={() => switchMode("login")}
                      >
                        Log in
                      </button>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
