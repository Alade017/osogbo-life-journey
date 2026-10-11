import { DEFAULT_HOUSING_SAVE, parseHousingSave, type HousingSave } from "@/lib/housing-service";

export const LOCAL_SAVE_VERSION = 1;
export type VersionedSave<T> = {
  format: "osogbo-life-save";
  version: number;
  savedAt: string;
  payload: T;
};

export type LocalSaveRead<T> = {
  payload: T;
  savedAt: string | null;
  recoveredFromBackup: boolean;
  migrated: boolean;
};

function backupKey(key: string) {
  return `${key}.backup`;
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60_000 && timestamp > 0;
}

function parseEnvelope<T>(raw: string | null, validate: (value: unknown) => T | null) {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Partial<VersionedSave<unknown>>;
    if (candidate.format === "osogbo-life-save") {
      if (candidate.version !== LOCAL_SAVE_VERSION || !validTimestamp(candidate.savedAt))
        return null;
      const payload = validate(candidate.payload);
      return payload ? { payload, savedAt: candidate.savedAt, migrated: false } : null;
    }
    // Version 0 migration: prior releases wrote the housing payload directly.
    const legacyPayload = validate(parsed);
    return legacyPayload ? { payload: legacyPayload, savedAt: null, migrated: true } : null;
  } catch {
    return null;
  }
}

export function readLocalSave<T>(
  key: string,
  validate: (value: unknown) => T | null,
): LocalSaveRead<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    const current = parseEnvelope(storage.getItem(key), validate);
    if (current) return { ...current, recoveredFromBackup: false };
    const backup = parseEnvelope(storage.getItem(backupKey(key)), validate);
    return backup ? { ...backup, recoveredFromBackup: true } : null;
  } catch {
    return null;
  }
}

export function writeLocalSave<T>(
  key: string,
  value: unknown,
  validate: (value: unknown) => T | null,
  now = new Date(),
): boolean {
  if (typeof window === "undefined") return false;
  const payload = validate(value);
  try {
    if (!payload || !validTimestamp(now.toISOString())) return false;
    const storage = window.localStorage;
    const existing = parseEnvelope(storage.getItem(key), validate);
    if (existing) {
      storage.setItem(
        backupKey(key),
        JSON.stringify({
          format: "osogbo-life-save",
          version: LOCAL_SAVE_VERSION,
          savedAt: existing.savedAt ?? now.toISOString(),
          payload: existing.payload,
        } satisfies VersionedSave<T>),
      );
    }
    storage.setItem(
      key,
      JSON.stringify({
        format: "osogbo-life-save",
        version: LOCAL_SAVE_VERSION,
        savedAt: now.toISOString(),
        payload,
      } satisfies VersionedSave<T>),
    );
    return true;
  } catch {
    return false;
  }
}

export function readLocalHousingSave(key: string) {
  return readLocalSave(key, parseHousingSave);
}

export function writeLocalHousingSave(key: string, value: unknown, now = new Date()) {
  return writeLocalSave(key, value, parseHousingSave, now);
}

export function housingSaveFromCloud(
  value: unknown,
): { payload: HousingSave; revision: number; savedAt: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as { payload?: unknown; revision?: unknown; saved_at?: unknown };
  if (row.payload === null && row.revision === 0) return null;
  const payload = parseHousingSave(row.payload);
  if (!payload || !Number.isSafeInteger(row.revision) || (row.revision as number) < 1) return null;
  const savedAt = row.saved_at;
  if (savedAt !== null && !validTimestamp(savedAt)) return null;
  return { payload, revision: row.revision as number, savedAt: (savedAt as string | null) ?? null };
}

export function defaultHousingSave() {
  return parseHousingSave(DEFAULT_HOUSING_SAVE)!;
}
