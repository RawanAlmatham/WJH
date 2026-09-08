export const RESEARCH_FEED_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const MAX_RESEARCH_KEYWORDS = 40;
const ARXIV_KEYWORDS_PER_REQUEST = 15;
const ARXIV_RESULTS_PER_REQUEST = 20;
const ARXIV_MAX_COMBINED_RESULTS = 60;

export type ResearchFeedEntry = {
  source: "arxiv";
  externalId: string;
  title: string;
  abstract: string;
  url: string;
  authors: string[];
  publishedAt: Date;
};

export function normalizeResearchKeywords(values: string[]) {
  return Array.from(
    new Set(
      values
        .flatMap(value => value.split(/[،,\n]/))
        .map(value => value.trim().replace(/\s+/g, " "))
        .filter(value => value.length >= 2)
    )
  ).slice(0, MAX_RESEARCH_KEYWORDS);
}

export function buildArxivFeedUrl(keywords: string[], maxResults = 30) {
  const normalized = normalizeResearchKeywords(keywords);
  if (!normalized.length) throw new Error("أضف كلمة بحث واحدة على الأقل");
  const searchQuery = normalized
    .map(keyword => `all:\"${keyword.replace(/[\"\\]/g, " ")}\"`)
    .join(" OR ");
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(Math.min(maxResults, 50)));
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");
  return url.toString();
}

function decodeXml(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
  };
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code: string) => {
      const radix = code.toLowerCase().startsWith("x") ? 16 : 10;
      const number = Number.parseInt(code.replace(/^x/i, ""), radix);
      return Number.isFinite(number) ? String.fromCodePoint(number) : "";
    })
    .replace(
      /&([a-z]+);/gi,
      (match, entity: string) => entities[entity] ?? match
    )
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(xml: string, tag: string) {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i")
  );
  return match ? decodeXml(match[1]) : "";
}

function entryUrl(xml: string, fallback: string) {
  const links = Array.from(xml.matchAll(/<link\b([^>]*)\/?\s*>/gi));
  for (const [, attributes] of links) {
    const rel = attributes.match(/\brel=["']([^"']+)["']/i)?.[1];
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && (!rel || rel === "alternate")) return decodeXml(href);
  }
  return fallback;
}

export function parseArxivFeed(xml: string): ResearchFeedEntry[] {
  return Array.from(xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi))
    .map(([, entry]) => {
      const id = tagValue(entry, "id");
      const title = tagValue(entry, "title");
      const published =
        tagValue(entry, "published") || tagValue(entry, "updated");
      const publishedAt = new Date(published);
      const externalId = id.split("/abs/").pop()?.replace(/v\d+$/i, "") ?? id;
      const authors = Array.from(
        entry.matchAll(/<author(?:\s[^>]*)?>([\s\S]*?)<\/author>/gi)
      )
        .map(([, author]) => tagValue(author, "name"))
        .filter(Boolean);
      if (!id || !title || !externalId || Number.isNaN(publishedAt.getTime()))
        return null;
      return {
        source: "arxiv" as const,
        externalId,
        title,
        abstract: tagValue(entry, "summary"),
        url: entryUrl(entry, id),
        authors,
        publishedAt,
      };
    })
    .filter((entry): entry is ResearchFeedEntry => Boolean(entry));
}

async function fetchArxivBatch(keywords: string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      buildArxivFeedUrl(keywords, ARXIV_RESULTS_PER_REQUEST),
      {
        headers: {
          Accept: "application/atom+xml, application/xml;q=0.9",
          "User-Agent": "Athr-Research-Feeds/1.0",
        },
        signal: controller.signal,
      }
    );
    if (!response.ok)
      throw new Error(`تعذر الاتصال بمصدر arXiv (${response.status})`);
    return parseArxivFeed(await response.text());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("استغرق مصدر arXiv وقتًا أطول من المتوقع");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const wait = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export async function fetchArxivResearchFeed(keywords: string[]) {
  const normalized = normalizeResearchKeywords(keywords);
  if (!normalized.length) throw new Error("أضف كلمة بحث واحدة على الأقل");
  const batches = Array.from(
    { length: Math.ceil(normalized.length / ARXIV_KEYWORDS_PER_REQUEST) },
    (_, index) =>
      normalized.slice(
        index * ARXIV_KEYWORDS_PER_REQUEST,
        (index + 1) * ARXIV_KEYWORDS_PER_REQUEST
      )
  );
  const entries = new Map<string, ResearchFeedEntry>();
  for (let index = 0; index < batches.length; index += 1) {
    if (index) await wait(3_100);
    for (const entry of await fetchArxivBatch(batches[index]))
      entries.set(entry.externalId, entry);
  }
  return Array.from(entries.values())
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, ARXIV_MAX_COMBINED_RESULTS);
}
