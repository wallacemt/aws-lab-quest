import { Worker } from "bullmq";
import { redis, NewsFetchJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { parseFeed } from "../services/news-feed-parser.js";
import { logger } from "../shared/logger.js";

const DEFAULT_NEWS_SOURCES = [
  {
    name: "AWS What's New",
    feedUrl: "https://aws.amazon.com/about-aws/whats-new/recent/feed/",
    category: "cloud",
  },
  {
    name: "AWS Blog",
    feedUrl: "https://aws.amazon.com/blogs/aws/feed/",
    category: "cloud",
  },
  {
    name: "dev.to (AWS tag)",
    feedUrl: "https://dev.to/feed/tag/aws",
    category: "devto",
  },
];

async function ensureDefaultSources(): Promise<void> {
  for (const source of DEFAULT_NEWS_SOURCES) {
    await prisma.newsSource.upsert({
      where: { feedUrl: source.feedUrl },
      create: source,
      update: {},
    });
  }
}

async function fetchSource(sourceId: string): Promise<void> {
  const source = await prisma.newsSource.findUnique({ where: { id: sourceId } });
  if (!source || !source.active) return;

  const items = await parseFeed(source);

  for (const item of items) {
    await prisma.newsItem.upsert({
      where: { urlHash: item.urlHash },
      create: {
        sourceId: source.id,
        title: item.title,
        url: item.url,
        urlHash: item.urlHash,
        summary: item.summary,
        publishedAt: item.publishedAt,
      },
      update: {},
    });
  }

  await prisma.newsSource.update({
    where: { id: source.id },
    data: { lastFetchedAt: new Date() },
  });

  logger.info({ sourceId: source.id, itemsUpserted: items.length }, "news-fetch: source fetched");
}

export function createNewsFetchWorker(): Worker {
  return new Worker<NewsFetchJobData>(
    "news-fetch",
    async (job) => {
      const { sourceId } = job.data;

      await ensureDefaultSources();

      if (sourceId) {
        await fetchSource(sourceId);
        return;
      }

      // Fetch all active sources
      const sources = await prisma.newsSource.findMany({
        where: { active: true },
        select: { id: true },
      });

      for (const src of sources) {
        await fetchSource(src.id);
      }

      logger.info({ count: sources.length }, "news-fetch: all sources fetched");
    },
    {
      connection: redis,
      concurrency: 1,
    },
  );
}
