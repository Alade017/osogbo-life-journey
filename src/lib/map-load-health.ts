export type MapFailureReason =
  "webgl-unavailable" | "style-unavailable" | "source-unavailable" | "load-timeout" | "map-runtime";

export type MapPreflightResult =
  | { ok: true; sourceIds: string[] }
  | { ok: false; reason: "style-unavailable" | "source-unavailable" };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type MapStyleDocument = {
  sources?: Record<string, { url?: unknown }>;
};

const OPTIONAL_SOURCE_IDS = new Set(["osogbo-elevation-hillshade", "osogbo-orientation-landmarks"]);

function isHttpUrl(value: string) {
  return value.startsWith("https://") || value.startsWith("http://");
}

function resolveSourceUrl(sourceUrl: string, styleUrl: string) {
  if (!isHttpUrl(styleUrl)) return sourceUrl;
  try {
    return new URL(sourceUrl, styleUrl).toString();
  } catch {
    return sourceUrl;
  }
}

/** Checks WebGL without depending on MapLibre, allowing failure before its worker starts. */
export function isWebGlAvailable(documentLike: Pick<Document, "createElement"> = document) {
  try {
    const canvas = documentLike.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

/**
 * Fetches the style and remote TileJSON descriptors before MapLibre starts.
 * This catches provider blocks where MapLibre never emits a useful error event.
 */
export async function preflightMapStyle(
  styleUrl: string,
  options: {
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  } = {},
): Promise<MapPreflightResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestInit: RequestInit = {
    cache: "no-store",
    ...(options.signal ? { signal: options.signal } : {}),
  };
  let styleResponse: Response;
  try {
    styleResponse = await fetchImpl(styleUrl, requestInit);
  } catch {
    return { ok: false, reason: "style-unavailable" };
  }
  if (!styleResponse.ok) return { ok: false, reason: "style-unavailable" };

  let style: MapStyleDocument;
  try {
    style = (await styleResponse.json()) as MapStyleDocument;
  } catch {
    return { ok: false, reason: "style-unavailable" };
  }

  const sourceEntries = Object.entries(style.sources ?? {}).filter(
    ([sourceId]) => !OPTIONAL_SOURCE_IDS.has(sourceId),
  );
  const remoteDescriptors = sourceEntries.flatMap(([, source]) => {
    if (typeof source.url !== "string") return [];
    const resolved = resolveSourceUrl(source.url, styleUrl);
    return isHttpUrl(resolved) ? [resolved] : [];
  });

  try {
    const responses = await Promise.all(
      remoteDescriptors.map((url) => fetchImpl(url, requestInit)),
    );
    if (responses.some((response) => !response.ok)) {
      return { ok: false, reason: "source-unavailable" };
    }
  } catch {
    return { ok: false, reason: "source-unavailable" };
  }

  return { ok: true, sourceIds: sourceEntries.map(([sourceId]) => sourceId) };
}

export function isOptionalMapSource(sourceId: string | undefined) {
  return sourceId ? OPTIONAL_SOURCE_IDS.has(sourceId) : false;
}

export function isCriticalMapError(
  event: unknown,
  options: { usable: boolean; baseSourceIds: ReadonlySet<string> },
) {
  if (options.usable) return false;
  const candidate = event as {
    sourceId?: string;
    error?: { message?: string; status?: number };
    status?: number;
  };
  if (isOptionalMapSource(candidate.sourceId)) return false;
  if (candidate.sourceId && options.baseSourceIds.has(candidate.sourceId)) return true;

  const status = candidate.status ?? candidate.error?.status;
  if (status === 401 || status === 403 || (status !== undefined && status >= 500)) return true;
  const message = candidate.error?.message?.toLowerCase() ?? "";
  return /forbidden|unauthorized|failed to fetch|network|source|tile/.test(message);
}

export function isBaseSourceReady(event: unknown, baseSourceIds: ReadonlySet<string>) {
  const candidate = event as {
    sourceId?: string;
    isSourceLoaded?: boolean;
    sourceDataType?: string;
  };
  return Boolean(
    candidate.sourceId &&
    baseSourceIds.has(candidate.sourceId) &&
    candidate.isSourceLoaded &&
    candidate.sourceDataType !== "metadata",
  );
}
