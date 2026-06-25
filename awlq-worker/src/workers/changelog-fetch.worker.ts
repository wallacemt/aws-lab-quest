import { Worker } from "bullmq";
import { connection, ChangelogFetchJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";

const GITHUB_REPO_OWNER = "wallacemt";
const GITHUB_REPO_NAME = "aws-lab-quest";

type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
};

async function fetchGitHubReleases(): Promise<GitHubRelease[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases?per_page=50`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });

  if (!res.ok) {
    throw new Error(`GitHub API responded with ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<GitHubRelease[]>;
}

export function createChangelogFetchWorker(): Worker {
  return new Worker<ChangelogFetchJobData>(
    "changelog-fetch",
    async (job) => {
      logger.info({ manual: job.data.manual ?? false }, "changelog-fetch: starting");

      const releases = await fetchGitHubReleases();

      for (const release of releases) {
        await prisma.changelogRelease.upsert({
          where: { githubId: release.id },
          create: {
            githubId: release.id,
            tagName: release.tag_name,
            name: release.name ?? null,
            bodyMarkdown: release.body ?? null,
            published: false,
            releasedAt: release.published_at ? new Date(release.published_at) : null,
          },
          // Do not overwrite admin-managed fields (adminSummary, highlight, published)
          // on subsequent syncs — only update the GitHub-sourced fields.
          update: {
            tagName: release.tag_name,
            name: release.name ?? null,
            bodyMarkdown: release.body ?? null,
            releasedAt: release.published_at ? new Date(release.published_at) : null,
          },
        });
      }

      logger.info({ releaseCount: releases.length }, "changelog-fetch: upserted releases");
    },
    {
      connection,
      concurrency: 1,
    },
  );
}
