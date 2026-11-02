import { Link } from "@tanstack/react-router";

/** Compatibility entry point: the world always opens outside the phone. */
export function PhoneMapApp() {
  return <Link to="/map">Open the full-page city map</Link>;
}
export default PhoneMapApp;
