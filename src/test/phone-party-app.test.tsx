import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhonePartyApp } from "@/components/game/phone/PhonePartyApp";

const renderParty = vi.fn();
vi.mock("@/routes/_authenticated/_game/party", () => ({
  PartyExperience: (props: { compact?: boolean }) => {
    renderParty(props);
    return <span>Server-backed Party experience</span>;
  },
}));

describe("phone Party app", () => {
  it("uses the shared Party experience", () => {
    render(<PhonePartyApp />);
    expect(screen.getByText("Server-backed Party experience")).toBeVisible();
    expect(renderParty).toHaveBeenCalledWith({ compact: true });
  });
});
