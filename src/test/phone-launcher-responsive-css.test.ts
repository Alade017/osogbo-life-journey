import { describe, expect, it } from "vitest";
import phoneStyles from "@/components/game/phone.css?raw";

describe("phone launcher responsive layout", () => {
  it("allows vertical scrolling and preserves horizontal paging on short landscape screens", () => {
    const landscapeRules = phoneStyles.match(
      /@media \(orientation: landscape\) and \(max-height: 500px\) \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(landscapeRules).toBeTruthy();
    expect(landscapeRules).toMatch(/\.phone-screen-home \.phone-app-pages[\s\S]*?overflow-x:\s*auto;/);
    expect(landscapeRules).toMatch(/\.phone-screen-home \.phone-app-pages[\s\S]*?overflow-y:\s*auto;/);
    expect(landscapeRules).toMatch(/touch-action:\s*pan-x pan-y pinch-zoom;/);
    expect(landscapeRules).toMatch(/grid-template-rows:\s*repeat\(5,/);
  });
});
