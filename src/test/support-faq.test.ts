import { describe, expect, it } from "vitest";
import { findSupportAnswers, SUPPORT_FAQS } from "@/components/game/phone/support-faq";

describe("support FAQ", () => {
  it("has unique ids and a non-empty answer for every question", () => {
    const ids = SUPPORT_FAQS.map((faq) => faq.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const faq of SUPPORT_FAQS) {
      expect(faq.question.trim()).not.toBe("");
      expect(faq.answer.trim()).not.toBe("");
    }
  });

  it("shows every prepared answer for an empty search", () => {
    expect(findSupportAnswers("   ")).toHaveLength(SUPPORT_FAQS.length);
  });

  it("finds answers by question words and keywords, ignoring case", () => {
    expect(findSupportAnswers("MONEY").map((faq) => faq.id)).toContain("money");
    expect(findSupportAnswers("cooldown").map((faq) => faq.id)).toContain("activities");
  });

  it("returns nothing for a question it has no answer for", () => {
    expect(findSupportAnswers("zebra spaceship")).toEqual([]);
  });

  it("does not match a short keyword inside an unrelated word", () => {
    expect(findSupportAnswers("good morning")).toEqual([]);
  });
});
