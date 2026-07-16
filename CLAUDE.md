# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> A broader CLAUDE.md one directory up (`lab-gamification/CLAUDE.md`) covers the monorepo layout and worker/queue internals in more depth — this file is scoped to the `aws-lab-quest` repo itself: what the product is, how to run/test it, and the conventions specific to this codebase.

## Chat language

Responda sempre em **pt-BR** por padrão. Só mude de idioma se o usuário explicitamente pedir ou escrever a mensagem em outro idioma.

## What this is

**AWS Lab Quest** is a Portuguese-language web app that helps people prepare for AWS certifications by turning study into an RPG: users earn XP, level up, unlock achievements, and compete on a real-time leaderboard while answering questions and running themed, AI-generated labs.

Three study modes, in increasing order of formality:

| Mode | Purpose |
|---|---|
| **Lab** | AI-generated themed quests personalized to a context the user picks (music, games, sports, etc.) |
| **KC (Knowledge Check)** | Focused question sets by AWS service/topic for spot review |
| **Simulado** | Full timed mock exam — flag-for-review, pre-submit review screen, final score |

Two newer modes reuse the same question/reveal machinery: **Arena** (boss battles — answering questions deals damage to a boss with HP, one attack per correct answer) and **Trilhas** (guided topic trails). The self-feeding content loop (below) is what keeps all of these supplied with fresh, calibrated questions without manual authoring.

### What the product delivers

- **XP & levels** — every completed activity grants XP weighted by difficulty (`XpWeightConfig`); 6 level tiers in `lib/levels.ts`.
- **Badges & achievements** — per-level badge art generated via Pollinations, 12 hard-wired achievement codes auto-unlocked from session history.
- **Real-time leaderboard** — via a Supabase Realtime channel.
- **AI question pipeline** — Exam Guides and simulado PDFs get ingested, blueprint-weighted, and turned into deduplicated `StudyQuestion` rows; weak areas automatically trigger harder follow-up questions.

### Working principles (from CONTRIBUTING.md / the project blueprint)

- **Reuse before building new** — the Simulado question UI, its exam-lock behavior, and its confetti animation are the canonical implementations; Sprint/Trilhas/Arena are expected to reuse them rather than re-implement.
- **English in code, Portuguese in content** — variable/function/type/file names in English; all user-facing strings, labels, and error messages in PT-BR.
- **No direct `fetch` calls in components** — API access goes through a `services/` module in the relevant feature folder.
- **Feature branches only, PR + review against `main`** — never commit directly to `main`.
- Security vulnerabilities are reported privately (maintainer email or GitHub Security Advisories), never as a public issue.

## Commands

All commands below run from `awlq-app/` unless noted.

```bash
npm install
npm run dev              # Next.js dev server on :3000
npm run build            # production build
npm run lint             # ESLint (eslint-config-next, flat config)
npx tsc --noEmit          # typecheck (no separate script — run directly)
npm run test              # vitest run (all tests, src/__tests__/*.test.ts(x))
npx vitest run src/__tests__/arena.test.ts   # single test file
npx vitest run -t "some test name"           # filter by test name
```

Database (Prisma — schema lives at `packages/db/prisma/schema.prisma`, shared by app and worker):

```bash
npm run db:generate         # regenerate Prisma client after schema changes
npm run db:migrate          # create + apply a migration (dev)
npm run db:migrate:deploy   # apply pending migrations (prod, no prompt)
npm run db:seed             # seed badges, achievements, AWS services, admin user
npm run db:studio           # Prisma Studio GUI
```

After any schema change, also run `npm run prisma:generate` inside `awlq-worker/` — it consumes the same schema file but keeps its own generated client.

Worker (`awlq-worker/`):

```bash
npm install
npm run dev      # tsx watch (hot-reload)
npm run build    # tsc -> dist/
npm start        # run compiled dist/index.js
npx tsc --noEmit  # typecheck
npm run test      # vitest run
```

Local infra (Postgres + Redis only — run app/worker locally against them):

```bash
docker compose -f docker-compose.yml up -d postgres redis
```

Full stack for production-style testing:

```bash
docker network create rt-network   # one-time
docker compose up -d --build
docker compose logs -f
docker compose restart worker
```

Before opening a PR, `CONTRIBUTING.md`'s minimum bar is: `npm run lint`, `npx tsc --noEmit`, and `npx next build` all clean in `awlq-app`, plus `npx tsc --noEmit` clean in `awlq-worker`.

## Architecture

**Two services, one database.** `awlq-app` (Next.js App Router) handles everything synchronous: pages, API routes, auth. `awlq-worker` (BullMQ + Node) handles everything that's slow or async: AI question generation, weak-area analysis, performance metrics, quality review, email, PDF ingestion. The app hands work to the worker either by writing a `WorkerTrigger` row (polled every 30s by `trigger-poller.ts`) or by pushing directly onto a BullMQ queue.

**The self-feeding loop** is the core content mechanism — study activity continuously regrades and regenerates the question pool:

```
StudySessionHistory (user answers)
  → feedback-analysis.worker    (flags weak areas, correctRate < 60%)
  → question-generation.worker  (Gemini prompt weighted by ExamBlueprintDomain)
  → performance-compute.worker   (correctRate, discrimination index)
  → quality-review.worker        (AI retires or rewrites low-quality questions)
  → back into the study pool

source-fetch.worker (parallel): downloads AWS Exam Guides → extracts blueprint domains
```

### awlq-app layout

| Path | Role |
|---|---|
| `src/app/(app)/` | user-facing pages (Lab, KC, Simulado, Arena, Trilhas, Achievements, History) |
| `src/app/(admin)/admin/` | admin panel — upload, questions, users, worker control, simulado maker |
| `src/app/api/` | REST routes; everything under `api/admin/*` is gated by `requireAdmin()` (`lib/admin-auth.ts`) |
| `src/features/<domain>/` | domain modules, each with `components/`, `hooks/`, `screens/`, `services/` |
| `src/lib/` | singletons: `auth.ts`, `prisma.ts`, `ai.ts`, `storage.ts`, `redis.ts`, `levels.ts`, `achievements.ts`, `xp-weights.ts` |
| `src/stores/` | Zustand stores (`questStore`, `simulatedExamStore`, `userProfileStore`, `adminModeStore`, `arenaBattleStore`, ...) |
| `src/proxy.ts` | middleware — cookie-based auth gating and redirects |

Routing convention: `src/app/` stays thin (routing + server-side data fetch), domain logic lives in `src/features/<domain>/`.

### awlq-worker layout

| Path | Role |
|---|---|
| `queues/index.ts` | the 5 BullMQ queues + job payload types |
| `workers/*.worker.ts` | one processor per queue (`source-fetch`, `question-generation`, `feedback-analysis`, `performance-compute`, `quality-review`, `email-send`) |
| `services/` | business logic decoupled from queue plumbing (`blueprint-parser`, `question-builder`, `weak-area-analyzer`, `performance-calculator`, `pdf-fetcher`, `trigger-poller`, `email`) |
| `shared/ingestion-pipeline.ts` | shared with the app: `buildUsageHash`, `validateQuestion`, `persistQuestion` |
| `cron/scheduler.ts` | BullMQ repeatable jobs (patterns stored in the `ScheduledJob` table) |

Each worker has bounded concurrency (`concurrency: 1` for anything calling the AI); jobs are expected to be idempotent where possible, and `usageHash` collisions are the one case where a silent no-op is acceptable.

### Auth & access control

Better Auth 1.5 (email/password) — config in `lib/auth.ts`, client helpers in `lib/auth-client.ts`. New users default to `accessStatus: pending` and need admin approval at `/admin/users` (or a `SystemConfig.auto_approve_users` bypass). Admin API routes call `requireAdmin(request)`, which checks both session and `role === "admin"`.

### AI integration

`lib/ai.ts` + `lib/ai-config.ts` resolve the Gemini API key/model per-context from the admin-editable `SystemConfig` table, falling back to `GEMINI_API_KEY` / `GEMINI_MODEL` env vars (default `gemini-2.5-flash`). The worker (`awlq-worker/src/ai.ts`) has its own token-bucket rate limiter to respect Gemini RPM/TPM quotas — it does not share the app's client.

### PDF ingestion pipeline

Admin uploads a PDF → Supabase Storage → `AdminUploadedFile` row → `AdminIngestionJob` row → `question-generation.worker` extracts structured question blocks via Gemini → `usageHash` dedup → persisted as `StudyQuestion`.

## Design system

The UI is a deliberate retro/pixel-art RPG aesthetic, not a generic admin-dashboard look:

- **Two-font pairing**: `Press Start 2P` (`--font-pixel`, mapped to `font-mono`) for UI chrome — labels, buttons, badges, HUD text, always uppercase with wide tracking; `Nunito Sans` (`--font-body`) for anything meant to be actually read (question statements, explanations, paragraphs).
- **Hard-edged cards and buttons**: 2px solid borders, no border-radius, offset "hard" box-shadows with zero blur (`shadow-[4px_4px_0_0_var(--pixel-shadow)]`) instead of soft/blurred shadows — the `PixelCard` (`components/ui/pixel-card.tsx`) and `PixelButton` (`components/ui/pixel-button.tsx`) primitives encode this and should be reused rather than reimplemented per-feature.
- **Theming via `--pixel-*` CSS variables** (`bg`, `card`, `border`, `shadow`, `text`, `subtext`, `primary`, `accent`, `muted`) declared in `globals.css`, layered on top of the shadcn/Radix `oklch(...)` variable set — component styling should reference the `--pixel-*` tokens, not hardcode hex values, so theme changes stay centralized.
- **Radix/shadcn** for interaction primitives (Dialog, Tooltip, ScrollArea, Drawer), reskinned with the pixel tokens rather than used with shadcn's default look.
- Full-screen looping video/pixel-art backgrounds are used for atmosphere in specific high-immersion screens (e.g. Arena battles) — these are static assets in `public/backgrounds/`, not client-side-generated.

## Testing

Tests live in `src/__tests__/*.test.ts(x)` in both `awlq-app` and `awlq-worker` (Vitest, `environment: "node"`, globals on, one `vitest.config.ts` per package — no per-feature test config). Prefer testing API route handlers directly (mock `@/lib/prisma` and adjacent singletons, see `arena.test.ts` for the pattern) over spinning up the dev server.
