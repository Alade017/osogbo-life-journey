import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "./Logo";

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/home" },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/home" });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/login" });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home" });
  }

  return (
    <div className="studs-sand flex min-h-screen items-center justify-center px-4 py-10">
      <div className="brick pop-in w-full max-w-md p-6 md:p-8">
        <Link to="/" className="mb-6 inline-block"><Logo /></Link>
        {sent ? (
          <div>
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back to log in.
            </p>
            <Button asChild variant="brick" size="lg" className="mt-6 w-full"><Link to="/login">Go to login</Link></Button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{mode === "signup" ? "Join Osogbo" : "Welcome back"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signup" ? "Create an account to start your new life." : "Log in to continue your life in the city."}
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 border-2 bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 border-2 bg-card" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                {mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
              </div>
              <Button type="submit" variant="brick" size="lg" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
              </Button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
              <span className="h-0.5 flex-1 bg-border/20" /> OR <span className="h-0.5 flex-1 bg-border/20" />
            </div>
            <Button variant="plain" size="lg" className="w-full" onClick={google}>Continue with Google</Button>
            <p className="mt-6 text-center text-sm">
              {mode === "signup" ? (
                <>Already playing? <Link to="/login" className="font-bold text-primary underline">Log in</Link></>
              ) : (
                <>New to Osogbo? <Link to="/signup" className="font-bold text-primary underline">Create an account</Link></>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
