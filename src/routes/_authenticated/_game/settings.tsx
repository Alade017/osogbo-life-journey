import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { q, rpc } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/game/ui";
import { WorldAudioSettings } from "@/components/game/WorldAudioSettings";

export const Route = createFileRoute("/_authenticated/_game/settings")({
  head: () => pageMeta("Settings", "Manage your OSUN LIFE account and preferences."),
  component: SettingsPage,
});

export function SettingsPage() {
  const fieldId = useId();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useQuery(q.profile());
  const homeVisitPolicy = useQuery(q.homeVisitPolicy());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [savingBackupEmail, setSavingBackupEmail] = useState(false);
  const homeVisitMutation = useMutation({
    mutationFn: rpc.setHomeVisitAccess,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: q.homeVisitPolicy().queryKey });
      toast.success("Home visit settings saved.");
    },
    onError: (error) => toast.error(error.message),
  });
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
    if (!profile) return false;
    if (patch.display_name !== undefined && !patch.display_name.trim()) {
      toast.error("Enter a display name before saving.");
      return false;
    }
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...patch,
        ...(patch.display_name !== undefined ? { display_name: patch.display_name.trim() } : {}),
      })
      .eq("id", profile.id)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return false;
    }
    qc.setQueryData(["profile"], data);
    await qc.invalidateQueries({ queryKey: q.profile().queryKey });
    toast.success(
      patch.display_name !== undefined ? "Display name updated." : "Preferences saved.",
    );
    return true;
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

  async function addBackupEmail() {
    const address = recoveryEmail.trim();
    if (!address || !address.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSavingBackupEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: address });
      if (error) throw error;
      setRecoveryEmail("");
      toast.success(
        "Check your inbox to verify the backup email. Your username still works for sign-in.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingBackupEmail(false);
    }
  }

  return (
    <div className="game-settings-page mx-auto w-full max-w-2xl space-y-5">
      <PageHeader eyebrow="MAKE IT YOURS" title="Settings" />
      <section className="game-panel space-y-4 p-5">
        <h2 className="text-xl font-bold">Account</h2>
        <p className="text-sm text-muted-foreground">
          {isGuest ? "Legacy guest save on this device" : "Account"}{" "}
          <strong>
            {email.endsWith("@example.com") ? "Username sign-in" : email || "No backup email"}
          </strong>
        </p>
        {!isGuest && email.endsWith("@example.com") && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-4">
            <Label htmlFor={`${fieldId}-backup-email`}>Add a backup email (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Verify it to enable password recovery by email. Your username remains your sign-in
              name.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`${fieldId}-backup-email`}
                type="email"
                autoComplete="email"
                className="min-w-0 flex-1 bg-card"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
              />
              <Button disabled={savingBackupEmail} onClick={() => void addBackupEmail()}>
                {savingBackupEmail ? "Saving…" : "Add email"}
              </Button>
            </div>
          </div>
        )}
        {isGuest && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Add an email and password to keep this same character, wallet, inventory, and home
              save available when you sign in on another device.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-save-email`}>Email for account recovery</Label>
              <Input
                id={`${fieldId}-save-email`}
                type="email"
                autoComplete="email"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-save-password`}>New password</Label>
              <Input
                id={`${fieldId}-save-password`}
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
          <Label htmlFor={`${fieldId}-dn`}>Display name</Label>
          <div className="flex gap-2">
            <Input
              id={`${fieldId}-dn`}
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
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="font-semibold">Sound & music</h3>
          {profile && (
            <WorldAudioSettings
              enabled={profile.sound_enabled}
              onEnabledChange={(sound_enabled) => update({ sound_enabled })}
            />
          )}
        </div>
      </section>
      <section className="game-panel space-y-4 p-5">
        <h2 className="text-xl font-bold">Home privacy</h2>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Allow friend visits</span>
            <span className="text-xs text-muted-foreground">
              Friends can browse your saved layout. Your needs and position stay private.
            </span>
          </span>
          <Switch
            checked={
              !!(homeVisitPolicy.data as { allow_friend_visits?: boolean } | undefined)
                ?.allow_friend_visits
            }
            disabled={
              homeVisitPolicy.isLoading || homeVisitPolicy.isError || homeVisitMutation.isPending
            }
            onCheckedChange={(allow) => homeVisitMutation.mutate(allow)}
            aria-label="Allow friend visits"
          />
        </label>
      </section>
      <section className="game-panel p-5">
        <Button variant="clay" onClick={signOut}>
          Sign out
        </Button>
      </section>
    </div>
  );
}
