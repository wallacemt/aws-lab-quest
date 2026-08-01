# awlq-app

Frontend + API do **AWS Lab Quest** — Next.js 16 (App Router), React 19, TypeScript. Serve as páginas e expõe as rotas REST consumidas pelo próprio app; tudo que é lento ou assíncrono (IA, email, ingestão de PDF) é delegado ao `awlq-worker` via `WorkerTrigger`/BullMQ.

Visão geral do produto, arquitetura completa (app + worker) e variáveis de ambiente estão no [README da raiz](../README.md).

## Comandos

```bash
npm install
npm run dev              # servidor de dev em :3000
npm run build             # build de produção
npm run lint              # ESLint (eslint-config-next, flat config)
npx tsc --noEmit           # typecheck
npm run test               # vitest run (src/__tests__/*.test.ts(x))
```

Banco de dados (schema compartilhado em `../packages/db/prisma/schema.prisma`):

```bash
npm run db:generate         # regenera o Prisma Client
npm run db:migrate          # cria + aplica uma migration (dev)
npm run db:migrate:deploy   # aplica migrations pendentes (prod)
npm run db:seed             # popula badges, conquistas, serviços AWS, admin
npm run db:studio           # Prisma Studio
```

## Estrutura

| Path | Papel |
|---|---|
| `src/app/(app)/` | Páginas voltadas ao usuário (Lab, KC, Simulado, Arena, Trilhas, Conquistas, Histórico) |
| `src/app/(admin)/admin/` | Painel admin — upload, questões, usuários, controle do worker |
| `src/app/api/` | Rotas REST; tudo sob `api/admin/*` é protegido por `requireAdmin()` |
| `src/features/<domínio>/` | Módulos de domínio (`components/`, `hooks/`, `screens/`, `services/`) |
| `src/lib/` | Singletons: `auth.ts`, `prisma.ts`, `ai.ts`, `storage.ts`, `redis.ts`, `levels.ts` |
| `src/stores/` | Zustand stores |
| `src/proxy.ts` | Middleware — gate de autenticação e redirects |

Detalhes de convenções (design system, testes, integração com IA) estão no `CLAUDE.md` da raiz do repositório.
