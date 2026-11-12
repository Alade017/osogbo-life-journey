import { supabase } from "@/integrations/supabase/client";

export const SUPPORT_KINDS = [
  { value: "suggestion", label: "Suggestion" },
  { value: "complaint", label: "Complaint" },
] as const;

export const SUPPORT_CATEGORIES = [
  { value: "gameplay", label: "Gameplay" },
  { value: "map", label: "Map and travel" },
  { value: "economy", label: "Money and jobs" },
  { value: "housing", label: "Housing" },
  { value: "social", label: "Players and social" },
  { value: "bug", label: "Bug or error" },
  { value: "other", label: "Something else" },
] as const;

export type SupportKind = (typeof SUPPORT_KINDS)[number]["value"];
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];
export type SupportStatus = "received" | "in_progress" | "resolved";

/** Same limits as the database check in submit_support_feedback. */
export const SUPPORT_SUBJECT_LIMITS = { min: 3, max: 120 } as const;
export const SUPPORT_MESSAGE_LIMITS = { min: 10, max: 1000 } as const;

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  received: "Received",
  in_progress: "In progress",
  resolved: "Resolved",
};

export type SupportFeedback = {
  id: string;
  kind: SupportKind;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  created_at: string;
};

export async function listMySupportFeedback(): Promise<SupportFeedback[]> {
  const { data, error } = await supabase
    .from("support_feedback")
    .select("id, kind, category, subject, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as SupportFeedback[];
}

export async function submitSupportFeedback(input: {
  kind: SupportKind;
  category: SupportCategory;
  subject: string;
  message: string;
}): Promise<SupportFeedback> {
  const { data, error } = await supabase.rpc("submit_support_feedback", {
    p_kind: input.kind,
    p_category: input.category,
    p_subject: input.subject,
    p_message: input.message,
  });
  if (error) throw new Error(error.message);
  return data as unknown as SupportFeedback;
}
