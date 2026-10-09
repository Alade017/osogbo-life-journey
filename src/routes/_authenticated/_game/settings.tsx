import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ComingSoon, PageHeader } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/_game/settings")({
  head: () => pageMeta("Settings", "Manage your OSOGBO LIFE account and preferences."),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useQuery(q.profile());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [linkingAccount, setLinkingAccount] = useState(false);
  useEffect(() => setName(profile?.display_name ?? ""), [profile?.display_name]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setIsGuest(data.user?.is_anonymous ?? false);
    });
  }, []);

  async function update(patch: {
    display_name?: string;
    reduced_motion?: boolean;
    sound_enabled?: boolean;
  }) {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function signOut() {
    if (
      isGuest &&
      !window.confirm(
        "This guest save is attached to this temporary sign-in. Link an email and password before signing out, or you may lose access to it. Sign out anyway?",
      )
    )
      return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.clear();
    navigate({ to: "/" });
  }

  async function linkGuestAccount() {
    if (!recoveryEmail.trim() || recoveryPassword.length < 8) {
      toast.error("Enter an email and a password with at least 8 characters.");
      return;
    }
    setLinkingAccount(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        email: recoveryEmail.trim(),
        password: recoveryPassword,
      });
      if (error) throw error;
      setEmail(data.user.email ?? recoveryEmail.trim());
      setIsGuest(data.user.is_anonymous ?? false);
      setRecoveryPassword("");
      toast.success(
        "Your save remains on this account. Check your email if Supabase asks you to confirm the address.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLinkingAccount(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Settings" />
      <section className="game-panel space-y-4 p-5">
        <h2 className="text-xl font-bold">Account</h2>
        <p className="text-sm text-muted-foreground">
          {isGuest ? "Guest save on this device" : "Signed in as"}{" "}
          <strong>{email || "temporary guest"}</strong>
        </p>
        {isGuest && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Add an email and password to keep this same character, wallet, inventory, and home
              save available when you sign in on another device.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="save-email">Email for account recovery</Label>
              <Input
                id="save-email"
                type="email"
                autoComplete="email"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="save-password">New password</Label>
              <Input
                id="save-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={recoveryPassword}
                onChange={(event) => setRecoveryPassword(event.target.value)}
              />
            </div>
            <Button disabled={linkingAccount} onClick={() => void linkGuestAccount()}>
              {linkingAccount ? "Saving account…" : "Keep my progress"}
            </Button>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="dn">Display name</Label>
          <div className="flex gap-2">
            <Input
              id="dn"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 border-2 bg-card"
            />
            <Button
              variant="default"
              onClick={() => update(name.trim() ? { display_name: name.trim() } : {})}
            >
              Save
            </Button>
          </div>
        </div>
      </section>
      <section className="game-panel space-y-4 p-5">
        <h2 className="text-xl font-bold">Preferences</h2>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Reduce motion</span>
            <span className="text-xs text-muted-foreground">
              Turn off bouncing and pop-in animations.
            </span>
          </span>
          <Switch
            checked={!!profile?.reduced_motion}
            onCheckedChange={(v) => update({ reduced_motion: v })}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Sound & music</span>
            <span className="text-xs text-muted-foreground">Game audio is not available yet.</span>
          </span>
          <ComingSoon />
        </div>
      </section>
      <section className="game-panel p-5">
        <Button variant="clay" onClick={signOut}>
          Sign out
        </Button>
      </section>
    </div>
  );
}
