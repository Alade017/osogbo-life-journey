import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every class name the NPC sale and market panels use must have a selector in the stylesheet.
// Without it, the panels render as unstyled inline text (labels and buttons run together).
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const css = read("../components/game/property-sale.css");
const sources = [
  "../components/game/PropertySalePanel.tsx",
  "../components/game/PropertyMarketPanel.tsx",
];

function classNamesIn(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/className="([^"]+)"/g)) {
    for (const name of match[1]!.split(/\s+/)) if (name) names.add(name);
  }
  return [...names];
}

describe("property sale panel styles", () => {
  it("defines a selector for every class the panels use", () => {
    const used = sources.flatMap((path) => classNamesIn(read(path)));
    expect(used.length).toBeGreaterThan(0);
    const missing = [...new Set(used)].filter((name) => !css.includes(`.${name}`));
    expect(missing).toEqual([]);
  });

  it("imports the stylesheet from both panels", () => {
    for (const path of sources) {
      expect(read(path)).toContain('import "./property-sale.css";');
    }
  });
});
