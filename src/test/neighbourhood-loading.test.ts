import { describe, expect, it } from "vitest";
import {
  neighbourhoodLoadingStage,
  type NeighbourhoodLoadingInput,
} from "@/components/game/neighbourhood-loading";

const READY: NeighbourhoodLoadingInput = {
  pageLoading: false,
  connection: "connected",
  connectionError: null,
  hasDistrict: true,
  homeLoading: false,
  sceneReady: true,
};

describe("neighbourhood loading stage", () => {
  it("shows nothing once the scene is ready", () => {
    expect(neighbourhoodLoadingStage(READY)).toBeNull();
  });

  it("shows one stage at a time, in the order the player waits through them", () => {
    expect(neighbourhoodLoadingStage({ ...READY, pageLoading: true })?.title).toBe(
      "Opening the neighbourhood",
    );
    expect(neighbourhoodLoadingStage({ ...READY, connection: "connecting" })?.title).toBe(
      "Entering the neighbourhood",
    );
    expect(neighbourhoodLoadingStage({ ...READY, homeLoading: true })?.detail).toBe(
      "Checking your home entrance…",
    );
    expect(neighbourhoodLoadingStage({ ...READY, sceneReady: false })?.title).toBe(
      "Loading the neighbourhood",
    );
  });

  it("offers Retry only when the connection has actually failed", () => {
    const failed = neighbourhoodLoadingStage({
      ...READY,
      connection: "unavailable",
      connectionError: "The game server did not answer.",
    });
    expect(failed).toEqual({
      title: "Entering the neighbourhood",
      detail: "The game server did not answer.",
      retry: true,
    });
    const slow = neighbourhoodLoadingStage({ ...READY, connection: "unavailable" });
    expect(slow?.retry).toBe(false);
    expect(slow?.detail).toContain("Reconnecting automatically");
  });

  it("stays quiet for wrong-area and districts that do not exist, which have their own message", () => {
    expect(neighbourhoodLoadingStage({ ...READY, connection: "wrong-area" })).toBeNull();
    expect(
      neighbourhoodLoadingStage({ ...READY, hasDistrict: false, sceneReady: false }),
    ).toBeNull();
  });
});
