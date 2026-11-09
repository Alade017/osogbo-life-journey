import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhoneGamesApp } from "@/components/game/phone/PhoneGamesApp";
import { EXTERNAL_NEWS_REGIONS } from "@/lib/external-news-api.server";

describe("Games app", () => {
  it("shows only an error message for now", () => {
    render(<PhoneGamesApp />);
    expect(screen.getByRole("alert")).toHaveTextContent("Games could not be loaded.");
  });
});

describe("news regions", () => {
  it("includes the Osun State feed alongside Nigeria and World", () => {
    expect([...EXTERNAL_NEWS_REGIONS]).toEqual(["nigeria", "world", "osun"]);
  });
});
