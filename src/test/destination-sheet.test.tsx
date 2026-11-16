import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationSheet } from "@/components/map/DestinationSheet";
import type { TravelMode } from "@/lib/transport-service";
import type { MapTravelPhase } from "@/components/map/map-travel-state";
afterEach(cleanup);
function Harness({
  wallet = 1000,
  phase = "editing",
  retry = () => {},
}: {
  wallet?: number;
  phase?: MapTravelPhase;
  retry?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<"travel" | "details">("travel"),
    [mode, setMode] = useState<TravelMode | null>(null);
  const selectedFare = mode === "walking" ? 0 : 75;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open destination
      </button>
      <button type="button">Outside button</button>
      <DestinationSheet
        open={open}
        title="Olaiya Junction"
        category="transport"
        districtName="Central crossing"
        originName="Your home"
        destinationName="Olaiya"
        tab={tab}
        onTabChange={setTab}
        selectedMode={mode}
        onModeChange={setMode}
        options={[
          { id: "walking", label: "Walk", hint: "No fare · slower trip", fare: 0, minutes: 24 },
          { id: "danfo", label: "Danfo", hint: "Shared ride", fare: 75, minutes: 14 },
        ]}
        walletBalance={wallet}
        walletLoading={false}
        onRetryBalance={() => {}}
        status={{ tone: "ready", message: "Destination access confirmed." }}
        phase={phase}
        error={
          phase === "sync-error" ? "Your trip is confirmed. Retry loading; no second charge." : null
        }
        canTravel={!!mode && wallet >= selectedFare}
        canChooseMode
        onConfirm={() => {}}
        onClose={() => setOpen(false)}
        onRetryArrival={retry}
        details={<p>Market stalls and eateries</p>}
      />
    </>
  );
}
const open = () => fireEvent.click(screen.getByRole("button", { name: "Open destination" }));
describe("destination travel sheet", () => {
  it("keeps one dialog and preserves the selected native radio across tabs", () => {
    render(<Harness />);
    open();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("radio", { name: /Danfo/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Details/ }));
    expect(screen.getByText("Market stalls and eateries")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Travel" }));
    expect(screen.getByRole("radio", { name: /Danfo/ })).toBeChecked();
    expect(screen.getByRole("dialog")).toBe(dialog);
  });
  it("explains the fare shortfall and keeps the free walking option usable", () => {
    render(<Harness wallet={20} />);
    open();
    fireEvent.click(screen.getByRole("radio", { name: /Danfo/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("₦55");
    expect(screen.getByRole("button", { name: "Confirm and travel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Walk/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm and travel" })).toBeEnabled();
  });
  it("contains focus, locks background scrolling and restores the opener on close", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open destination" });
    const outside = screen.getByRole("button", { name: "Outside button" });
    opener.focus();
    open();
    expect(screen.getByRole("tab", { name: "Travel" })).toHaveFocus();
    expect(document.body).toHaveAttribute("data-scroll-locked");
    outside.focus();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(opener).toHaveFocus());
  });
  it("supports arrow-key navigation between Travel and Details", () => {
    render(<Harness />);
    open();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Travel" }), {
      key: "ArrowRight",
    });
    expect(screen.getByRole("tab", { name: /Details/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Details/ })).toHaveFocus();
  });
  it("prevents dismissal during submission", () => {
    render(<Harness phase="submitting" />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Details/ })).toBeDisabled();
  });
  it("offers loading recovery instead of another confirmation after travel is accepted", () => {
    const retry = vi.fn();
    render(<Harness phase="sync-error" retry={retry} />);
    open();
    expect(screen.queryByRole("button", { name: "Confirm and travel" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry destination loading" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
