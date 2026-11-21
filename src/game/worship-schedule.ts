/**
 * When each worship place holds its prayers. The server's worship_prayer_times table holds the same
 * windows and is what it checks; this copy is what the screen shows.
 * Weekdays use the game's numbering: 0 = Monday ... 6 = Sunday.
 */
export type WorshipPrayer = {
  id: string;
  label: string;
  weekdays: readonly number[];
  /** Minutes after midnight, game time. */
  startMinute: number;
  endMinute: number;
};

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;

const MOSQUE_PRAYERS: readonly WorshipPrayer[] = [
  { id: "fajr", label: "Fajr", weekdays: EVERY_DAY, startMinute: 300, endMinute: 360 },
  { id: "dhuhr", label: "Dhuhr", weekdays: EVERY_DAY, startMinute: 780, endMinute: 840 },
  { id: "asr", label: "Asr", weekdays: EVERY_DAY, startMinute: 960, endMinute: 1020 },
  { id: "maghrib", label: "Maghrib", weekdays: EVERY_DAY, startMinute: 1110, endMinute: 1170 },
  { id: "isha", label: "Isha", weekdays: EVERY_DAY, startMinute: 1200, endMinute: 1260 },
];

const CHURCH_PRAYERS: readonly WorshipPrayer[] = [
  // Wednesday, Thursday and Friday meetings, and the Sunday general service, at any hour.
  {
    id: "service",
    label: "Church service",
    weekdays: [2, 3, 4, 6],
    startMinute: 0,
    endMinute: 1440,
  },
];

export const WORSHIP_PRAYERS: Readonly<Record<string, readonly WorshipPrayer[]>> = {
  "osogbo-central-mosque": MOSQUE_PRAYERS,
  "osogbo-grand-mosque": MOSQUE_PRAYERS,
  "oke-fia-community-church": CHURCH_PRAYERS,
};

export function prayersFor(slug: string): readonly WorshipPrayer[] {
  return WORSHIP_PRAYERS[slug] ?? [];
}

/** True when this prayer is held on this game weekday at this minute of the game day. */
export function isPrayerDue(prayer: WorshipPrayer, weekday: number, minuteOfDay: number) {
  return (
    prayer.weekdays.includes(weekday) &&
    minuteOfDay >= prayer.startMinute &&
    minuteOfDay < prayer.endMinute
  );
}

function clock(minuteOfDay: number) {
  const hour = Math.floor(minuteOfDay / 60) % 24;
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The window as shown to the visitor, for example "13:00–14:00". */
export function prayerWindowLabel(prayer: WorshipPrayer) {
  if (prayer.startMinute === 0 && prayer.endMinute === 1440) return "Any time on service days";
  return `${clock(prayer.startMinute)}–${clock(prayer.endMinute)}`;
}
