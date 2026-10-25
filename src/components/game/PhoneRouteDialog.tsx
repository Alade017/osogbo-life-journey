import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLiveClock } from "@/hooks/use-live-clock";
import { OSOGBO_TIME_ZONE } from "@/lib/osogbo-weather";
import "./phone.css";

/** Shows a game route inside the in-game phone. Closing it calls onClose. */
export function PhoneRouteDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const now = useLiveClock();
  const phoneTime = now
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: OSOGBO_TIME_ZONE,
      }).format(now)
    : "--:--";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="phone-dialog">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="phone-screen">
          <div className="phone-status">
            <span className="phone-status-time">{phoneTime}</span>
            <span className="phone-status-brand">OSUN WAT</span>
            <span aria-hidden="true" />
          </div>

          <div className="phone-app-view" style={{ display: "flex" }}>
            <div className="phone-app-toolbar">
              <button type="button" onClick={onClose} className="phone-back-button" aria-label="Close and return">
                <ChevronLeft size={18} aria-hidden="true" />
                <span>Close</span>
              </button>
              <strong>{title}</strong>
              <div className="w-8" aria-hidden="true" />
            </div>
            <div className="phone-app-body">{children}</div>
          </div>

          <button type="button" className="phone-home-bar-button" onClick={onClose} aria-label="Close phone">
            <span className="phone-home-indicator" aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}