-- Migration: add_anonymized_to_study_session_history
-- DEF-001 fix: replaces the sentinel-userId pattern with a proper boolean flag.
-- The anonymized field marks study sessions that have passed the LGPD retention
-- window. User-facing queries must filter WHERE anonymized = FALSE.

ALTER TABLE "StudySessionHistory" ADD COLUMN "anonymized" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "StudySessionHistory_anonymized_createdAt_idx" ON "StudySessionHistory"("anonymized", "createdAt");
