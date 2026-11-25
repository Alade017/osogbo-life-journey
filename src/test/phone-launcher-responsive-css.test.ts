import { describe, expect, it } from "vitest";
import phoneStyles from "@/components/game/phone.css?raw";

function getCssRule(source: string, selector: string, startAt = 0) {
  const selectorIndex = source.indexOf(selector, startAt);
  if (selectorIndex < 0) return "";

  const openingBrace = source.indexOf("{", selectorIndex);
  if (openingBrace < 0) return "";

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }

  return "";
}

describe("phone launcher responsive layout", () => {
  it("keeps both scroll axes on the app-pages element in short landscape viewports", () => {
    const mediaQuery = "@media (orientation: landscape) and (max-height: 500px)";
    const mediaIndex = phoneStyles.lastIndexOf(mediaQuery);
    expect(mediaIndex).toBeGreaterThanOrEqual(0);

    const pagesRule = getCssRule(
      phoneStyles,
      ".phone-screen-home .phone-app-pages",
      mediaIndex,
    );

    expect(pagesRule).not.toBe("");
    expect(pagesRule).toMatch(/overflow-x:\\s*auto;/);
    expect(pagesRule).toMatch(/overflow-y:\\s*auto;/);
    expect(pagesRule).toMatch(/touch-action:\\s*pan-x pan-y pinch-zoom;/);
    expect(pagesRule).toMatch(/-webkit-overflow-scrolling:\\s*touch;/);
  });

  it("retains all five launcher rows in the short-landscape grid rule", () => {
    const mediaIndex = phoneStyles.lastIndexOf(
      "@media (orientation: landscape) and (max-height: 500px)",
    );
    const gridRule = getCssRule(
      phoneStyles,
      ".phone-screen-home .phone-app-grid",
      mediaIndex,
    );

    expect(gridRule).not.toBe("");
    expect(gridRule).toMatch(/grid-template-rows:\\s*repeat\\(5,/);
    expect(gridRule).toMatch(/height:\\s*max-content;/);
  });
});
