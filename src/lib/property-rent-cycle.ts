export type RentCycleStatus = "current" | "due" | "grace" | "rescue" | "repossessed";

export type RentCycleTiming = {
  dueAt: string;
  graceEndsAt: string;
  rescueEndsAt: string;
};

export function getRentCycleStatus(timing: RentCycleTiming, now = new Date()): RentCycleStatus {
  const time = now.getTime();
  if (time < Date.parse(timing.dueAt)) return "current";
  if (time < Date.parse(timing.graceEndsAt)) return "grace";
  if (time < Date.parse(timing.rescueEndsAt)) return "rescue";
  return "repossessed";
}

export function getRentCycleTiming(dueAt: Date): RentCycleTiming {
  const due = dueAt.getTime();
  return {
    dueAt: dueAt.toISOString(),
    graceEndsAt: new Date(due + 3 * 24 * 60 * 60 * 1000).toISOString(),
    rescueEndsAt: new Date(due + 4 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function rentRescueInstallment(principalMinor: number) {
  if (!Number.isSafeInteger(principalMinor) || principalMinor <= 0)
    throw new Error("INVALID_RENT_AMOUNT");
  return Math.ceil(principalMinor / 4);
}
