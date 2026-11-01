import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import mapData from "@/data/osogbo-map.json";
import { PlaceActionMenu } from "@/components/map/PlaceActionMenu";

describe("place action menu", () => {
  it("previews costs and time, then sends only the selected action id", () => {
    const onRun = vi.fn();
    const action = mapData.districts[0]!.landmarks[0]!.actions![1]!;
    render(
      <PlaceActionMenu
        schedule={{
          sampledAt: "2026-11-01T10:00:00.000Z",
          clock: { day: 305, hour: 11, minute: 0, weekday: 6 },
          actions: [{ id: action.id, start: 0, end: 24, open: true }],
        }}
        refreshingSchedule={false}
        onRefreshSchedule={() => {}}
        actions={[action]}
        offline={false}
        pending={false}
        onRun={onRun}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Buy food/ }));
    expect(screen.getAllByText(/Costs ₦250–₦450/)).toHaveLength(2);
    expect(screen.getAllByText(/20 game minutes/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Do activity" }));
    expect(onRun).toHaveBeenCalledWith(action.id);
  });

  it("disables confirmation offline", () => {
    const action = mapData.districts[0]!.landmarks[0]!.actions![0]!;
    render(
      <PlaceActionMenu
        refreshingSchedule={false}
        onRefreshSchedule={() => {}}
        actions={[action]}
        offline
        pending={false}
        onRun={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Browse stalls/ }));
    expect(screen.getByRole("button", { name: "Reconnect to continue" })).toBeDisabled();
  });

  it("blocks known closed and unverified schedules while offering refresh", () => {
    const action = mapData.districts[0]!.landmarks[0]!.actions![0]!;
    const onRefresh = vi.fn();
    const { rerender } = render(
      <PlaceActionMenu
        schedule={{
          sampledAt: "2026-11-01T10:00:00.000Z",
          clock: { day: 305, hour: 21, minute: 0, weekday: 6 },
          actions: [{ id: action.id, start: 6, end: 21, open: false }],
        }}
        refreshingSchedule={false}
        onRefreshSchedule={onRefresh}
        actions={[action]}
        offline={false}
        pending={false}
        onRun={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Browse stalls/ }));
    expect(screen.getByRole("button", { name: "Outside activity hours" })).toBeDisabled();

    rerender(
      <PlaceActionMenu
        refreshingSchedule={false}
        onRefreshSchedule={onRefresh}
        actions={[action]}
        offline={false}
        pending={false}
        onRun={() => {}}
      />,
    );
    expect(screen.getByText(/Activity hours are unverified/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Refresh hours" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
