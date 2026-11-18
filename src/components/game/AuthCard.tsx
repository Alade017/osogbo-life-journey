import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, MapPin, ShieldCheck } from "lucide-react";
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

  const paneStyle = { "--dir": direction } as CSSProperties;
  const showSwitch = !resettingPassword && !recoverySent;
  const formKey = `${mode}-${recoverySent ? "recover" : resettingPassword ? "reset" : "form"}`;

  return (
    <div className="auth-screen">
      <header className="auth-header">
        <Link to="/" className="auth-brand-link" aria-label="OSUN LIFE home">
          <Logo />
        </Link>
        <Link to="/" className="auth-back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back to start
        </Link>
      </header>
      <main className="auth-layout">
        <aside className="auth-city-panel" aria-label="Life in Osogbo">
          <img src={cityPhoto} alt="" aria-hidden="true" className="auth-city-photo" />
          <div className="auth-city-shade" />
          <p className="auth-city-location">
            <MapPin size={15} aria-hidden="true" /> OSOGBO, NIGERIA
          </p>
          <div className="auth-city-content">
            <p className="auth-city-kicker">A life of your own</p>
            <h1>
              Your city.
              <br /> Your next chapter.
            </h1>
            <p>
              Find your place, build your career, and make the city your own. Your story starts
              here.
            </p>
            <div className="auth-city-caption">
              <span>Live. Build. Prosper.</span>
              <ArrowUpRight size={24} aria-hidden="true" />
            </div>
          </div>
        </aside>
        <section className="auth-form-panel" aria-label="Player account">
          <div className="auth-form-card">
            <p className="auth-form-eyebrow">
              <ShieldCheck size={15} aria-hidden="true" /> YOUR OSUN LIFE ACCOUNT
            </p>
            {showSwitch && (
              <div
                className="auth-switch"
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || busy)
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "login"
                      : event.key === "End"
                        ? "signup"
                        : mode === "login"
                          ? "signup"
                          : "login";
                  switchMode(next);
                  event.currentTarget
                    .querySelector<HTMLButtonElement>(`#auth-tab-${next}`)
                    ?.focus();
                }}
                role="tablist"
                aria-label="Log in or sign up"
                style={{ "--pos": mode === "login" ? 0 : 1 } as CSSProperties}
              >
                <span className="auth-switch-thumb" aria-hidden="true" />
                <button
                  type="button"
                  role="tab"
                  id="auth-tab-login"
                  aria-controls="auth-form-pane"
                  tabIndex={mode === "login" ? 0 : -1}
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
                  id="auth-tab-signup"
                  aria-controls="auth-form-pane"
                  tabIndex={mode === "signup" ? 0 : -1}
                  aria-selected={mode === "signup"}
                  className="auth-switch-option"
                  onClick={() => switchMode("signup")}
                  disabled={busy}
                >
                  Sign up
                </button>
              </div>
            )}

            <div
              key={formKey}
              id="auth-form-pane"
              role={showSwitch ? "tabpanel" : undefined}
              aria-labelledby={showSwitch ? `auth-tab-${mode}` : undefined}
              className="auth-pane"
              style={paneStyle}
            >
              {recoverySent ? (
                <>
                  <h2 className="text-2xl font-bold">Reset your password</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Enter your account email and we’ll send a secure reset link.
                  </p>
                  <form onSubmit={submit} className="auth-form">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        disabled={busy}
                        id="email"
                        autoComplete="email"
                        placeholder="you@example.com"
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
                  <h2 className="auth-form-title font-bold">
                    {resettingPassword
                      ? "Choose a new password"
                      : mode === "signup"
                        ? "Create your account"
                        : "Welcome back"}
                  </h2>
                  <p className="auth-form-description text-sm text-muted-foreground">
                    {resettingPassword
                      ? "Use at least 8 characters for your new password."
                      : mode === "signup"
                        ? "Start your new life in Osogbo."
                        : "Log in to continue your life in the city."}
                  </p>

                  <form onSubmit={submit} className="auth-form">
                    {!resettingPassword && (
                      <div className="space-y-1.5">
                        <Label htmlFor="username">
                          {mode === "signup" ? "Username" : "Username or email"}
                        </Label>
                        <Input
                          disabled={busy}
                          id="username"
                          placeholder={
                            mode === "signup" ? "Choose a username" : "Your username or email"
                          }
                          autoCapitalize="none"
                          spellCheck={false}
                          aria-describedby={mode === "signup" ? "auth-username-hint" : undefined}
                          autoComplete="username"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="h-11 border bg-card"
                        />
                        {mode === "signup" && (
                          <p id="auth-username-hint" className="text-xs text-muted-foreground">
                            3–24 letters, numbers or underscores. Email can be added later in
                            Settings.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          disabled={busy}
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
                          disabled={busy}
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
                        className="auth-text-link auth-recovery-link"
                      >
                        Forgot password?
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="auth-account-note">One account. A whole city of possibilities.</p>
        </section>
      </main>
    </div>
  );
}
