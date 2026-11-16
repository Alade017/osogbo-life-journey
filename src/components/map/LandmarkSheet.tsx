import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { MapPin, X } from "lucide-react";
import { requestMapLandmark } from "@/lib/map-api";
import { LandmarkDetailsContent } from "./LandmarkDetailsContent";

type Props = Omit<ComponentProps<typeof LandmarkDetailsContent>, "detailsQuery"> & {
  onClose: () => void;
  onBackToTransport: () => void;
};
/** Compatibility wrapper for callers outside the unified destination sheet. */
export function LandmarkSheet({ onClose, onBackToTransport, ...props }: Props) {
  const detailsQuery = useQuery({
    queryKey: ["mapLandmarkDetails", props.landmark.id, props.accountId, props.characterId],
    queryFn: () => {
      if (!props.accountId) throw new Error("Player account is not ready.");
      return requestMapLandmark(props.landmark.id, props.accountId);
    },
    enabled: !!props.accountId && !props.offline,
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });
  if (typeof document === "undefined") return null;
  return createPortal(
    <section
      className="map-sheet map-landmark-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-landmark-title"
    >
      <header className="map-sheet-header map-landmark-header">
        <div>
          <p className="map-sheet-eyebrow">{props.landmark.category}</p>
          <h2 id="map-landmark-title">{props.landmark.label}</h2>
        </div>
        <button
          type="button"
          className="map-icon-button"
          onClick={onClose}
          aria-label="Close landmark details"
        >
          <X size={18} />
        </button>
      </header>
      <LandmarkDetailsContent {...props} detailsQuery={detailsQuery} />
      <footer className="map-sheet-actions map-landmark-footer">
        <button type="button" className="map-primary-button" onClick={onBackToTransport}>
          <MapPin size={17} aria-hidden="true" />
          Back to transport options
        </button>
      </footer>
    </section>,
    document.body,
  );
}
