import { Worker } from "bullmq";
import { redis, SourceFetchJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { fetchAndExtractText } from "../services/pdf-fetcher.js";
import { parseBlueprintDomains } from "../services/blueprint-parser.js";
import { logger } from "../shared/logger.js";

export function createSourceFetchWorker(): Worker {
  return new Worker<SourceFetchJobData>(
    "source-fetch",
    async (job) => {
      const { ingestionSourceId, url, certificationCode, force } = job.data;

      logger.info({ ingestionSourceId, url }, "source-fetch: starting");

      // Mark as fetching
      await prisma.ingestionSource.update({
        where: { id: ingestionSourceId },
        data: { status: "FETCHING", errorMessage: null },
      });

      const source = await prisma.ingestionSource.findUnique({
        where: { id: ingestionSourceId },
        select: { lastFetchSha256: true, certificationPresetId: true },
      });

      const result = await fetchAndExtractText(url, force ? null : source?.lastFetchSha256);

      if (!result.ok) {
        await prisma.ingestionSource.update({
          where: { id: ingestionSourceId },
          data: { status: "FAILED", errorMessage: result.error },
        });
        throw new Error(result.error);
      }

      if (result.unchanged) {
        logger.info({ ingestionSourceId }, "source-fetch: content unchanged, skipping");
        await prisma.ingestionSource.update({
          where: { id: ingestionSourceId },
          data: { status: "COMPLETED", lastFetchedAt: new Date(), lastFetchSha256: result.sha256 },
        });
        return;
      }

      // Parse blueprint domains from extracted text
      const certPresetId = source?.certificationPresetId;
      let parsedDomainCount = 0;

      if (certPresetId && result.text) {
        const domains = await parseBlueprintDomains(result.text, certificationCode);

        for (const domain of domains) {
          await prisma.examBlueprintDomain.upsert({
            where: {
              certificationPresetId_domainNumber: {
                certificationPresetId: certPresetId,
                domainNumber: domain.number,
              },
            },
            update: {
              domainName: domain.name,
              weightPercent: domain.weightPercent,
              subTopics: domain.subTopics,
              ingestionSourceId,
              active: true,
            },
            create: {
              certificationPresetId: certPresetId,
              ingestionSourceId,
              domainNumber: domain.number,
              domainName: domain.name,
              weightPercent: domain.weightPercent,
              subTopics: domain.subTopics,
              active: true,
            },
          });
        }

        parsedDomainCount = domains.length;
        logger.info({ certificationCode, parsedDomainCount }, "source-fetch: domains upserted");
      }

      await prisma.ingestionSource.update({
        where: { id: ingestionSourceId },
        data: {
          status: "COMPLETED",
          lastFetchedAt: new Date(),
          lastFetchSha256: result.sha256,
          parsedDomainCount,
          errorMessage: null,
        },
      });

      logger.info({ ingestionSourceId, parsedDomainCount }, "source-fetch: done");
    },
    {
      connection: redis,
      concurrency: 2,
      limiter: { max: 5, duration: 60_000 },
    }
  );
}
