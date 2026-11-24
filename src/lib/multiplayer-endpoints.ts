/** Localhost is a development default, never a public player's production server. */
export function multiplayerEndpoints(configured: string | undefined, development: boolean) {
  const endpoints =
    configured
      ?.split(",")
      .map((endpoint) => endpoint.trim())
      .filter(Boolean) ?? [];
  if (!endpoints.length) {
    if (development) return ["ws://127.0.0.1:2567"];
    throw new Error(
      "The multiplayer server is not configured. Set VITE_MULTIPLAYER_URL for this deployment.",
    );
  }
  return endpoints.map((endpoint) => {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error("The multiplayer server URL is invalid.");
    }
    if (
      !["ws:", "wss:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "The multiplayer server must use a WebSocket URL without credentials or query parameters.",
      );
    }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!development && (local || url.protocol !== "wss:")) {
      throw new Error(
        "The deployed multiplayer server must use a public secure WebSocket URL (wss://).",
      );
    }
    return endpoint;
  });
}
