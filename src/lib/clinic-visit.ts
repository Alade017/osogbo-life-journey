import { supabase } from "@/integrations/supabase/client";
export type ClinicVisitStatus =
  "not_checked_in" | "waiting" | "examination" | "discharged" | "cancelled";
export type ClinicStaff = { id: string; name: string; role: string };
export type ClinicVisit = {
  staffAvailable?: boolean;
  staff?: (ClinicStaff & { onDuty: boolean; shiftStart?: number; shiftEnd?: number }) | null;
  assignedStaff?: ClinicStaff | null;
  id: string | null;
  status: ClinicVisitStatus;
  queuePosition: number;
  examEndsAt: string | null;
};
export async function clinicVisitCommand(
  command: "status" | "check_in" | "new_visit" | "cancel",
): Promise<ClinicVisit> {
  const { data, error } = await supabase.rpc(
    "clinic_visit_command" as never,
    { p_command: command } as never,
  );
  if (error) throw new Error("Clinic visit service is unavailable. Please retry.");
  return parseClinicVisit(data);
}

export function parseClinicVisit(data: unknown): ClinicVisit {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The clinic returned an invalid visit state.");
  const result = data as ClinicVisit;
  if (
    (result.id !== null && typeof result.id !== "string") ||
    typeof result.staffAvailable !== "boolean" ||
    !Number.isInteger(result.queuePosition) || result.queuePosition < 0 ||
    (result.examEndsAt !== null && (typeof result.examEndsAt !== "string" || !Number.isFinite(Date.parse(result.examEndsAt)))) ||
    !["not_checked_in", "waiting", "examination", "discharged", "cancelled"].includes(result.status)
  )
    throw new Error("The clinic returned an invalid visit state.");
  const validStaff = (staff: unknown): staff is ClinicStaff => {
    if (!staff || typeof staff !== "object" || Array.isArray(staff)) return false;
    const entry = staff as Record<string, unknown>;
    return ["id", "name", "role"].every(key => typeof entry[key] === "string" && (entry[key] as string).length > 0);
  };
  if ((result.assignedStaff != null && !validStaff(result.assignedStaff)) ||
      (result.staff != null && (!validStaff(result.staff) || typeof result.staff.onDuty !== "boolean")) ||
      (result.status !== "not_checked_in" && !result.id)) {
    throw new Error("The clinic returned an invalid visit state.");
  }
  if (result.staff && [result.staff.shiftStart, result.staff.shiftEnd].some(hour => hour !== undefined && (!Number.isInteger(hour) || hour < 0 || hour > 23))) {
    throw new Error("The clinic returned invalid staff hours.");
  }
  return result;
}
