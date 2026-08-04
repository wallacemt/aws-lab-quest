# Security Audit — 2026-08-02

Auditoria de segurança completa (SAST manual + threat modeling + análise de dependências + hardening de configuração) realizada pelo agente Lawliet sobre `awlq-app/`, `awlq-worker/`, `packages/db/prisma`, Docker/compose, CI e dependências.

Escopo: 143 rotas API, auth/authz, upload/storage, pipeline de IA, ingestão de PDF, config de deploy.

Como usar este documento: cada item é um checkbox. Ao corrigir um achado, marque `[x]`, adicione a data e o commit/PR na coluna de status, e mova para a seção "Resolvidos" no fim se preferir manter o topo só com pendências. Não remova itens — isto é o histórico de auditoria.

---

## High

- [x] **LSF-2026-101** — Forja de XP/pontuação/gabarito em `POST /api/study/history`
  Cliente controla `gainedXp`, `correctOption` e `scorePercent`; sem snapshot, XP do cliente é persistido direto.
  `awlq-app/src/app/api/study/history/route.ts:96,131-137,182-185`
  **Resolvido**: `POST` agora busca `questionType`/`correctOption`/`correctOptions` no banco e recalcula `correctAnswers`/`totalQuestions`/`scorePercent`/`gainedXp` inteiramente no servidor a partir do `answersSnapshot`; campos enviados pelo cliente são ignorados.

- [x] **LSF-2026-102** — `accessStatus`/`active` não verificados na maioria das rotas autenticadas
  `requireApprovedUser()` usado em só 10 de ~58 rotas; `User.active` (soft-delete LGPD) nunca é checado.
  `awlq-app/src/lib/user-auth.ts:19-41`, `awlq-app/src/lib/admin-auth.ts:31`
  **Resolvido**: `active: true` adicionado ao select/condição em `user-auth.ts` e `admin-auth.ts`; ~47 rotas migradas de `auth.api.getSession` cru para `requireApprovedUser(request)`.

- [x] **LSF-2026-103** — Next.js 16.1.6: bypass de Middleware/Proxy + gate admin só no client
  6 advisories de bypass; `app/(admin)/layout.tsx` não valida role no server, só `AdminShellLayout.tsx` (client component).
  `awlq-app/package.json:38`, `awlq-app/src/proxy.ts:29-66`, `awlq-app/src/app/(admin)/layout.tsx`
  **Resolvido**: `next` atualizado para `16.2.12`; `app/(admin)/layout.tsx` convertido em Server Component que valida sessão + `role === "admin"` + `active` via Prisma e faz `redirect("/admin/login")` antes de renderizar o shell (gate client mantido como defesa em profundidade).

- [x] **LSF-2026-104** — Ausência total de rate limiting
  Nenhuma proteção em rotas de IA, upload ou login (além do default não configurado do Better Auth).
  Todo o app; ver `awlq-app/src/lib/auth.ts`
  **Resolvido**: `rateLimit` configurado em `lib/auth.ts` (100 req/60s global, 5/60s em `/sign-in/email` e `/sign-up/email`, 3/60s em `/forget-password`); novo helper `lib/rate-limit.ts` (Redis INCR+EXPIRE, fail-open sem Redis) aplicado em `generate`, `study/gap/chat`, `study/explain`, `upload-avatar`, `user/badge-image` (`mentor/ask` já tinha limite de 1/24h próprio).

- [x] **LSF-2026-105** — Dependências com 47 advisories (24 high, 20 moderate, 3 low)
  `next` (≥16.2.5), `better-auth` (≥1.6.22), `nodemailer`, `sharp`, `postcss`, transitivas de `shadcn`.
  `awlq-app/package.json`, `awlq-worker/package.json`
  **Resolvido**: `next` → `16.2.12`, `better-auth`/`nodemailer` atualizados via `bun update`, `sharp` fixado como dependência direta (`^0.35.3`, estava resolvendo transitivamente para `0.34.5` vulnerável). **Risco aceito e documentado**: `postcss@8.4.31` vulnerável permanece como dependência interna vendorizada do próprio Next.js (não é dependência direta do projeto, sem `overrides`/`resolutions` configurados); impacto real é baixo pois é só build-time, sem CSS controlado por atacante nesta app.

## Medium

- [x] **LSF-2026-201** — SSRF via `POST /api/admin/ingestion-sources`
  Falta usar `isAllowedFeedUrl` (já existe e é usado em rotas irmãs `news-sources`, `arena/bosses`).
  `awlq-app/src/app/api/admin/ingestion-sources/route.ts:23-27`, `awlq-worker/src/services/pdf-fetcher.ts:23`
  **Resolvido**: `isAllowedFeedUrl` aplicado em `ingestion-sources/route.ts`; `pdf-fetcher.ts` ganhou `redirect: "manual"` + rejeição de status 3xx (defesa contra bypass via redirect).

- [x] **LSF-2026-202** — Prompt injection na pipeline de ingestão de PDF (worker)
  Texto extraído de PDF/Exam Guide entra no prompt do Gemini sem sanitização (o app tem `containsPromptInjection`, o worker não).
  `awlq-worker/src/services/question-builder.ts:136-147`, `awlq-worker/src/services/blueprint-parser.ts`
  **Resolvido**: `containsPromptInjection` portado para `awlq-worker/src/shared/ingestion-pipeline.ts`; `blueprint-parser.ts#extractDomainsWithAI` loga um warning quando detecta padrões suspeitos e envolve o excerto do PDF em delimitadores `"""..."""` com instrução explícita de tratar como DADOS, nunca como instruções (mesmo estilo de `api/generate/route.ts`). `question-builder.ts#buildPrompt` não embute texto bruto (só campos estruturados), fora de escopo.

- [x] **LSF-2026-203** — Nenhum security header configurado
  Sem CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
  `awlq-app/next.config.ts`
  **Resolvido**: `async headers()` adicionado em `next.config.ts` com HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy e CSP.

- [ ] **LSF-2026-204** — Segredos e config de ambiente
  Credenciais de produção reais em `.env` local a rotacionar; `ADMIN_PASSWORD` previsível; `BETTER_AUTH_URL=http://` pode desligar cookie `Secure`; `.env` raiz fora do `.dockerignore`; `ENCRYPTION_KEY` duplicada entre serviços (risco aceito, registrar).
  `.env`, `awlq-app/.env`, `awlq-app/src/lib/auth.ts:96-100`, `.dockerignore`
  **Parcial**: `.env`/`.env.*` adicionados ao `.dockerignore` (não vazam mais para a imagem). Rotação de credenciais de produção, troca de `ADMIN_PASSWORD`, `BETTER_AUTH_URL` para `https://` em produção e decisão sobre `ENCRYPTION_KEY` duplicada são ações operacionais fora do repo — pendentes.

- [x] **LSF-2026-205** — Containers Docker rodando como root
  Sem `USER` nos stages `runner`.
  `awlq-app/Dockerfile`, `awlq-worker/Dockerfile`
  **Resolvido**: usuário não-root `app` criado via `addgroup -S app && adduser -S app -G app`, `--chown=app:app` nas cópias `COPY --from=builder`, `USER app` antes do `CMD` em ambos os Dockerfiles.

- [x] **LSF-2026-206** — `shadcn` (CLI de scaffolding) em `dependencies` de produção
  Traz `hono`, `js-yaml`, `fast-uri`, `valibot` para a imagem final; nada em `src/` importa.
  `awlq-app/package.json:49`
  **Resolvido**: `shadcn` movido para `devDependencies`.

- [x] **LSF-2026-207** — `POST /api/study/gap/chat`: system prompt montado com input do cliente
  `serviceName`/`questionStatement`/`correctAnswerText` do body vão direto pro system instruction, sem rate limit.
  `awlq-app/src/app/api/study/gap/chat/route.ts:58-73`
  **Resolvido**: rota reescrita para receber só `questionId`; `statement`/`correctOption`/`serviceName` são buscados no Prisma no servidor (cliente não controla mais o conteúdo do prompt); rate limit de 15/60s adicionado (LSF-2026-104).

- [x] **LSF-2026-208** — Vazamento de detalhes de erro do provedor de IA ao cliente
  `err.message` cru devolvido (inclui corpo de resposta da OpenRouter) em 4 rotas.
  `awlq-app/src/app/api/mentor/ask/route.ts:148-149`, `study/gap/chat/route.ts:84-85`, `admin/uploads/[fileId]/signed-url/route.ts:55`, `admin/library/[contentId]/upload/route.ts:94`
  **Resolvido**: as 4 rotas agora retornam mensagem genérica ao cliente e logam o erro real via `console.error`.

## Low

- [x] **LSF-2026-301** — `dangerouslySetInnerHTML` no preview de e-mail do admin (XSS admin→admin)
  `awlq-app/src/features/admin/screens/AdminEmailScreen.tsx:658,905`
  **Resolvido**: ambos os blocos substituídos por `<iframe sandbox="" srcDoc={...} />` (origem opaca, sem execução de script, sem acesso a cookies/storage).

- [x] **LSF-2026-302** — `set-password` não revoga sessões existentes do usuário
  `awlq-app/src/app/api/admin/users/[userId]/set-password/route.ts:36-49`
  **Resolvido**: `prisma.session.deleteMany({ where: { userId } })` adicionado antes da resposta final.

- [x] **LSF-2026-303** — `package-lock.json` dessincronizados quebram `npm audit`/Dependabot
  `awlq-app/package-lock.json`, `awlq-worker/package-lock.json`
  **Resolvido**: `package-lock.json` deletados (projeto usa `bun.lock`); `bun audit --audit-level=high` adicionado ao CI (`.github/workflows/ci-cd.yml`) para `awlq-app` e `awlq-worker`.

- [x] **LSF-2026-304** — `process.env._APP_URL` inexistente em `auth-client.ts` (bug, sem impacto de segurança hoje)
  `awlq-app/src/lib/auth-client.ts:5`
  **Resolvido**: simplificado para `createAuthClient({})`, removendo o lookup morto.

- [x] **LSF-2026-305** — Avatar de bucket público hardcoded como fallback (expõe project ref do Supabase)
  `awlq-app/src/app/api/users/search/route.ts:43`
  **Resolvido**: fallback trocado para `/default-avatar.png` (asset local).

- [ ] **LSF-2026-306** — Bucket Supabase possivelmente ainda público (TODO pendente no código, não verificável do repo)
  `awlq-app/src/app/api/upload-avatar/route.ts:66`, `awlq-app/src/app/api/user/badge-image/route.ts:60`

- [ ] **LSF-2026-307** — Sessões de 30 dias sem step-up auth para ações admin destrutivas (risco aceito possível)
  `awlq-app/src/lib/auth.ts:96-99`

## Informational (sem ação necessária — registrado para o histórico)

- [x] **LSF-2026-401** — Nenhuma SQL injection encontrada (todos os `$queryRaw` são parametrizados)
- [x] **LSF-2026-402** — Nenhum IDOR encontrado (ownership checado consistentemente em rotas `[id]`)
- [x] **LSF-2026-403** — Exposição a CSRF é baixa (JSON + preflight CORS; `trustedOrigins` restrito)

---

## Quick wins (ordem sugerida, ≤15 min cada)

- [x] `bun update next better-auth nodemailer` em `awlq-app/` e `awlq-worker/` → LSF-2026-103, 105
- [x] Mover `shadcn` para `devDependencies` → LSF-2026-206
- [x] Adicionar `isAllowedFeedUrl` em `ingestion-sources/route.ts:23` → LSF-2026-201
- [x] Adicionar `active: true` ao select/condição de `user-auth.ts:33` e `admin-auth.ts` → LSF-2026-102
- [x] Recalcular XP/score server-side em `study/history/route.ts` (não só zerar fallback) → LSF-2026-101
- [x] `USER app` nos dois `Dockerfile`s (stage `runner`) → LSF-2026-205
- [x] Adicionar `.env` e `**/.env` ao `.dockerignore` → LSF-2026-204 (parcial)
- [x] Bloco `headers()` em `next.config.ts` → LSF-2026-203
- [x] Deletar `package-lock.json` obsoletos + `bun audit` no CI → LSF-2026-303, 105
- [x] Trocar avatar hardcoded por `/default-avatar.png` em `users/search/route.ts:43` → LSF-2026-305

## Não coberto pela auditoria (requer verificação fora do repo)

- Configuração real do bucket Supabase (público vs. privado, políticas RLS) — LSF-2026-306
- Comportamento em runtime do `rateLimit` do Better Auth e do `lib/rate-limit.ts` sob carga real (configurado, não testado sob carga) — LSF-2026-104
- Configuração do reverse proxy à frente do container (TLS, HSTS, timeouts)
- Testes dinâmicos (DAST) / exploração ativa — todos os PoCs no relatório original são conceituais

---

## Log de resoluções

| Data | Item(ns) | Commit/PR | Observações |
|---|---|---|---|
| 2026-08-03 | LSF-2026-101, 102, 103, 104, 105, 201, 202, 203, 205, 206, 207, 208, 301, 302, 303, 304, 305 | (não commitado ainda) | Correções aplicadas diretamente no working tree pelo Claude Code; LSF-2026-204 parcial (só `.dockerignore`); LSF-2026-306 e 307 permanecem como risco aceito/fora do repo. A migração em massa de ~47 rotas para `requireApprovedUser()` (LSF-2026-102) quebrou os mocks de auth de 7 arquivos de teste (assumiam `auth.api.getSession` cru); mocks corrigidos para usar `@/lib/user-auth` diretamente, seguindo o padrão já usado em `arena.test.ts`. `npx tsc --noEmit`, `npm run lint` e `npx vitest run` (247/247) limpos em `awlq-app`; `npx tsc --noEmit` e `npx vitest run` (23/23) limpos em `awlq-worker`. |
