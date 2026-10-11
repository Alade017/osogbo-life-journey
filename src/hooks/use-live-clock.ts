import { useEffect, useState } from "react";

/** Browser-local wall clock, kept separate from the simulated Osogbo game clock. */
export function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
