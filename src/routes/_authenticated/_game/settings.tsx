import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Check,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Music2,
  ShieldCheck,
  LayoutGrid,
  Sparkles,
  Eye,
  UserRound,
  Users,
  Volume2,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { q, rpc } from "@/lib/game";
import { parseAppTileStyle, type AppTileStyle } from "@/lib/app-tile-style";
import { pageMeta } from "@/lib/seo";
import { Avatar } from "@/components/game/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ProfilePage } from "./profile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  disableGameAudio,
  enableGameAudio,
  playGameSound,
  readGameAudioLevels,
  setGameAudioLevels,
} from "@/lib/game-audio";
import type { Appearance } from "@/game/avatar-appearance";
import "@/components/game/settings-hub.css";

export const Route = createFileRoute("/_authenticated/_game/settings")({
  head: () => pageMeta("Settings", "Manage your OSUN LIFE account and preferences."),
  component: SettingsPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  music_enabled: boolean;
  effects_enabled: boolean;
  sound_enabled: boolean;
  reduced_motion: boolean;
  app_tile_style: string;
};

type Patch = Partial<Pick<Profile, "music_enabled" | "effects_enabled" | "reduced_motion">> & {
  display_name?: string;
};

type Channel = "music" | "effects";

const CHANNELS: Record<
  Channel,
  { flag: "music_enabled" | "effects_enabled"; label: string; hint: string; fallback: number }
> = {
  music: {
    flag: "music_enabled",
    label: "Background music",
    hint: "The town soundtrack that plays while you explore.",
    fallback: 0.4,
  },
  effects: {
    flag: "effects_enabled",
    label: "Sound effects",
    hint: "Taps, coins and cues when things happen around you.",
    fallback: 0.65,
  },
};

const NAME_MAX = 40;

function useSavedFlash() {
  const [saved, setSaved] = useState<string | null>(null);
  function flash(key: string) {
    setSaved(key);
    window.setTimeout(() => setSaved((current) => (current === key ? null : current)), 1800);
  }
  return { saved, flash };
}

export function SettingsPage() {
  const fieldId = useId();
  const qc = useQueryClient();
  const { data: profile, isPending, isError, error, isFetching, refetch } = useQuery(q.profile());
  const { data: character } = useQuery(q.character());
  const homeVisit = useQuery(q.homeVisitPolicy());
  const { saved, flash } = useSavedFlash();

  const [nameDraft, setNameDraft] = useState("");

  const { data: summaryData } = useQuery(q.accountSummary());
  const summary = summaryData as
    | { email?: string; is_guest?: boolean; account_type?: "guest" | "username" | "email" }
    | null
    | undefined;
  const account = { email: summary?.email ?? "", isGuest: summary?.is_guest ?? false };
  const isUsernameAccount = summary?.account_type === "username";

  useEffect(() => setNameDraft(profile?.display_name ?? ""), [profile?.display_name]);

  const savePreferences = useMutation({
    mutationFn: (patch: Patch) =>
      rpc.updateMySettings({
        displayName: patch.display_name,
        musicEnabled: patch.music_enabled,
        effectsEnabled: patch.effects_enabled,
        reducedMotion: patch.reduced_motion,
      }),
    onSuccess: async (data, patch) => {
      qc.setQueryData(
        q.profile().queryKey,
        data as unknown as Database["public"]["Tables"]["profiles"]["Row"],
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const setTileStyle = useMutation({
    mutationFn: (style: AppTileStyle) => rpc.setMyAppTileStyle(style),
    onSuccess: async () => {
      flash("app_tile_style");
      await qc.invalidateQueries({ queryKey: q.profile().queryKey });
    },
    onError: (e) => toast.error(e.message),
  });

  const setFriendVisits = useMutation({
    mutationFn: (allow: boolean) => rpc.setHomeVisitAccess(allow),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: q.homeVisitPolicy().queryKey });
      flash("home_visits");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isPending) {
    return (
      <div className="sx-page">
        <p className="sx-loading" role="status">
          Loading your settings…
        </p>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="sx-page">
        <section className="sx-card sx-card-danger" role="alert">
          <p className="sx-error">
            Your settings couldn't be loaded.{error?.message ? ` ${error.message}` : ""}
          </p>
          <Button className="sx-btn-ghost" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </section>
      </div>
    );
  }

  const trimmedName = nameDraft.trim();
  const nameError =
    trimmedName.length === 0
      ? "Enter a display name."
      : trimmedName.length > NAME_MAX
        ? `Keep it under ${NAME_MAX} characters.`
        : null;
  const nameDirty = trimmedName !== (profile.display_name ?? "");

  const friendVisits = !!(homeVisit.data as { allow_friend_visits?: boolean } | undefined)
    ?.allow_friend_visits;
  const accountLabel = account.isGuest
    ? "Guest save"
    : isUsernameAccount
      ? "Username sign-in"
      : account.email || "Account";
  const appearance = (character?.appearance ?? {}) as unknown as Appearance;

  return (
    <div className="sx-page" data-reduced={profile.reduced_motion ? "true" : "false"}>
      <header className="sx-hero">
        <div className="sx-hero-avatar" aria-hidden="true">
          <Avatar appearance={appearance} gender={character?.gender ?? "nonbinary"} size={84} />
        </div>
        <div className="sx-hero-copy">
          <p className="sx-eyebrow">Make it yours</p>
          <h1>{profile.display_name || "Your character"}</h1>
          <span className={`sx-badge${account.isGuest ? " is-guest" : ""}`}>
            <ShieldCheck aria-hidden="true" /> {accountLabel}
          </span>
        </div>
      </header>

      <Section
        id="sx-name"
        icon={UserRound}
        title="Display name"
        description="How other players see you around Osogbo."
      >
        <form
          className="sx-field"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nameError && nameDirty) savePreferences.mutate({ display_name: trimmedName });
          }}
        >
          <Label htmlFor={`${fieldId}-name`}>Name</Label>
          <div className="sx-inline">
            <Input
              id={`${fieldId}-name`}
              className="sx-input"
              autoComplete="nickname"
              maxLength={NAME_MAX + 10}
              value={nameDraft}
              aria-invalid={!!nameError}
              aria-describedby={`${fieldId}-hint`}
              onChange={(event) => setNameDraft(event.target.value)}
            />
            <Button
              type="submit"
              className="sx-btn-primary"
              disabled={!nameDirty || !!nameError || savePreferences.isPending}
            >
              {savePreferences.isPending ? "Saving…" : "Save name"}
            </Button>
          </div>
          <div className="sx-field-foot">
            <small id={`${fieldId}-hint`} className={nameError ? "sx-error" : "sx-hint"}>
              {nameError ?? `${trimmedName.length}/${NAME_MAX} characters`}
            </small>
            <SavedPill show={saved === "display_name"} />
          </div>
        </form>
      </Section>

      <Section
        id="sx-sound"
        icon={Volume2}
        title="Sound"
        description="Tune the town soundtrack and game cues separately."
        footer={<SavedPill show={saved === "music_enabled" || saved === "effects_enabled"} />}
      >
        <AudioControls profile={profile} onSave={(patch) => savePreferences.mutate(patch)} />
      </Section>

      <Section
        id="sx-tiles"
        icon={LayoutGrid}
        title="App tiles"
        description="Choose how app icons look on your phone. This follows your account to any device."
        footer={<SavedPill show={saved === "app_tile_style"} />}
      >
        <div className="sx-tile-choices" role="radiogroup" aria-label="App tile style">
          {(["rounded", "circle"] as const).map((style) => {
            const selected = parseAppTileStyle(profile.app_tile_style) === style;
            return (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={selected}
                className="sx-tile-choice"
                disabled={setTileStyle.isPending}
                onClick={() => {
                  if (!selected) setTileStyle.mutate(style);
                }}
              >
                <span className={`sx-tile-sample sx-tile-sample-${style}`} aria-hidden="true">
                  <Sparkles size={16} />
                </span>
                <span>{style === "circle" ? "Circle" : "Rounded"}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        id="sx-display"
        icon={Sparkles}
        title="Display"
        description="Choose how much the game moves."
        footer={<SavedPill show={saved === "reduced_motion"} />}
      >
        <div className="sx-row">
          <div className="sx-row-copy">
            <Label htmlFor={`${fieldId}-motion`} className="sx-row-title">
              Reduce motion
            </Label>
            <p className="sx-row-hint">Turns off bouncing and pop-in animations.</p>
          </div>
          <Switch
            id={`${fieldId}-motion`}
            checked={profile.reduced_motion}
            disabled={savePreferences.isPending}
            onCheckedChange={(value) => savePreferences.mutate({ reduced_motion: value })}
          />
        </div>
        <div className="sx-motion" aria-hidden="true">
          <span className="sx-motion-dot" />
        </div>
      </Section>

      <Section
        id="sx-privacy"
        icon={Eye}
        title="Home privacy"
        description="Decide whether friends can walk through your home."
        footer={<SavedPill show={saved === "home_visits"} />}
      >
        <div className="sx-row">
          <div className="sx-row-copy">
            <Label htmlFor={`${fieldId}-visits`} className="sx-row-title">
              Allow friend visits
            </Label>
            <p className="sx-row-hint">Friends can browse your saved layout.</p>
          </div>
          <Switch
            id={`${fieldId}-visits`}
            checked={friendVisits}
            disabled={homeVisit.isLoading || homeVisit.isError || setFriendVisits.isPending}
            onCheckedChange={(allow) => setFriendVisits.mutate(allow)}
          />
        </div>
        {homeVisit.isError && (
          <p className="sx-error" role="alert">
            Home visit settings couldn't be loaded.
          </p>
        )}
        <ul className="sx-visibility" aria-label="What friends can and cannot see">
          <li>
            <Users aria-hidden="true" /> Friends can see your home layout and furniture.
          </li>
          <li>
            <Lock aria-hidden="true" /> Your needs, location and money stay private.
          </li>
        </ul>
      </Section>

      <AccountSection
        fieldId={fieldId}
        email={account.email}
        isGuest={account.isGuest}
        isUsernameAccount={isUsernameAccount}
        accountLabel={accountLabel}
        onChanged={() => void qc.invalidateQueries({ queryKey: q.accountSummary().queryKey })}
      />

      <SessionSection isGuest={account.isGuest} />
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  description,
  footer,
  tone = "default",
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  footer?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <section
      className={`sx-card${tone === "danger" ? " sx-card-danger" : ""}`}
      aria-labelledby={id}
    >
      <header className="sx-card-head">
        <span className="sx-icon" aria-hidden="true">
          <Icon />
        </span>
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="sx-card-body">{children}</div>
      {footer && <div className="sx-card-foot">{footer}</div>}
    </section>
  );
}

function SavedPill({ show }: { show: boolean }) {
  return (
    <span className={`sx-saved${show ? " is-on" : ""}`} role="status" aria-live="polite">
      {show && (
        <>
          <Check aria-hidden="true" /> Saved
        </>
      )}
    </span>
  );
}

function AudioControls({ profile, onSave }: { profile: Profile; onSave: (patch: Patch) => void }) {
  const [levels, setLevels] = useState(() => readGameAudioLevels());
  const [blocked, setBlocked] = useState(false);

  // Volume is stored in this browser. The on/off state comes from the account.
  // Keep the two in step whenever the account flags change.
  useEffect(() => {
    const next = { ...readGameAudioLevels() };
    (Object.keys(CHANNELS) as Channel[]).forEach((channel) => {
      const cfg = CHANNELS[channel];
      if (!profile[cfg.flag]) next[channel] = 0;
      else if (!next[channel]) next[channel] = cfg.fallback;
    });
    setGameAudioLevels(next);
    setLevels(next);
  }, [profile]);

  async function applyVolume(channel: Channel, volume: number): Promise<boolean> {
    const wasSilent = levels[channel] === 0;
    const next = { ...levels, [channel]: volume };
    // Starting audio needs a user gesture. A slider drag or switch tap counts.
    if (volume > 0 && wasSilent && !(await enableGameAudio(next))) {
      setBlocked(true);
      toast.error("Your browser needs one tap on this page before audio can start.");
      return false;
    }
    setBlocked(false);
    setGameAudioLevels(next);
    setLevels(next);
    if (!next.music && !next.effects) await disableGameAudio();
    return true;
  }

  async function toggle(channel: Channel, on: boolean) {
    const cfg = CHANNELS[channel];
    const volume = on ? levels[channel] || cfg.fallback : 0;
    if (!(await applyVolume(channel, volume))) return;
    onSave({ [cfg.flag]: on } as Patch);
  }

  return (
    <>
      {(Object.keys(CHANNELS) as Channel[]).map((channel) => {
        const cfg = CHANNELS[channel];
        const on = profile[cfg.flag];
        const Icon = channel === "music" ? Music2 : Waves;
        return (
          <div key={channel} className={`sx-channel${on ? " is-on" : ""}`}>
            <div className="sx-channel-head">
              <span className="sx-channel-title">
                <Icon aria-hidden="true" />
                <strong>{cfg.label}</strong>
              </span>
              <Switch
                checked={on}
                aria-label={`${cfg.label} on or off`}
                onCheckedChange={(value) => void toggle(channel, value)}
              />
            </div>
            <p className="sx-row-hint">{cfg.hint}</p>
            <div className="sx-volume">
              <Slider
                className="sx-slider"
                aria-label={`${cfg.label} volume`}
                min={0}
                max={100}
                step={1}
                value={[Math.round(levels[channel] * 100)]}
                onValueChange={([value]) => void applyVolume(channel, (value ?? 0) / 100)}
                onValueCommit={([value]) => {
                  const enabled = (value ?? 0) > 0;
                  if (enabled !== on) onSave({ [cfg.flag]: enabled } as Patch);
                }}
              />
              <output className="sx-volume-value">{Math.round(levels[channel] * 100)}%</output>
            </div>
          </div>
        );
      })}
      <div className="sx-row">
        <span className="sx-row-hint">Hear a sample at your current effects volume.</span>
        <Button
          className="sx-btn-ghost"
          onClick={() => {
            if (!profile.effects_enabled || levels.effects === 0) {
              toast.message("Turn on sound effects to hear a sample.");
              return;
            }
            playGameSound("ui");
          }}
        >
          Play sample
        </Button>
      </div>
      {blocked && (
        <p className="sx-error" role="alert">
          Tap the page once to allow audio, then try again.
        </p>
      )}
    </>
  );
}

function AccountSection({
  fieldId,
  email,
  isGuest,
  isUsernameAccount,
  accountLabel,
  onChanged,
}: {
  fieldId: string;
  email: string;
  isGuest: boolean;
  isUsernameAccount: boolean;
  accountLabel: string;
  onChanged: () => void;
}) {
  const [protectEmail, setProtectEmail] = useState("");
  const [protectPassword, setProtectPassword] = useState("");
  const [backupEmail, setBackupEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function keepProgress() {
    if (!protectEmail.trim() || protectPassword.length < 8) {
      setError("Enter an email and a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: protectEmail.trim(),
        password: protectPassword,
      });
      if (updateError) throw updateError;
      onChanged();
      setProtectEmail("");
      setProtectPassword("");
      toast.success("Your progress is protected. Check your inbox if asked to confirm.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addBackupEmail() {
    const address = backupEmail.trim();
    if (!address.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: address });
      if (updateError) throw updateError;
      setBackupEmail("");
      toast.success("Check your inbox to verify the backup email.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const description = isGuest
    ? "This save lives on this device until you protect it."
    : isUsernameAccount
      ? "Your username is your sign-in. A backup email lets you recover your password."
      : `Signed in as ${email || "this account"}.`;

  return (
    <Section id="sx-account" icon={KeyRound} title="Account" description={description}>
      <div className="sx-status">
        <span className="sx-status-icon" aria-hidden="true">
          {isGuest ? <ShieldCheck /> : <Mail />}
        </span>
        <div>
          <strong>{accountLabel}</strong>
          <small>
            {isGuest
              ? "Add an email and password to use this save on another device."
              : "Your character, wallet and home stay with this account."}
          </small>
        </div>
      </div>

      {isGuest && (
        <form
          className="sx-field"
          onSubmit={(event) => {
            event.preventDefault();
            void keepProgress();
          }}
        >
          <Label htmlFor={`${fieldId}-protect-email`}>Email for account recovery</Label>
          <Input
            id={`${fieldId}-protect-email`}
            className="sx-input"
            type="email"
            autoComplete="email"
            value={protectEmail}
            onChange={(event) => setProtectEmail(event.target.value)}
          />
          <Label htmlFor={`${fieldId}-protect-password`}>New password</Label>
          <Input
            id={`${fieldId}-protect-password`}
            className="sx-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={protectPassword}
            onChange={(event) => setProtectPassword(event.target.value)}
          />
          <small className="sx-hint">At least 8 characters.</small>
          <Button type="submit" className="sx-btn-primary" disabled={busy}>
            {busy ? "Protecting your save…" : "Keep my progress"}
          </Button>
        </form>
      )}

      {isUsernameAccount && (
        <form
          className="sx-field"
          onSubmit={(event) => {
            event.preventDefault();
            void addBackupEmail();
          }}
        >
          <Label htmlFor={`${fieldId}-backup`}>Backup email (optional)</Label>
          <div className="sx-inline">
            <Input
              id={`${fieldId}-backup`}
              className="sx-input"
              type="email"
              autoComplete="email"
              value={backupEmail}
              onChange={(event) => setBackupEmail(event.target.value)}
            />
            <Button type="submit" className="sx-btn-ghost" disabled={busy}>
              {busy ? "Saving…" : "Add email"}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p className="sx-error" role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}

function SessionSection({ isGuest }: { isGuest: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      setSigningOut(false);
      return;
    }
    qc.clear();
    await navigate({ to: "/" });
  }

  return (
    <Section
      id="sx-session"
      icon={LogOut}
      title="Session"
      description="Sign out of your account on this device."
      tone="danger"
    >
      {isGuest ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="sx-btn-danger">Sign out</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of a guest save?</AlertDialogTitle>
              <AlertDialogDescription>
                This save is attached to this temporary sign-in. Without an email and password, you
                may not be able to get back to it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay signed in</AlertDialogCancel>
              <AlertDialogAction onClick={() => void signOut()}>Sign out anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button className="sx-btn-danger" disabled={signingOut} onClick={() => void signOut()}>
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      )}
    </Section>
  );
}
