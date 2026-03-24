# AWS Quest

Aplicacao web para preparacao de certificacoes AWS em formato gamificado, com modos Lab, KC e Simulado, ranking em tempo real, conquistas persistidas e fluxo admin para ingestao de conteudo.

## Destaques atuais

- Autenticacao com Better Auth (email/senha) e sessoes persistidas.
- Preparacao de certificacao com presets no banco (certification presets).
- Modo Simulado com:
  - regras obrigatorias antes de iniciar,
  - score final,
  - prioridades de revisao por servico fraco.
- Pre-requisito de Exam Guide:
  - admin deve enviar primeiro o guia oficial,
  - fallback manual para guias em PDF escaneado.
- Pipeline admin de PDF:
  - extracao de texto,
  - geracao de perguntas com IA,
  - persistencia no banco.
- Leaderboard em tempo real via Supabase Realtime.
- Indicador de usuarios online (> 1) no header.
- Sistema de niveis + badges por nivel.
- Sistema de conquistas persistido no banco:
  - 12 conquistas,
  - progresso e desbloqueio,
  - galeria dedicada com lock/unlock,
  - compartilhamento publico de conquista.
- Historico de labs/KC/simulado e perfil publico de jogador.

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Better Auth
- Prisma 7 + PostgreSQL
- Supabase (Storage + Realtime)
- Google Gemini API (geracao de conteudo)
- Pollinations API (geracao de imagens de badge/conquista)
- Framer Motion

## Rotas principais

### Paginas

- /
- /login
- /register
- /lab
- /kc
- /simulado
- /history
- /leaderboard
- /achievements
- /profile
- /players/[userId]
- /help
- /share/badge/[userId]/[badgeId]
- /share/achievement/[userId]/[achievementId]

### APIs

- /api/auth/[...all]
- /api/user/profile
- /api/user/username
- /api/upload-avatar
- /api/quest-history
- /api/study/history
- /api/study/kc/questions
- /api/study/simulado/questions
- /api/study/weak-services
- /api/study/explain
- /api/leaderboard
- /api/online/count
- /api/online/heartbeat
- /api/badges
- /api/achievements
- /api/users/[userId]
- /api/users/search
- /api/admin/status
- /api/admin/questions
- /api/admin/users
- /api/admin/pdf/extract
- /api/admin/pdf/ingest
- /api/admin/pdf/exam-guide

## Variaveis de ambiente

Crie um arquivo .env baseado em .env.local.example.

```env
GEMINI_API_KEY=your_gemini_api_key_here

DATABASE_URL=postgresql://awlq_user:awlq_pass@localhost:5432/awlq

BETTER_AUTH_SECRET=change_this_to_a_random_32_char_secret
BETTER_AUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here

POLLINATIONS_API_KEY=optional_key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_this_password
ADMIN_NAME=Admin
```

## Como rodar localmente

```bash
npm install
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Acesse: http://localhost:3000

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Fluxos importantes

### 1) Exam Guide obrigatorio

1. Admin envia o Exam Guide em /admin/upload (tipo: Exam Guide).
2. Se PDF for escaneado, usar campo de texto manual.
3. Depois disso, enviar PDF de simulado para ingestao de questoes.
4. Sem exam guide, /api/study/simulado/questions retorna bloqueio funcional.

### 2) Conquistas persistidas

1. Catalogo de conquistas existe na tabela Achievement.
2. Desbloqueios por usuario ficam em UserAchievement.
3. Unlock e sincronizacao acontecem automaticamente ao salvar historico de lab/KC/simulado.
4. Galeria em /achievements mostra lock/unlock, progresso e compartilhamento.

## Documentacao complementar

- [Guia de feedback via GitHub](./docs/github-feedback-integration.md)
- [Showcase: criar lab quest](./docs/showcase/labs/create-lab-quest-v1.md)
- [Guia de arquitetura e funcionalidades recentes](./docs/platform-upgrade-2026-03.md)
- [Guia do sistema de conquistas](./docs/achievements-system.md)
