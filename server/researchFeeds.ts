export const RESEARCH_FEED_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const MAX_RESEARCH_KEYWORDS = 40;
const ARXIV_KEYWORDS_PER_REQUEST = 15;
const ARXIV_RESULTS_PER_REQUEST = 20;
const ARXIV_MAX_COMBINED_RESULTS = 60;
const OPENALEX_KEYWORDS_PER_REQUEST = 15;
const OPENALEX_RESULTS_PER_REQUEST = 25;
const OPENALEX_MAX_COMBINED_RESULTS = 60;
const RESEARCH_FEED_MAX_COMBINED_RESULTS = 100;

export type ResearchFeedEntry = {
  source: "arxiv" | "openalex";
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

function openAlexSearchTerm(keyword: string) {
  const normalized = keyword.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.includes(" ") ? `"${normalized}"` : normalized;
}

export function buildOpenAlexFeedUrl(keywords: string[], maxResults = 30) {
  const normalized = normalizeResearchKeywords(keywords);
  if (!normalized.length) throw new Error("أضف كلمة بحث واحدة على الأقل");
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set(
    "search",
    `(${normalized.map(openAlexSearchTerm).join(" OR ")})`
  );
  url.searchParams.set("sort", "publication_date:desc,relevance_score:desc");
  url.searchParams.set(
    "per_page",
    String(Math.min(maxResults, OPENALEX_RESULTS_PER_REQUEST))
  );
  url.searchParams.set(
    "select",
    [
      "id",
      "doi",
      "title",
      "display_name",
      "publication_date",
      "authorships",
      "abstract_inverted_index",
      "primary_location",
      "open_access",
    ].join(",")
  );
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
    .map<ResearchFeedEntry | null>(([, entry]) => {
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

type OpenAlexWork = {
  id?: string | null;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_date?: string | null;
  authorships?: Array<{ author?: { display_name?: string | null } | null }>;
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_location?: { landing_page_url?: string | null } | null;
  open_access?: { oa_url?: string | null } | null;
};

export function reconstructOpenAlexAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
) {
  if (!invertedIndex) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      if (Number.isInteger(position) && position >= 0) words[position] = word;
    }
  }
  return words.filter(Boolean).join(" ").trim();
}

export function parseOpenAlexWorks(payload: unknown): ResearchFeedEntry[] {
  const results =
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as any).results)
      ? ((payload as any).results as OpenAlexWork[])
      : [];
  return results
    .map<ResearchFeedEntry | null>(work => {
      const id = work.id?.trim() ?? "";
      const title = (work.title || work.display_name)?.trim() ?? "";
      const publishedAt = new Date(work.publication_date ?? "");
      const externalId = id.split("/").filter(Boolean).pop() ?? "";
      if (!id || !title || !externalId || Number.isNaN(publishedAt.getTime()))
        return null;
      const authors = Array.from(
        new Set(
          (work.authorships ?? [])
            .map(authorship => authorship.author?.display_name?.trim())
            .filter((name): name is string => Boolean(name))
        )
      );
      return {
        source: "openalex" as const,
        externalId,
        title,
        abstract: reconstructOpenAlexAbstract(work.abstract_inverted_index),
        url:
          work.primary_location?.landing_page_url ||
          work.open_access?.oa_url ||
          work.doi ||
          id,
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

async function fetchOpenAlexBatch(keywords: string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const apiKey = process.env.OPENALEX_API_KEY?.trim();
    const response = await fetch(
      buildOpenAlexFeedUrl(keywords, OPENALEX_RESULTS_PER_REQUEST),
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Athr-Research-Feeds/1.0 (https://athr.aidept.io)",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        signal: controller.signal,
      }
    );
    if (!response.ok)
      throw new Error(`تعذر الاتصال بمصدر OpenAlex (${response.status})`);
    return parseOpenAlexWorks(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("استغرق مصدر OpenAlex وقتًا أطول من المتوقع");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchOpenAlexResearchFeed(keywords: string[]) {
  const normalized = normalizeResearchKeywords(keywords);
  if (!normalized.length) throw new Error("أضف كلمة بحث واحدة على الأقل");
  const batches = Array.from(
    { length: Math.ceil(normalized.length / OPENALEX_KEYWORDS_PER_REQUEST) },
    (_, index) =>
      normalized.slice(
        index * OPENALEX_KEYWORDS_PER_REQUEST,
        (index + 1) * OPENALEX_KEYWORDS_PER_REQUEST
      )
  );
  const entries = new Map<string, ResearchFeedEntry>();
  for (const batch of batches) {
    for (const entry of await fetchOpenAlexBatch(batch))
      entries.set(entry.externalId, entry);
  }
  return Array.from(entries.values())
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, OPENALEX_MAX_COMBINED_RESULTS);
}

function normalizedResearchTitle(title: string) {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\-–—_:;,.!?()[\]{}'"~]+/g, " ")
    .trim();
}

export function mergeResearchFeedEntries(...groups: ResearchFeedEntry[][]) {
  const entries = new Map<string, ResearchFeedEntry>();
  for (const entry of groups.flat()) {
    const titleKey = normalizedResearchTitle(entry.title);
    const key = titleKey || `${entry.source}:${entry.externalId}`;
    if (!entries.has(key)) entries.set(key, entry);
  }
  return Array.from(entries.values())
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, RESEARCH_FEED_MAX_COMBINED_RESULTS);
}

export async function fetchResearchFeed(keywords: string[]) {
  const results = await Promise.allSettled([
    fetchArxivResearchFeed(keywords),
    fetchOpenAlexResearchFeed(keywords),
  ]);
  const successful = results
    .filter(
      (result): result is PromiseFulfilledResult<ResearchFeedEntry[]> =>
        result.status === "fulfilled"
    )
    .map(result => result.value);
  if (!successful.length) {
    const messages = results
      .filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      )
      .map(result =>
        result.reason instanceof Error
          ? result.reason.message
          : "تعذر تحديث مصدر بحثي"
      );
    throw new Error(messages.join("، "));
  }
  return mergeResearchFeedEntries(...successful);
}
