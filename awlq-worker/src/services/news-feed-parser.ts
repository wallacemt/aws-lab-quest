import Parser from "rss-parser";
import { createHash } from "crypto";
import { logger } from "../shared/logger.js";

const parser = new Parser({
  timeout: 30_000,
});

export type RawNewsItem = {
  title: string;
  url: string;
  urlHash: string;
  summary: string | null;
  publishedAt: Date | null;
};

type NewsSource = {
  id: string;
  feedUrl: string;
};

/**
 * Strips HTML tags from a string.
 * // SECURITY: HTML stripped from feed content on ingestion
 */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

/**
 * Parses an RSS/Atom feed and returns normalized, sanitized items.
 * On parse error, logs and returns [] so one failing source does not break the sweep.
 */
export async function parseFeed(source: NewsSource): Promise<RawNewsItem[]> {
  try {
    const feed = await parser.parseURL(source.feedUrl);
    const items: RawNewsItem[] = [];

    for (const item of feed.items ?? []) {
      const url = item.link ?? item.guid;
      if (!url) continue;

      const title = item.title ? stripHtml(item.title) : "(sem título)";

      // Prefer content snippet, fall back to summary/description
      const rawSummary = item.contentSnippet ?? item.content ?? item.summary ?? null;
      // SECURITY: sanitized on ingestion in news-feed-parser.ts
      const summary = rawSummary ? stripHtml(rawSummary).slice(0, 1000) : null;

      const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null;

      items.push({
        title,
        url,
        urlHash: hashUrl(url),
        summary,
        publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
      });
    }

    logger.info({ sourceId: source.id, itemCount: items.length }, "news-feed-parser: parsed feed");
    return items;
  } catch (err) {
    logger.error({ sourceId: source.id, feedUrl: source.feedUrl, err }, "news-feed-parser: failed to parse feed");
    return [];
  }
}
