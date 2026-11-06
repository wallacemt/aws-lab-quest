-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('human', 'agent');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('admin_ui', 'mcp');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('pending', 'ok', 'error', 'denied', 'rate_limited');

-- CreateTable
CREATE TABLE "McpToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "AuditActorType" NOT NULL,
    "source" "AuditSource" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "tokenId" TEXT,
    "tool" TEXT,
    "domain" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "resourceId" TEXT,
    "status" "AuditStatus" NOT NULL,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "argsRedacted" JSONB,
    "errorMessage" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpToken_tokenHash_key" ON "McpToken"("tokenHash");

-- CreateIndex
CREATE INDEX "McpToken_userId_revokedAt_idx" ON "McpToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_createdAt_idx" ON "AdminAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_actorType_createdAt_idx" ON "AdminAuditEvent"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_domain_createdAt_idx" ON "AdminAuditEvent"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_status_createdAt_idx" ON "AdminAuditEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_tokenId_createdAt_idx" ON "AdminAuditEvent"("tokenId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_actorUserId_createdAt_idx" ON "AdminAuditEvent"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "McpToken" ADD CONSTRAINT "McpToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "McpToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
