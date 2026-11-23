import type { FurnitureResult, FurnitureResults } from "@/lib/venue-furniture-readiness";

export type FurnitureRegistration = {
  token: symbol;
  result?: FurnitureResult;
};

export type FurnitureRegistry = ReadonlyMap<string, FurnitureRegistration>;

export function registerFurniture(
  registry: FurnitureRegistry,
  key: string,
  registration: FurnitureRegistration,
): FurnitureRegistry {
  const current = registry.get(key);

  if (current?.token === registration.token && current?.result === registration.result) {
    return registry;
  }

  const next = new Map(registry);
  next.set(key, registration);

  return next;
}

export function reportFurnitureResult(
  registry: FurnitureRegistry,
  key: string,
  token: symbol,
  result: FurnitureResult,
): FurnitureRegistry {
  const current = registry.get(key);

  if (!current || current.token !== token || current.result === result) {
    return registry;
  }

  const next = new Map(registry);
  next.set(key, { token, result });

  return next;
}

export function unregisterFurniture(
  registry: FurnitureRegistry,
  key: string,
  token: symbol,
): FurnitureRegistry {
  if (registry.get(key)?.token !== token) {
    return registry;
  }

  const next = new Map(registry);
  next.delete(key);

  return next;
}

export function getFurnitureResults(registry: FurnitureRegistry): FurnitureResults {
  return Object.fromEntries(
    Array.from(registry, ([key, registration]) => [key, registration.result]),
  );
}
