import { housingReliefFetch } from "@/lib/housing-relief-client";

export type GigOpen = {
  id: string;
  title: string;
  description: string;
  pay: number;
  expiresAt: string;
  posterName: string;
  applied: boolean;
};

export type GigMine = {
  id: string;
  title: string;
  description: string;
  pay: number;
  status: "open" | "accepted" | "completed" | "expired" | "cancelled";
  expiresAt: string;
  workerId: string | null;
  workerName: string | null;
  applicants: Array<{ characterId: string; name: string; offer: number | null }>;
};

export type GigJob = {
  id: string;
  title: string;
  pay: number;
  status: GigMine["status"];
  expiresAt: string;
  posterName: string;
  posterId: string;
};

export type GigBoard = { open: GigOpen[]; mine: GigMine[]; jobs: GigJob[] };

export const gigBoardQueryKey = (characterId: string) => ["gigWork", characterId] as const;

export async function getGigBoard(): Promise<GigBoard> {
  const value = (await housingReliefFetch("/api/gig-work")) as Partial<GigBoard> | null;
  if (
    !value ||
    !Array.isArray(value.open) ||
    !Array.isArray(value.mine) ||
    !Array.isArray(value.jobs)
  )
    throw new Error("Gig Work is unavailable right now.");
  return value as GigBoard;
}

export type GigAction =
  | { action: "post"; title: string; description: string; pay: number }
  | { action: "apply"; gigId: string; offer?: number | null }
  | { action: "accept"; gigId: string; applicantId: string }
  | { action: "confirm" | "cancel"; gigId: string };

export async function submitGigAction(input: GigAction) {
  return housingReliefFetch("/api/gig-work", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}
