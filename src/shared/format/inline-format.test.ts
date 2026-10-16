import { describe, expect, it } from "vitest";
import { parseInlineFormat, stripFormat, type FormatNode } from "./inline-format";

const text = (value: string): FormatNode => ({ type: "text", value });

describe("inline message formatting", () => {
  it("parses the three allowed formats", () => {
    expect(parseInlineFormat("*bold* _italic_ ~gone~")).toEqual([
      { type: "bold", children: [text("bold")] },
      text(" "),
      { type: "italic", children: [text("italic")] },
      text(" "),
      { type: "strike", children: [text("gone")] },
    ]);
  });

  it("supports nesting only in reverse-close order", () => {
    expect(parseInlineFormat("*_x_*")).toEqual([
      { type: "bold", children: [{ type: "italic", children: [text("x")] }] },
    ]);
    expect(parseInlineFormat("*_x*_")).toEqual([text("*_x*_")]);
  });

  it("keeps whitespace-adjacent, empty, and unclosed markers literal", () => {
    expect(stripFormat("* open* and *close * and ** __ ~~")).toBe(
      "* open* and *close * and ** __ ~~",
    );
    expect(parseInlineFormat("before *never closed")).toEqual([text("before *never closed")]);
  });

  it("supports punctuation, Yoruba diacritics, and emoji", () => {
    expect(stripFormat("Say *ẹ̀kọ́*, _ṣé dáadáa?_ and ~🙂~!")).toBe("Say ẹ̀kọ́, ṣé dáadáa? and 🙂!");
  });

  it("does not format through code spans or line breaks", () => {
    expect(parseInlineFormat("`*literal*` and *yes*")).toEqual([
      text("`*literal*` and "),
      { type: "bold", children: [text("yes")] },
    ]);
    expect(parseInlineFormat("*first\nsecond*")).toEqual([text("*first\nsecond*")]);
  });

  it("strips valid markers for previews and leaves malformed markers visible", () => {
    expect(stripFormat("New *_market_* update")).toBe("New market update");
    expect(stripFormat("New *_market*_ update")).toBe("New *_market*_ update");
  });

  it("never throws for randomized input", () => {
    let seed = 0x5f3759df;
    const alphabet = ["*", "_", "~", "`", "\n", " ", "ẹ", "́", "🙂", "a", "."];
    for (let sample = 0; sample < 2_000; sample++) {
      let value = "";
      const length = sample % 121;
      for (let index = 0; index < length; index++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        value += alphabet[seed % alphabet.length];
      }
      expect(() => parseInlineFormat(value)).not.toThrow();
    }
  });
});
