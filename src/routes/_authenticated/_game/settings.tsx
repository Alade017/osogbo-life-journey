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
  useEffect(() => setName(profile?.display_name ?? ""), [profile?.display_name]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
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
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  }

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Settings" />
      <section className="brick space-y-4 p-5">
        <h2 className="text-xl font-bold">Account</h2>
        <p className="text-sm text-muted-foreground">
          Signed in as <strong>{email}</strong>
        </p>
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
              variant="brick"
              onClick={() => update(name.trim() ? { display_name: name.trim() } : {})}
            >
              Save
            </Button>
          </div>
        </div>
      </section>
      <section className="brick space-y-4 p-5">
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
      <section className="brick p-5">
        <Button variant="clay" onClick={signOut}>
          Sign out
        </Button>
      </section>
    </div>
  );
}
