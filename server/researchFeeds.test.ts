import { describe, expect, it } from "vitest";
import {
  buildArxivFeedUrl,
  buildOpenAlexFeedUrl,
  MAX_RESEARCH_KEYWORDS,
  mergeResearchFeedEntries,
  normalizeResearchKeywords,
  parseArxivFeed,
  parseOpenAlexWorks,
  reconstructOpenAlexAbstract,
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

  it("builds a newest-first OpenAlex boolean search", () => {
    const url = new URL(
      buildOpenAlexFeedUrl(["Arabic language model", "Arabic NLP"])
    );
    expect(url.hostname).toBe("api.openalex.org");
    expect(url.pathname).toBe("/works");
    expect(url.searchParams.get("search")).toBe(
      '("Arabic language model" OR "Arabic NLP")'
    );
    expect(url.searchParams.get("sort")).toBe(
      "publication_date:desc,relevance_score:desc"
    );
  });

  it("reconstructs and parses OpenAlex works", () => {
    const abstract = {
      We: [0],
      evaluate: [1],
      Arabic: [2],
      models: [3],
    };
    expect(reconstructOpenAlexAbstract(abstract)).toBe(
      "We evaluate Arabic models"
    );
    const result = parseOpenAlexWorks({
      results: [
        {
          id: "https://openalex.org/W123456789",
          doi: "https://doi.org/10.1000/example",
          title: "Arabic Language Model Evaluation",
          publication_date: "2026-09-08",
          abstract_inverted_index: abstract,
          primary_location: {
            landing_page_url: "https://example.org/paper",
          },
          authorships: [
            { author: { display_name: "Rawan Researcher" } },
            { author: { display_name: "Athr Team" } },
          ],
        },
      ],
    });
    expect(result[0]).toMatchObject({
      source: "openalex",
      externalId: "W123456789",
      title: "Arabic Language Model Evaluation",
      abstract: "We evaluate Arabic models",
      url: "https://example.org/paper",
      authors: ["Rawan Researcher", "Athr Team"],
    });
    expect(result[0].publishedAt.toISOString()).toBe(
      "2026-09-08T00:00:00.000Z"
    );
  });

  it("deduplicates the same paper across sources by normalized title", () => {
    const publishedAt = new Date("2026-09-08T00:00:00Z");
    const arxiv = {
      source: "arxiv" as const,
      externalId: "2609.00001",
      title: "Arabic LLM: Evaluation!",
      abstract: "ArXiv abstract",
      url: "https://arxiv.org/abs/2609.00001",
      authors: ["Researcher"],
      publishedAt,
    };
    const openalex = {
      ...arxiv,
      source: "openalex" as const,
      externalId: "W987",
      title: "Arabic LLM — Evaluation",
      url: "https://openalex.org/W987",
    };
    expect(mergeResearchFeedEntries([arxiv], [openalex])).toEqual([arxiv]);
  });
});
