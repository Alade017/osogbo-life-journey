type PreloadConnection = {
  saveData?: boolean;
  effectiveType?: string;
};

export function canPreloadVenue(connection?: PreloadConnection): boolean {
  if (connection?.saveData) {
    return false;
  }
  return (
    connection?.effectiveType !== "slow-2g" &&
    connection?.effectiveType !== "2g"
  );
}

export function canPreloadVenueInBrowser(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  if (navigator.onLine === false) {
    return false;
  }
  const network = navigator as Navigator & {
    connection?: PreloadConnection;
  };
  return canPreloadVenue(network.connection);
}
