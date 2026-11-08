type NetworkInformation = { effectiveType?: string; saveData?: boolean };

/** True on connections where pages are likely to load slowly, or the visitor asked for less data. */
export function isSlowNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return false;
  return (
    connection.saveData === true || ["slow-2g", "2g", "3g"].includes(connection.effectiveType ?? "")
  );
}
