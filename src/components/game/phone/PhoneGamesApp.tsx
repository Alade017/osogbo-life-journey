import { Gamepad2 } from "lucide-react";

/** Games are not open yet. The app shows an error until they are. */
export function PhoneGamesApp() {
  return (
    <div className="phone-local-app" aria-label="Games">
      <header>
        <Gamepad2 aria-hidden="true" />
        <span>
          <strong>Games</strong>
          <small>Mini games for your phone</small>
        </span>
      </header>
      <div className="phone-local-list">
        <div className="phone-local-card" role="alert">
          <strong>Games could not be loaded.</strong>
          <small>Please try again later.</small>
        </div>
      </div>
    </div>
  );
}
