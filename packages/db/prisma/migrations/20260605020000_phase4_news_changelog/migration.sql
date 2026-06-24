-- Phase 4 News & Changelog: NewsSource, NewsItem, ChangelogRelease, ChangelogEntry

CREATE TABLE "NewsSource" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "feedUrl"       TEXT NOT NULL,
    "category"      TEXT NOT NULL DEFAULT 'cloud',
    "active"        BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsSource_feedUrl_key" ON "NewsSource"("feedUrl");
CREATE INDEX "NewsSource_active_idx" ON "NewsSource"("active");

CREATE TABLE "NewsItem" (
    "id"          TEXT NOT NULL,
    "sourceId"    TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "url"         TEXT NOT NULL,
    "urlHash"     TEXT NOT NULL,
    "summary"     TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsItem_urlHash_key" ON "NewsItem"("urlHash");
CREATE INDEX "NewsItem_publishedAt_idx" ON "NewsItem"("publishedAt");
CREATE INDEX "NewsItem_sourceId_publishedAt_idx" ON "NewsItem"("sourceId", "publishedAt");

ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChangelogRelease" (
    "id"           TEXT NOT NULL,
    "githubId"     INTEGER NOT NULL,
    "tagName"      TEXT NOT NULL,
    "name"         TEXT,
    "bodyMarkdown" TEXT,
    "adminSummary" TEXT,
    "highlight"    BOOLEAN NOT NULL DEFAULT false,
    "published"    BOOLEAN NOT NULL DEFAULT false,
    "releasedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangelogRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChangelogRelease_githubId_key" ON "ChangelogRelease"("githubId");
CREATE INDEX "ChangelogRelease_published_releasedAt_idx"
    ON "ChangelogRelease"("published", "releasedAt");

CREATE TABLE "ChangelogEntry" (
    "id"        TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "category"  TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChangelogEntry_releaseId_idx" ON "ChangelogEntry"("releaseId");

ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_releaseId_fkey"
    FOREIGN KEY ("releaseId") REFERENCES "ChangelogRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
