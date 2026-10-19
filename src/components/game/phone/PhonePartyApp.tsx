import { PartyExperience } from "@/routes/_authenticated/_game/party";

export function PhonePartyApp() {
  return (
    <div className="phone-sub-app" role="region" aria-label="Party Life">
      <div className="phone-sub-content p-3">
        <PartyExperience compact />
      </div>
    </div>
  );
}

export default PhonePartyApp;
