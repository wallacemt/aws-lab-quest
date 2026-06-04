# AWS Lab Quest — Feature Summary

**Last updated:** 2026-06-01  
**Stack:** Next.js (App Router) + BullMQ worker + PostgreSQL (Prisma) + Redis + Supabase Storage  
**Auth:** Better Auth 1.5 — email/password, session-based. New users require admin approval unless `auto_approve_users` is on.

---

## User Features

### Study Modes

| Feature | Route | What it does |
|---|---|---|
| **Lab** | `/lab` | User descreve um tópico ou serviço AWS; a IA (Gemini) gera um lab prático com tarefas graduadas por dificuldade (easy → nightmare). Draft salvo no localStorage. |
| **Quest** | `/quest` | Board ativo do lab em andamento — kanban/checklist de tarefas com painel de XP. Só existe enquanto há um lab ativo. |
| **Revisão** | `/revisao` | Detecta os 20 serviços com pior desempenho e sugere um lab de fechamento de gaps direcionado a esses tópicos. |
| **KC (Knowledge Check)** | `/kc` | Quiz de múltipla escolha. Usuário escolhe serviços AWS, dificuldade e quantidade de questões; o sistema serve questões do banco + IA. Exibe resumo com acertos/erros e XP ganho. |
| **Simulado** | `/simulado` | Prova cronometrada no estilo exame AWS real. Pode escolher um pack temático ou modo aleatório, pausar/retomar (persiste no localStorage), revisar respostas ao final. Exibe gauge de score, overview por domínio e mensagem motivacional gerada por IA. |
| **Jornada** | `/jornada` | Mapa visual no estilo RPG retrô mostrando a trilha de simulados do iniciante até o BOSS (certificação). Progresso calculado pelo histórico de simulados concluídos. |

### Gamificação

| Feature | Onde aparece | Detalhes |
|---|---|---|
| **XP** | Toda sessão de estudo | Ponderado por dificuldade (`XpWeightConfig`). Multiplicadores: easy 0.8×, medium 1×, hard 1.4×, nightmare 2×. |
| **Níveis** | Perfil, HUD | 6 tiers: Recruta (0) → Cadete (1500) → Explorador (4500) → Especialista (12k) → Guardião AWS (28k) → Lendário (60k). |
| **Achievements** | `/achievements` | 13 conquistas com raridade (common → legendary), artwork pixel-art gerado via Pollinations API. Desbloqueados automaticamente ao salvar histórico. |
| **Badges de nível** | Perfil | Imagens geradas por IA, armazenadas no Supabase Storage. |
| **Leaderboard** | `/leaderboard` | Ranking em tempo real via Supabase Realtime channel `leaderboard-updates`. |
| **Toasts de progresso** | Em toda app | `AchievementToast` e `LevelUpToast` disparados automaticamente ao desbloquear conquistas ou subir de nível. |
| **Compartilhamento** | `/share/achievement/:userId/:achievementId` e `/share/badge/:userId/:badgeId` | Cards públicos otimizados para redes sociais (OG image). |

### Perfil e Conta

| Feature | Rota | Detalhes |
|---|---|---|
| **Perfil** | `/profile` | 5 abas: Perfil (avatar, nome, certificação alvo), Conquistas, Evolução (gráfico de XP e sessões), Personalizar (tema, background), Privacidade (LGPD). |
| **Perfil público** | `/players/:userId` | Versão pública do perfil de outro jogador. |
| **Certificações reais** | Perfil → aba Conquistas | Usuário registra certificações AWS obtidas; gera badge especial `first_real_cert` (epic). |
| **Dados e privacidade** | `/minha-conta/privacidade` | Tela de direitos LGPD: exportar dados, solicitar exclusão, gerenciar consentimentos. |
| **Histórico** | `/history` | Histórico de sessões (Labs, KCs, Simulados) com abas separadas. Simulados possuem review detalhado em `/simulado/historico/:historyId`. |

### Auth

- Registro (`/register`), Login (`/login`), Recuperação de senha (`/forgot-password`, `/reset-password`).
- Usuários novos ficam com `accessStatus: pending` até aprovação admin.
- Middleware (`proxy.ts`) bloqueia rotas autenticadas e redireciona para login.

---

## Admin Features

Todas as rotas `/admin/*` exigem `role === "admin"` verificado por `requireAdmin()`.  
Acesso via login separado em `/admin/login`.

### Dashboard Analítico

**Rota:** `/admin`

Dashboard com seletor de período (14 / 30 / 60 / 90 dias) e 5 abas:

| Aba | O que mostra |
|---|---|
| **Visão Geral** | KPIs principais: sessões, usuários ativos, questões geradas, XP distribuído. |
| **Questões** | Distribuição por certificação, qualidade média, taxa de acerto, questões flagged/retired. |
| **Usuários** | Novos cadastros, aprovações pendentes, usuários ativos, distribuição de níveis. |
| **Engajamento** | Sessões por dia, streak médio, modos mais usados, retenção. |
| **Sistema** | Status das filas BullMQ, último ciclo do worker, erros recentes. |

### Gestão de Questões

**Rota:** `/admin/questions`

- Listagem com filtros por certificação, serviço, status e dificuldade.
- Modal de detalhe com opção de editar, flags de qualidade (flagged, retired, improved).
- Criação manual de questões via `QuestionCreateModal`.
- Chart de distribuição de questões por domínio (`AdminQuestionsChartTab`).

### Upload e Ingestão de PDF

**Rotas:** `/admin/upload` (novo upload) e `/admin/uploads` (histórico)

- Upload de PDF para Supabase Storage → cria `AdminUploadedFile` + `AdminIngestionJob`.
- Worker processa o job: Gemini extrai blocos de questões estruturadas.
- Deduplicação por `usageHash` (SHA-256 do texto normalizado).
- Histórico mostra status de cada job (pending → processing → done / error).

### Simulados

**Rotas:** `/admin/simulados` e `/admin/simulados/maker`

- Listagem de packs com artwork, nome e estatísticas de uso.
- Maker: criação de novo pack com seleção de questões, capa (gerada por IA ou upload manual via `AiArtworkGenerator` / `ArtworkUploadField`), e metadata.

### Usuários

**Rotas:** `/admin/users` e `/admin/users/:userId`

- Listagem de todos os usuários com status (pending, active, blocked).
- Aprovação / rejeição de novos cadastros.
- Modal de edição: alterar nome, role, status, certificação alvo.
- Página de detalhe: histórico de sessões, XP total, achievements, atividade recente.

### Worker e Background Jobs

**Rota:** `/admin/worker`

Painel de controle do BullMQ worker com:

| Seção | Detalhes |
|---|---|
| **Ingestion Sources** | URLs de Exam Guides da AWS, status do último fetch, domínios extraídos, questões geradas por fonte. Toggle ativo/inativo. |
| **Blueprint Stats** | Distribuição de peso por domínio para cada certificação. |
| **Weak Area Reports** | Relatórios gerados pelo `feedback-analysis.worker` — sessões analisadas, áreas fracas, geração enfileirada. |
| **Performance** | Contadores globais: questões flagged, improved, retired pelo `quality-review.worker`. |
| **Trigger History** | Histórico de `WorkerTrigger` rows: ação, fonte, processado em. |
| **Scheduled Jobs** | Cron jobs configuráveis em tabela `ScheduledJob`; editor de expressão cron com visualização legível. |
| **Queue Stats** | Total / pending / processed por fila. |

### Configuração de IA

**Rota:** `/admin/config-ia`

Configuração de modelo + API key por contexto, sem reiniciar o servidor:

| Contexto | Uso |
|---|---|
| `QUESTION_GENERATION` | Geração de novas questões a partir de blueprints. |
| `QUESTION_EXPLAIN` | Explicações e feedback por questão. |
| `SIMULADO_MESSAGE` | Mensagem motivacional ao finalizar simulado. |
| `LAB_GENERATION` | Geração de labs práticos. |

Suporte a múltiplos provedores: Gemini, OpenAI, Anthropic. Fallback para variáveis de ambiente (`GEMINI_API_KEY`, `GEMINI_MODEL`).

### E-mail

**Rota:** `/admin/email`

- **Templates manuais:** criação/edição de templates HTML + texto com variáveis `{{name}}`, `{{app_url}}`, etc. Preview em tempo real. Envio para usuário específico ou lista.
- **E-mails comportamentais:** toggle on/off por trigger (`churn_risk`, etc.), análise sob demanda, visualização de status geral.
- Templates de sistema gerenciados em `lib/admin-email-templates.ts`.

---

## Self-Feeding Loop (Background)

O worker executa um ciclo autônomo de melhoria contínua:

```
Sessões de estudo
  → feedback-analysis.worker  (detecta áreas fracas, correctRate < 60%)
  → question-generation.worker (gera novas questões ponderadas por ExamBlueprintDomain)
  → performance-compute.worker (calcula correctRate, índice de discriminação)
  → quality-review.worker      (IA melhora ou aposenta questões de baixa qualidade)
  → de volta ao pool de estudo

source-fetch.worker (paralelo): baixa Exam Guides → extrai domínios de blueprint
```

Isso garante que o banco de questões se adapta ao desempenho real dos usuários ao longo do tempo.
