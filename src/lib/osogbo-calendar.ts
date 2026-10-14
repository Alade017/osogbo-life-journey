// Real-world Osogbo calendar. Dates come from official listings and are shown as
// information only: joining in-game events still follows the game clock.
// Only add an entry when a source page confirms its date.

export type OsogboCalendarEvent = {
  id: string;
  title: string;
  /** Calendar date in Africa/Lagos, YYYY-MM-DD. */
  startsOn: string;
  venue: string;
  sourceUrl: string;
};

const OFFICIAL_FESTIVAL_PAGE = "https://osunosogbo.ng/event";

export const OSOGBO_CALENDAR: readonly OsogboCalendarEvent[] = [
  {
    id: "festival-2027-youth-talent",
    title: "Youth Talent Showcase",
    startsOn: "2027-08-02",
    venue: "Osogbo",
    sourceUrl: OFFICIAL_FESTIVAL_PAGE,
  },
  {
    id: "festival-2027-fashion-pageant",
    title: "Fashion and Beauty Pageant",
    startsOn: "2027-08-02",
    venue: "Osogbo",
    sourceUrl: OFFICIAL_FESTIVAL_PAGE,
  },
  {
    id: "festival-2027-sports-games",
    title: "Sports and Games",
    startsOn: "2027-08-03",
    venue: "Osogbo",
    sourceUrl: OFFICIAL_FESTIVAL_PAGE,
  },
  {
    id: "festival-2027-entrepreneurial-fair",
    title: "Entrepreneurial Fair",
    startsOn: "2027-08-04",
    venue: "Osogbo",
    sourceUrl: OFFICIAL_FESTIVAL_PAGE,
  },
  {
    id: "festival-2027-sacred-colloquium",
    title: "Susanne Wenger's Sacred Colloquium",
    startsOn: "2027-08-04",
    venue: "Osogbo",
    sourceUrl: OFFICIAL_FESTIVAL_PAGE,
  },
];

/** Today's date in Lagos as YYYY-MM-DD, independent of the viewer's device timezone. */
export function lagosDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Calendar events starting on or after `today` (YYYY-MM-DD), soonest first. */
export function upcomingCalendarEvents(
  today: string,
  limit = 3,
  calendar: readonly OsogboCalendarEvent[] = OSOGBO_CALENDAR,
): OsogboCalendarEvent[] {
  return calendar
    .filter((event) => event.startsOn >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Formats a YYYY-MM-DD calendar date for Nigerian readers, e.g. "2 Aug 2027". */
export function formatCalendarDate(startsOn: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${startsOn}T12:00:00+01:00`));
}
