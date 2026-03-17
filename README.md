# AWS Lab Quest

Aplicacao web para transformar labs AWS em uma jornada gamificada, com autenticacao, progresso por XP, badges, historico e leaderboard.

## Implementacoes principais

- Autenticacao com Better Auth (email e senha), sessoes persistidas no banco.
- Banco PostgreSQL com Prisma 7 (adapter pg).
- Perfil de usuario com avatar (upload para Supabase Storage).
- Historico de labs persistido no banco.
- Leaderboard Top 10 por XP.
- Tela de perfil publico de outros jogadores.
- Sistema de niveis com dificuldade exponencial (6 niveis).
- Badges por nivel, com colecao visual e suspense de desbloqueio.
- Animacoes com Framer Motion no perfil e badges.
- Navegacao retro dinamica com telas separadas (Login, Register, Home, Quest, History, Leaderboard, Profile, Public Profile).

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Bun
- Better Auth
- Prisma 7
- PostgreSQL
- Supabase Storage
- Google Gemini API (geracao de quests)
- Pollinations API (seed de imagens de badge)
- Framer Motion

## Fluxo de paginas

```mermaid
flowchart TD
		A[Start] --> B{Sessao valida?}
		B -- Nao --> C[Login]
		C --> D[Register]
		D --> E[Profile Setup]
		C --> F[Home]
		B -- Sim --> F[Home]

		F --> G[Quest]
		F --> H[History]
		F --> I[Leaderboard]
		F --> J[Meu Profile]

		I --> K[Public Profile de outro usuario]
		J --> L[Editar profile, avatar e ver badges]
		G --> M[Completa tasks]
		M --> H
```

## Diagrama do banco

```mermaid
erDiagram

    User {
        string id PK
        string name
        string email UK
        boolean emailVerified
        datetime createdAt
        datetime updatedAt
    }

    Session {
        string id PK
        string token UK
        datetime expiresAt
        string userId FK
    }

    Account {
        string id PK
        string providerId
        string accountId
        string userId FK
        string password
    }

    Verification {
        string id PK
        string identifier
        string value
        datetime expiresAt
    }

    UserProfile {
        string id PK
        string userId FK
        string certification
        string favoriteTheme
        string avatarUrl
    }

    QuestHistory {
        string id PK
        string userId FK
        string title
        string theme
        int xp
        int tasksCount
        datetime completedAt
    }

    LevelBadge {
        string id PK
        int level UK
        string name
        string imageUrl
        string supabasePath
    }

    User ||--o{ Session : has
    User ||--o{ Account : has
    User ||--|| UserProfile : owns
    User ||--o{ QuestHistory : logs

```

## Rotas principais

- Paginas:
  - /
  - /login
  - /register
  - /quest
  - /history
  - /leaderboard
  - /profile
  - /players/[userId]

- APIs:
  - /api/auth/[...all]
  - /api/health
  - /api/user/profile
  - /api/upload-avatar
  - /api/quest-history
  - /api/leaderboard
  - /api/badges
  - /api/users/[userId]

## Variaveis de ambiente

Crie um arquivo .env com base em .env.local.example:

```env
GEMINI_API_KEY=your_gemini_api_key_here

# PostgreSQL (Docker local)
DATABASE_URL=postgresql://awlq_user:awlq_pass@localhost:5432/awlq

# Better Auth
BETTER_AUTH_SECRET=change_this_to_a_random_32_char_secret
BETTER_AUTH_URL=http://localhost:3000
 APP_URL=http://localhost:3000

# Supabase (storage for avatars + badges)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
 SUPABASE_URL=https://your-project.supabase.co
 SUPABASE_ANON_KEY=your_anon_key_here

# Optional (seed badge image provider)
POLLINATIONS_API_KEY=optional_key
```

## Como rodar localmente

1. Instalar dependencias

```bash
bun install
```

2. Subir PostgreSQL local

```bash
docker compose up -d
```

3. Gerar Prisma Client

```bash
bun run db:generate
```

4. Aplicar migracoes

```bash
bun run db:migrate
```

5. Popular badges no banco/storage

```bash
bun run db:seed
```

6. Rodar app

```bash
bun run dev
```

7. Abrir no navegador

http://localhost:3000

## Scripts

```bash
bun run dev
bun run build
bun run start
bun run lint
bun run db:generate
bun run db:migrate
bun run db:seed
bun run db:studio
```

## Observacoes

- O proxy protege rotas privadas e redireciona para login quando nao ha sessao.
- Upload de avatar e badges usam o bucket aws-lab-quest no Supabase Storage.
- Se ocorrer erro "Invalid Compact JWS" no seed/upload, valide se SUPABASE_SERVICE_ROLE_KEY e uma chave real do projeto.

## Tutoriais

Showcases e tutoriais de como usar o app.

### Criar Lab Quest

Tutorial completo de como gerar uma quest gamificada usando AWS Labs.

➡️ [Assistir tutorial](./docs/showcase/labs/create-lab-quest-v1.md)

### Integracao de Feedback

Guia de como direcionar usuarios para o canal oficial de feedback via GitHub Issues.

➡️ [Ver guia](./docs/github-feedback-integration.md)

### Em breve

- Criando Knowledge Check (KC)
- Fazendo Simulado
- Modo Revisao
