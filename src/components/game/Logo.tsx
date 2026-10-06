import { MapPinned } from "lucide-react";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <MapPinned className="h-5 w-5" />
      </span>
      {!small && (
        <span className="font-display text-lg font-bold leading-none">
          OSOGBO <span className="text-primary">LIFE</span>
        </span>
      )}
    </span>
  );
}
