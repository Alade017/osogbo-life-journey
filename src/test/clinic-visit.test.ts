import { expect, it, vi } from "vitest";
import { parseClinicVisit } from "@/lib/clinic-visit";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
const visit = { id: null, status: "not_checked_in", staffAvailable: false, queuePosition: 0, examEndsAt: null };
it("accepts a server-owned off-duty state without inventing staff", () => {
  expect(parseClinicVisit(visit)).toEqual(visit);
});
it.each([
  null,
  { ...visit, queuePosition: -1 },
  { ...visit, queuePosition: 1.5 },
  { ...visit, status: "examination" },
  { ...visit, examEndsAt: "not-a-date" },
  { ...visit, staffAvailable: undefined },
  { ...visit, assignedStaff: { id: "staff" } },
  { ...visit, staff: { id: "staff", name: "Officer", role: "Care", onDuty: "yes" } },
])("rejects malformed or incomplete clinic state", value => {
  expect(() => parseClinicVisit(value)).toThrow();
});
