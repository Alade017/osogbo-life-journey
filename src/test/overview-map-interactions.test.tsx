import { useEffect } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapCanvas, type MapProperty, type MapSearchTarget } from "@/components/map/MapCanvas";

vi.mock("@/components/map/DistrictOverviewSurface", () => ({
  DistrictOverviewSurface: ({ onReady }: { onReady: () => void }) => {
    useEffect(onReady, [onReady]);
    return null;
  },
}));

describe("overview map interactions", () => {
  it("waits for availability before opening a destination, then handles the request once", async () => {
    const onSelectLandmark = vi.fn();
    const onSelectDistrict = vi.fn();
    const target: MapSearchTarget = { id: "cedar-bank", kind: "landmark" };
    const props = { onSelectLandmark, onSelectDistrict, searchTarget: target };
    const { rerender } = render(<MapCanvas {...props} availabilityPending availableLandmarkIds={[]} />);
    await screen.findByRole("button", { name: "Zoom in" });
    expect(onSelectLandmark).not.toHaveBeenCalled();
    rerender(<MapCanvas {...props} availabilityPending={false} availableLandmarkIds={["cedar-bank"]} />);
    expect(onSelectLandmark).toHaveBeenCalledExactlyOnceWith("cedar-bank");
    rerender(<MapCanvas {...props} availableLandmarkIds={["cedar-bank"]} />);
    expect(onSelectLandmark).toHaveBeenCalledTimes(1);
  });

  it("does not open locked destinations or include them in the accessible list", () => {
    const onSelectLandmark = vi.fn();
    render(<MapCanvas onSelectLandmark={onSelectLandmark} onSelectDistrict={vi.fn()}
      searchTarget={{ id: "cedar-bank", kind: "landmark" }} availableLandmarkIds={["meridian-bank"]} />);
    expect(onSelectLandmark).not.toHaveBeenCalled();
    const list = screen.getByRole("list", { name: "Places on the map" });
    expect(within(list).queryByRole("button", { name: /Cedar Bank/i })).toBeNull();
    fireEvent.click(within(list).getByRole("button", { name: /Meridian Bank/i }));
    expect(onSelectLandmark).toHaveBeenCalledExactlyOnceWith("meridian-bank");
  });

  it("resolves legacy district searches independently of availability", () => {
    const onSelectDistrict = vi.fn();
    const onSelectLandmark = vi.fn();
    render(<MapCanvas onSelectDistrict={onSelectDistrict} onSelectLandmark={onSelectLandmark}
      searchTarget={{ id: "market-quarter", kind: "district" }} availabilityPending availableLandmarkIds={[]} />);
    expect(onSelectDistrict).toHaveBeenCalledExactlyOnceWith("oja-oba");
    expect(onSelectLandmark).not.toHaveBeenCalled();
    const list = screen.getByRole("list", { name: "Districts on the map" });
    expect(within(list).getAllByRole("button")).toHaveLength(10);
    fireEvent.click(within(list).getByRole("button", { name: "Oke-Baale district" }));
    expect(onSelectDistrict).toHaveBeenLastCalledWith("oke-baale");
  });

  it("retains the original property payload even when no overview parcel is assigned", () => {
    const property: MapProperty = { id: "unmapped-property", label: "Rental unit", type: "flat",
      tier: 1, status: "rent_due", position: [1, 0, 1], houseTypeId: "unknown-type" };
    const onSelectProperty = vi.fn();
    render(<MapCanvas onSelectDistrict={vi.fn()} onSelectLandmark={vi.fn()}
      properties={[property]} onSelectProperty={onSelectProperty} />);
    fireEvent.click(screen.getByText("Properties"));
    fireEvent.click(screen.getByRole("button", { name: "Open Rental unit: Rent due" }));
    expect(onSelectProperty).toHaveBeenCalledExactlyOnceWith(property);
  });
});
