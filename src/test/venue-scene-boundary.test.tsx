import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { VenueSceneBoundary } from "@/components/game/VenueSceneBoundary";

function Scene({ fail }: { fail: boolean }) {
  if (fail) throw new Error("Scene failed to mount");
  return <p>Destination scene ready</p>;
}

it("recovers when the destination key changes after a scene failure", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const onError = vi.fn();
  const view = render(
    <VenueSceneBoundary resetKey="first-destination" onError={onError}>
      <Scene fail />
    </VenueSceneBoundary>,
  );

  expect(screen.queryByText("Destination scene ready")).not.toBeInTheDocument();
  expect(onError).toHaveBeenCalledOnce();

  view.rerender(
    <VenueSceneBoundary resetKey="second-destination" onError={onError}>
      <Scene fail={false} />
    </VenueSceneBoundary>,
  );

  expect(screen.getByText("Destination scene ready")).toBeInTheDocument();
  consoleError.mockRestore();
});
