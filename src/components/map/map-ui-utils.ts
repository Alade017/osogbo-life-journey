export function formatMapEventEnd(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatGameHourInLagos(hour: number) {
  const date = new Date(Date.UTC(2020, 0, 1, hour - 1, 0));
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
export function formatMapNaira(value: number) {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}
