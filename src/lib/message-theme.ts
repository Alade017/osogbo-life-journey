import { supabase } from "@/integrations/supabase/client";

export const MESSAGE_THEMES = ["porcelain", "leaf", "ink", "warm"] as const;
export type MessageTheme = (typeof MESSAGE_THEMES)[number];

const DEFAULT_THEME: MessageTheme = "porcelain";
const LOCAL_KEY = "osogbo-message-theme";

export function isMessageTheme(value: unknown): value is MessageTheme {
  return typeof value === "string" && (MESSAGE_THEMES as readonly string[]).includes(value);
}

/** This browser's last choice. Used only for the first paint and as a fallback. */
export function readLocalMessageTheme(): MessageTheme {
  try {
    const value = localStorage.getItem(LOCAL_KEY);
    return isMessageTheme(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function writeLocalMessageTheme(theme: MessageTheme) {
  try {
    localStorage.setItem(LOCAL_KEY, theme);
  } catch {
    /* Storage may be unavailable. */
  }
}

/** The theme saved on the account, so it matches on every device. */
export async function fetchAccountMessageTheme(): Promise<MessageTheme> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return readLocalMessageTheme();
  const { data, error } = await supabase
    .from("profiles")
    .select("message_theme")
    .eq("id", uid)
    .maybeSingle();
  if (error) return readLocalMessageTheme();
  const value = data?.message_theme;
  const theme = isMessageTheme(value) ? value : readLocalMessageTheme();
  writeLocalMessageTheme(theme);
  return theme;
}

/** Saves the choice to the account. Falls back to this browser if the server cannot save it yet. */
export async function saveAccountMessageTheme(theme: MessageTheme): Promise<void> {
  writeLocalMessageTheme(theme);
  const { error } = await supabase.rpc("set_my_message_theme", { p_theme: theme });
  if (error) throw new Error(error.message);
}
