import { describe, expect, it } from "vitest";
import { includesMemberMention } from "./notifications";

describe("task comment mentions", () => {
  it("recognizes the member token inserted by the comment editor", () => {
    expect(
      includesMemberMention(
        "فضلاً راجع هذا يا @[عبدالرحمن العصيمي]",
        "عبدالرحمن العصيمي"
      )
    ).toBe(true);
  });

  it("keeps supporting manually typed names and work emails", () => {
    expect(includesMemberMention("للمراجعة @روان المعثم", "روان المعثم")).toBe(
      true
    );
    expect(
      includesMemberMention(
        "فضلاً راجعها @aalosaimy@ksaa.gov.sa",
        "aalosaimy@ksaa.gov.sa"
      )
    ).toBe(true);
  });

  it("does not confuse a shorter member name with a longer one", () => {
    expect(includesMemberMention("راجعها @روان المعثم", "روان")).toBe(false);
  });
});
