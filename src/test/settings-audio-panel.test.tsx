import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SettingsAudioPanel } from "@/components/game/SettingsAudioPanel";

const onChannelChange = vi.fn(async () => true);

it("shows a loading state only while the profile query is pending", () => {
  render(
    <SettingsAudioPanel
      profile={undefined}
      isPending
      isError={false}
      error={null}
      isFetching
      onRetry={vi.fn()}
      onChannelChange={onChannelChange}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent("Loading audio settings");
  expect(screen.getByRole("switch", { name: "Music" })).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Sound effects" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows the profile query error and retries instead of leaving a spinner", () => {
  const onRetry = vi.fn();
  render(
    <SettingsAudioPanel
      profile={undefined}
      isPending={false}
      isError
      error={new Error("Profile request failed")}
      isFetching={false}
      onRetry={onRetry}
      onChannelChange={onChannelChange}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("Profile request failed");
  expect(screen.getByRole("switch", { name: "Music" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it("reports a missing profile separately from a pending request", () => {
  render(
    <SettingsAudioPanel
      profile={null}
      isPending={false}
      isError={false}
      error={null}
      isFetching={false}
      onRetry={vi.fn()}
      onChannelChange={onChannelChange}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("profile could not be found");
  expect(screen.queryByText("Loading audio settings")).not.toBeInTheDocument();
});
