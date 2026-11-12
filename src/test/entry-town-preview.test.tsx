import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntryTownPreview } from "@/components/game/EntryTownPreview";
import { findLandmarkForSlug, previewLandmarks } from "@/components/game/entry-town-preview";
import town from "@/data/osogbo-town.json";

describe("town preview data", () => {
  it("shows every landmark for a null filter, and only active ones otherwise", () => {
    expect(previewLandmarks(null)).toHaveLength(town.landmarks.length);
    const onlyMarket = previewLandmarks(new Set(["town-market"]));
    expect(onlyMarket.map((place) => place.slug)).toEqual(["town-market"]);
    expect(previewLandmarks(new Set())).toEqual([]);
  });

  it("finds a landmark from its location slug", () => {
    expect(findLandmarkForSlug("town-market")?.id).toBe("town-market");
    expect(findLandmarkForSlug("no-such-place")).toBeNull();
    expect(findLandmarkForSlug(null)).toBeNull();
  });
});

describe("EntryTownPreview", () => {
  it("names the last stop in its caption", () => {
    render(<EntryTownPreview focusLandmarkId="town-market" focusLabel="Oja-Oba Market" />);
    expect(screen.getByText("Your last stop: Oja-Oba Market.")).toBeInTheDocument();
  });

  it("uses the default caption for a new player", () => {
    render(<EntryTownPreview />);
    expect(
      screen.getByText("A glimpse of the fictional town you can explore."),
    ).toBeInTheDocument();
  });
});

describe("landing page rules", () => {
  const page = readFileSync(resolve(process.cwd(), "src/routes/index.tsx"), "utf8");
  const copy = JSON.parse(
    readFileSync(resolve(process.cwd(), "src/data/landing-copy.json"), "utf8"),
  ) as { howItWorks: unknown[] };

  it("uses no photo from the database or the page itself", () => {
    expect(page).not.toContain("image_url");
    expect(page).not.toContain("entry-scene-photo");
  });

  it("keeps the three how-it-works steps in the copy file", () => {
    expect(copy.howItWorks).toHaveLength(3);
  });
});
