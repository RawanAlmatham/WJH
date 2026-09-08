import { describe, expect, it } from "vitest";
import {
  buildArxivFeedUrl,
  MAX_RESEARCH_KEYWORDS,
  normalizeResearchKeywords,
  parseArxivFeed,
} from "./researchFeeds";

describe("research feeds", () => {
  it("normalizes Arabic and English keywords without duplicates", () => {
    expect(
      normalizeResearchKeywords([
        "Arabic NLP، Arabic LLM",
        "Arabic NLP",
        "  الذكاء الاصطناعي  ",
      ])
    ).toEqual(["Arabic NLP", "Arabic LLM", "الذكاء الاصطناعي"]);
  });

  it("accepts a larger keyword list up to the documented limit", () => {
    const keywords = Array.from(
      { length: MAX_RESEARCH_KEYWORDS + 5 },
      (_, index) => `keyword ${index + 1}`
    );
    expect(normalizeResearchKeywords(keywords)).toHaveLength(
      MAX_RESEARCH_KEYWORDS
    );
  });

  it("builds a newest-first arXiv query", () => {
    const url = new URL(
      buildArxivFeedUrl(["Arabic language model", "Arabic NLP"])
    );
    expect(url.hostname).toBe("export.arxiv.org");
    expect(url.searchParams.get("search_query")).toContain(
      'all:"Arabic language model"'
    );
    expect(url.searchParams.get("sortBy")).toBe("submittedDate");
    expect(url.searchParams.get("sortOrder")).toBe("descending");
  });

  it("parses and normalizes arXiv Atom entries", () => {
    const result = parseArxivFeed(`
      <?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>http://arxiv.org/abs/2609.01234v2</id>
          <updated>2026-09-07T12:00:00Z</updated>
          <published>2026-09-06T08:30:00Z</published>
          <title>  Arabic &amp; Multilingual Language Models </title>
          <summary> We study\nArabic language models &lt;carefully&gt;. </summary>
          <author><name>Rawan Researcher</name></author>
          <author><name>Athar Team</name></author>
          <link href="https://arxiv.org/abs/2609.01234v2" rel="alternate" />
        </entry>
      </feed>
    `);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      externalId: "2609.01234",
      title: "Arabic & Multilingual Language Models",
      abstract: "We study Arabic language models <carefully>.",
      authors: ["Rawan Researcher", "Athar Team"],
      url: "https://arxiv.org/abs/2609.01234v2",
    });
    expect(result[0].publishedAt.toISOString()).toBe(
      "2026-09-06T08:30:00.000Z"
    );
  });
});
