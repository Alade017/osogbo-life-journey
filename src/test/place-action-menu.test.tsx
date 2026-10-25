import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import mapData from "@/data/osogbo-map.json";
import { PlaceActionMenu } from "@/components/map/PlaceActionMenu";

describe("place action menu", () => {
  it("previews costs and time, then sends only the selected action id", () => {
    const onRun = vi.fn();
    const action = mapData.districts[0]!.landmarks[0]!.actions![1]!;
    render(<PlaceActionMenu actions={[action]} offline={false} pending={false} onRun={onRun} />);
    fireEvent.click(screen.getByRole("button", { name: /Buy food/ }));
    expect(screen.getAllByText(/Costs ₦250–₦450/)).toHaveLength(2);
    expect(screen.getAllByText(/20 game minutes/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Do activity" }));
    expect(onRun).toHaveBeenCalledWith(action.id);
  });

  it("disables confirmation offline", () => {
    const action = mapData.districts[0]!.landmarks[0]!.actions![0]!;
    render(<PlaceActionMenu actions={[action]} offline pending={false} onRun={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Browse stalls/ }));
    expect(screen.getByRole("button", { name: "Reconnect to continue" })).toBeDisabled();
  });
});
