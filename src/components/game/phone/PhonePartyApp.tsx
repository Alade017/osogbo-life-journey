import { PartyPopper } from "lucide-react";
import { PartyExperience } from "@/routes/_authenticated/_game/party";

export function PhonePartyApp() {
  return (
    <div className="phone-party" role="region" aria-label="Party Life">
      <section className="phone-party-hero">
        <span className="phone-party-hero-icon">
          <PartyPopper aria-hidden="true" />
        </span>
        <div>
          <h2>Party</h2>
          <p>Clubs, drinks, dancing and events in town.</p>
        </div>
      </section>
      <PartyExperience compact />
    </div>
  );
}

export default PhonePartyApp;
