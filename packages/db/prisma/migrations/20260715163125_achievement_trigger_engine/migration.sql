-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "target" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "triggerType" TEXT NOT NULL DEFAULT 'XP_TOTAL',
ADD COLUMN     "triggerParams" JSONB;

-- Backfill: migrate the 13 built-in achievement codes from the old hardcoded
-- switch in achievements.ts to the new data-driven trigger engine. No-op for
-- any other code (new admin-created achievements already set these on insert).
UPDATE "Achievement" SET "target" = 1, "triggerType" = 'LAB_COUNT', "triggerParams" = NULL WHERE "code" = 'first_lab';
UPDATE "Achievement" SET "target" = 10, "triggerType" = 'LAB_COUNT', "triggerParams" = NULL WHERE "code" = 'lab_master_10';
UPDATE "Achievement" SET "target" = 25, "triggerType" = 'LAB_COUNT', "triggerParams" = NULL WHERE "code" = 'lab_master_25';
UPDATE "Achievement" SET "target" = 1, "triggerType" = 'SESSION_SCORE_COUNT', "triggerParams" = '{"sessionType":"KC","minScorePercent":100}' WHERE "code" = 'perfect_kc';
UPDATE "Achievement" SET "target" = 1, "triggerType" = 'SESSION_SCORE_COUNT', "triggerParams" = '{"sessionType":"SIMULADO","minScorePercent":70}' WHERE "code" = 'simulado_aprovado';
UPDATE "Achievement" SET "target" = 5, "triggerType" = 'SESSION_COUNT', "triggerParams" = '{"sessionType":"SIMULADO"}' WHERE "code" = 'simulado_veterano_5';
UPDATE "Achievement" SET "target" = 10, "triggerType" = 'SESSION_COUNT', "triggerParams" = '{"sessionType":"KC"}' WHERE "code" = 'knowledge_hunter_10';
UPDATE "Achievement" SET "target" = 500, "triggerType" = 'XP_TOTAL', "triggerParams" = NULL WHERE "code" = 'xp_500';
UPDATE "Achievement" SET "target" = 2000, "triggerType" = 'XP_TOTAL', "triggerParams" = NULL WHERE "code" = 'xp_2000';
UPDATE "Achievement" SET "target" = 3, "triggerType" = 'STREAK_DAYS', "triggerParams" = NULL WHERE "code" = 'streak_3_days';
UPDATE "Achievement" SET "target" = 20, "triggerType" = 'TOTAL_SESSIONS', "triggerParams" = NULL WHERE "code" = 'consistency_20_sessions';
UPDATE "Achievement" SET "target" = 2, "triggerType" = 'XP_AND_SESSION_SCORE_COMBO', "triggerParams" = '{"xpThreshold":5000,"sessionType":"SIMULADO","minScorePercent":70,"sessionCountThreshold":5}' WHERE "code" = 'aws_legend';
UPDATE "Achievement" SET "target" = 1, "triggerType" = 'CERT_COUNT', "triggerParams" = NULL WHERE "code" = 'first_real_cert';
