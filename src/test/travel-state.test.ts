import { describe, expect, it } from "vitest";
import { initialTravelState, travelReducer } from "@/lib/travel-state";

const destination = {
  type: "select_destination" as const,
  originId: "district-a",
  destinationId: "district-b",
  destinationName: "Main Market",
  fare: 150,
  estimatedMinutes: 12,
};

describe("travel state", () => {
  it("selects and cancels a destination before travel starts", () => {
    const selected = travelReducer(initialTravelState, destination);
    expect(selected).toMatchObject({
      status: "selecting_destination",
      originId: "district-a",
      destinationId: "district-b",
      fare: 150,
      estimatedMinutes: 12,
    });

    expect(travelReducer(selected, { type: "cancel" }).status).toBe("cancelled");
    expect(travelReducer(selected, { type: "start" }).status).toBe("traveling");
  });

  it("records arrival only after travel has started", () => {
    const traveling = travelReducer(travelReducer(initialTravelState, destination), {
      type: "start",
    });

    expect(travelReducer(traveling, { type: "arrive", estimatedMinutes: 10 })).toMatchObject({
      status: "arrived",
      destinationName: "Main Market",
      estimatedMinutes: 10,
    });
  });

  it("returns to destination selection when the server rejects travel", () => {
    const traveling = travelReducer(travelReducer(initialTravelState, destination), {
      type: "start",
    });

    expect(travelReducer(traveling, { type: "fail", message: "Insufficient funds" })).toMatchObject(
      {
        status: "selecting_destination",
        error: "Insufficient funds",
      },
    );
  });
});
