import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import cityPhoto from "@/assets/osogbo-city.jpg";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "./Logo";

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      const cleanUsername = username.trim();
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanUsername)) {
        toast.error("Username must be 3–24 characters using letters, numbers or underscores.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Your passwords do not match.");
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Confirmation must return to a public route; the login page then
            // resolves whether this account needs a character or has a save.
            emailRedirectTo: `${window.location.origin}/login`,
            data: { username: username.trim() },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/create-character" });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // The protected game shell redirects new accounts to character creation
        // and keeps returning accounts on their saved game.
        navigate({ to: "/home" });
      }
    } catch (err) {
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

  async function continueAsGuest() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInAnonymously({
        options: { data: { username: "guest" } },
      });
      if (error) throw error;
      navigate({ to: "/create-character" });
    } catch (error) {
      toast.error(`Guest play is unavailable. ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen relative isolate min-h-screen overflow-hidden bg-ink">
      <img
        src={cityPhoto}
        alt="Osogbo city panorama"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-slate-950/55" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl lg:grid-cols-2">
        <section className="flex min-h-57.5 flex-col justify-end px-5 pb-7 pt-8 text-white sm:px-8 lg:min-h-screen lg:justify-between lg:px-12 lg:py-12">
          <p className="hidden text-sm font-bold tracking-wide lg:block">OSOGBO LIFE</p>
          <div className="max-w-lg">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">
              Your next chapter starts here
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-6xl">
              {mode === "signup" ? "Make a life in Osogbo." : "Good to have you back."}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
              Explore the city, find work and build your own way forward.
            </p>
          </div>
          <a
            href="https://commons.wikimedia.org/wiki/File:Osogbo.jpg"
            target="_blank"
            rel="noreferrer"
            className="hidden text-[11px] text-white/75 underline underline-offset-2 lg:block"
          >
            Photo: El-Shaddaites · CC BY-SA 4.0
          </a>
        </section>

        <section className="flex items-center justify-center bg-background/95 px-4 py-8 backdrop-blur-sm sm:px-8 lg:my-6 lg:rounded-l-2xl lg:px-10">
          <div className="game-panel pop-in w-full max-w-md p-6 sm:p-8">
            <Link to="/" className="mb-7 inline-block">
              <Logo />
            </Link>
            {sent ? (
              <div>
                <h2 className="text-2xl font-bold">Check your email</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  We sent a confirmation link to <strong>{email}</strong>. Click it to confirm your
                  account. You’ll return to the game to create a character or continue if you
                  already have one.
                </p>
                <Button asChild variant="default" size="lg" className="mt-6 w-full">
                  <Link to="/login">Go to login</Link>
                </Button>
              </div>
            ) : recoverySent ? (
              <div>
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
                    className="w-full"
                    disabled={busy}
                  >
                    {busy ? "Sending…" : "Send reset link"}
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={() => setRecoverySent(false)}
                  className="mt-5 w-full text-center text-sm font-bold text-primary underline"
                >
                  Back to log in
                </button>
              </div>
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
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 border bg-card"
                      />
                    </div>
                  )}
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        autoComplete="username"
                        minLength={3}
                        maxLength={24}
                        pattern="[A-Za-z0-9_]{3,24}"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. adunni_ade"
                        className="h-11 border bg-card"
                      />
                      <p className="text-xs text-muted-foreground">
                        3–24 letters, numbers or underscores.
                      </p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 border bg-card"
                      autoComplete={
                        mode === "signup" || resettingPassword ? "new-password" : "current-password"
                      }
                    />
                    {(mode === "signup" || resettingPassword) && (
                      <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                    )}
                  </div>
                  {(mode === "signup" || resettingPassword) && (
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password">Confirm password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
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
                    className="w-full"
                    disabled={busy}
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
                      className="mt-4 text-sm font-semibold text-primary underline underline-offset-2"
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
                      className="w-full"
                      onClick={google}
                      disabled={busy}
                    >
                      Continue with Google
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="mt-2 w-full"
                      disabled={busy}
                      onClick={continueAsGuest}
                    >
                      Continue as guest
                    </Button>
                    <p className="mt-6 text-center text-sm">
                      New to Osogbo?{" "}
                      <Link to="/signup" className="font-bold text-primary underline">
                        Create an account
                      </Link>
                    </p>
                  </>
                )}
                {!resettingPassword && mode === "signup" && (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      className="mt-4 w-full"
                      disabled={busy}
                      onClick={continueAsGuest}
                    >
                      Continue as guest
                    </Button>
                    <p className="mt-6 text-center text-sm">
                      Already playing?{" "}
                      <Link to="/login" className="font-bold text-primary underline">
                        Log in
                      </Link>
                    </p>
                  </>
                )}
                <a
                  href="https://commons.wikimedia.org/wiki/File:Osogbo.jpg"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 block text-center text-[10px] text-muted-foreground underline underline-offset-2 lg:hidden"
                >
                  Photo: El-Shaddaites · CC BY-SA 4.0
                </a>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
