import { describe, expect, it } from "vitest";
import { escapeLittleText, toCommentary } from "./littleText.ts";

describe("littleText", () => {
  it("escapes reserved characters", () => {
    expect(escapeLittleText("a (b) [c] {d} <e> @f *g* _h_ ~i~ |j| \\k")).toBe(
      "a \\(b\\) \\[c\\] \\{d\\} \\<e\\> \\@f \\*g\\* \\_h\\_ \\~i\\~ \\|j\\| \\\\k",
    );
  });

  it("turns hashtags into hashtag templates", () => {
    expect(toCommentary("Hello #OpenSource world")).toBe("Hello {hashtag|\\#|OpenSource} world");
    expect(toCommentary("#first and #second_tag")).toBe("{hashtag|\\#|first} and {hashtag|\\#|second\\_tag}");
  });

  it("leaves a lone # escaped", () => {
    expect(toCommentary("Item # 5")).toBe("Item \\# 5");
  });

  it("keeps plain text unchanged", () => {
    expect(toCommentary("Just text.")).toBe("Just text.");
  });
});
