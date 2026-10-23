# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.2.0] — 2026-10-23

### Features

#### Simulado
- feat(simulado): formatação inteligente de enunciados — blocos JSON/código dentro da questão são detectados e formatados em vez de exibidos como texto corrido
- feat(simulado): tela de resultado pós-prova unificada, com filtros por acerto/erro, tempo de resposta, questões marcadas e nível de confiança; corrige overflow de texto longo e UX do modo foco
- feat(simulado): configuração pré-simulado e presets reutilizáveis (`SimuladoConfigPreset`) — escolha entre estilo de prova real (revisão só no final) ou explicação a cada questão, e entre cronômetro regressivo com bloqueio, cronômetro livre ou sem cronômetro; CRUD de presets por usuário (limite 12) via `/api/user/simulado-presets`; comportamento padrão sem configuração permanece idêntico ao anterior
- fix(simulado-packs): corrige erro 502 do Pollinations na geração de artwork e refaz a geração de imagens dos packs
- feat(admin): wizard de geração automática de packs de simulado e rotas admin de simulado atualizadas

#### Jornada de Certificação
- feat(journeys): modelo de jornada de certificação com registro de atividade e UI para iniciar uma nova jornada
- feat(journeys): histórico e perfil passam a ser escopados pela jornada ativa; é possível navegar o desempenho de jornadas passadas
- fix(journeys): reabre a jornada existente em vez de duplicar; edição da certificação-alvo bloqueada fora do fluxo de jornada; XP do perfil público permanece global (consistente com o leaderboard); cache de perfil/histórico invalidado ao trocar de jornada

#### Login social & Onboarding
- feat(auth): login social via Google/GitHub com onboarding guiado por checklist e galeria de ilustrações
- fix(auth): linking de conta social com conta email/senha já existente; correções de achados do Sourcery na PR de social login
- fix(deps): vulnerabilidades high reportadas pelo `bun audit` (nanoid, deepmerge e outras)

#### Admin
- feat(admin): telas e rotas de gestão de certificações (CRUD)
- feat(admin): sugestões via IA para Arena e outras áreas do painel admin
- feat(admin): upload de documentos da biblioteca e edição de changelog refinados; UI do card de release aprimorada

#### Arena & Estudo
- feat(arena): conquistas (achievements) visíveis na tela de batalha de boss
- feat(study): banners de ajuda contextual nas telas de estudo, com botão de ajuda reutilizável
- feat(theming): extração de cor de tema a partir da imagem/artwork para background dinâmico

#### Analytics
- feat: tracking Umami adicionado ao app

### Infraestrutura / Segurança
- feat(security): hardening de configuração (Dockerfile, `next.config.ts`, layout e auth do admin)
- feat(db): timeout maior para transações do Prisma
- docs(security): auditoria de segurança registrada em `docs/SECURITY_AUDIT.md`
- chore(deps): atualizações de dependências/lockfile para corrigir falhas de CI de lint, typecheck e audit
- fix: erros de TypeScript que bloqueavam o build Docker da app

### Bug Fixes
- fix(lint): erro bloqueante `react-hooks/refs` em `FileDropzone`
- fix(ci): variáveis `DATABASE_URL`/`REDIS_URL` ausentes no step de teste do worker — o job "Test worker" do CI/CD estava quebrado desde a introdução do worker de flashcard-reminder

### Database
- migration `20261023000000_simulado_config_presets` — tabela `SimuladoConfigPreset` e enums de estilo de prova/modo de cronômetro

---

## [2.1.0] — 2026-06-23

### Features

#### Trilhas — Expansão de Estudo (Phase 2+)
- feat(trails): API `/api/trails/[chainId]/stages/[stageId]/explain` — explicação de estágio gerada por IA (Gemini), com seções estruturadas (O que é · Como funciona · Casos de uso · Dicas de certificação · Armadilhas comuns · Resumo), personalizada por tema favorito e certificação-alvo do usuário; resultado cacheado em `TrailStageExplain` para evitar re-geração
- feat(trails): API `/api/trails/[chainId]/stages/[stageId]/questions` — busca questões associadas a um estágio com cache Redis de 24 h (TTL 86 400 s)
- feat(trails): `TrailStudyFlow` — componente de fluxo de estudo por estágio: seleção de questões pendentes, confirmação e inicialização da sessão diretamente da tela de trilha

#### Cache
- feat(cache): chave `TRAIL_QUESTIONS` com TTL 86 400 s adicionada ao mapa de cache
- feat(cache): `cacheInvalidatePattern()` — invalidação por padrão via SCAN + DEL (evita `KEYS` em produção)
- feat(cache): `cacheGetOrSet()` — utilitário cache-aside: busca no Redis; se ausente, executa `fn()`, grava o resultado e retorna

#### Componentes UI Reutilizáveis
- feat(ui): `LoadingForScreens` — estado de loading com ícone retro animado e texto customizável
- feat(ui): `EmptyForScreens` — estado vazio com ilustração bounce e mensagem customizável
- feat(ui): `ErrorForScreens` — estado de erro padrão com callback de retry

#### Biblioteca (Phase 3+)
- feat(library): `ImageViewer` — visualizador interativo de imagens: zoom via scroll / botões (+25% por passo, clamp 0.5×–4×), arraste com pointer capture, duplo clique para reset; integrado à `LibraryItemScreen`

#### Admin — Simulados
- feat(admin): geração automática de packs de simulado via wizard 2 etapas: configuração de tamanho (padrão 65 questões), geração de artwork por IA (modelo Flux) e criação de narrativa de jornada com prompt customizável
- feat(admin): filtros avançados na tela de simulados — ordenação por múltiplos critérios, toggle ASC/DESC, controle de tamanho de página, alternância entre layout tabela e grade
- feat(admin): edição inline de narrativa por estágio — nome da etapa, texto da história e contexto AWS editáveis diretamente na listagem

#### Infraestrutura / Workspace
- feat(workspace): pacote `packages/db` centralizado — `prisma/schema.prisma` e todas as migrations unificados; `awlq-app` e `awlq-worker` agora consomem o schema a partir do pacote compartilhado
- feat(workspace): `packages/db/prisma.config.ts` — configuração Prisma centralizada para o monorepo

#### Seed
- feat(seed): `seed-mock-user.ts` — usuário mock pré-configurado para ambiente de desenvolvimento

### Database

- migration `20260605040000_add_trail_stage_explain` — tabela `TrailStageExplain` com `stageId` (FK), `content` (Markdown), índice em `stageId` para busca O(1)

---

## [2.0.0] — 2026-06-05

### Features

#### Retenção de Conhecimento (Phase 1)
- feat(retention): flashcards gerados automaticamente a partir de erros, flags de revisão e respostas lentas
- feat(retention): repetição espaçada SM-2 — intervalos adaptativos com compressão proporcional ao exame-alvo
- feat(retention): Daily Review — fila diária: flashcards pendentes + questões erradas recentes + serviços fracos
- feat(retention): Sprint Mode — sessões ultrarrápidas (3 min / 5 min / 5 questões / 10 questões) com XP e streak
- feat(retention): Memory Recovery — reapresenta conteúdos dominados há mais de 45 dias
- feat(retention): Intelligent Streak — incrementado apenas com estudo real (≥10 flashcards / ≥5 questões / 1 sprint / 1 daily review)
- feat(retention): Confidence-Based Learning — confiança por resposta; detecta e agrega "falsa crença" (errou + estava confiante)

#### Personalização (Phase 2)
- feat(mentor): AI Mentor "Mestre Yoda" — lista priorizada de ações baseada em áreas fracas, falsa crença, flashcards pendentes e certificação alvo
- feat(trails): Quest Chains / Trilhas — percursos de aprendizagem sequenciais com desbloqueio progressivo por estágio

#### Biblioteca de Conteúdo (Phase 3)
- feat(library): Biblioteca de Instrutores — PDFs (react-pdf inline), Markdown, Imagens, Slides com créditos de autores
- feat(library): surfacing contextual — conteúdo da biblioteca aparece automaticamente por área fraca / serviço / trilha

#### Engajamento (Phase 4)
- feat(arena): Arena de Batalha — boss battles temáticos (Guardião EC2, Oráculo IAM, Arquiteto S3)
- feat(arena): Weekly Challenge — desafio semanal global com ranking e badge exclusiva
- feat(arena): Daily Quiz — 5 questões diárias cross-cert (desbloqueado após certificação concluída)
- feat(news): Notícias — feeds RSS curados (AWS Blog, AWS Security, dev.to) via worker agendado
- feat(changelog): Changelog público com abas — releases do GitHub com curadoria admin e anotações

#### UX & Interface
- feat(home): HomeScreen reorganizada em 4 seções: Modos de Estudo · Retenção · Aventura e Desafios · Ferramentas
- feat(home): 9 novos cards de modo com ícones dedicados (Arena, Flashcards, Sprint, Daily Review, Trilhas, Biblioteca, Mentor)
- feat(admin): telas de admin Arena, Notícias, Changelog, Biblioteca e Trilhas refatoradas para padrão consistente (dark theme, pagination, refresh, filtros, edição inline)
- feat(mentor): persona "Mestre Yoda" com citações temáticas e avatar pixel art
- feat(news): Notícias e Changelog unificados em tela com abas
- feat(ux): novas telas do usuário (Arena, Trilhas, Flashcards, Sprint, Daily Review) com AppLayout, CSS vars e empty states informativos

#### Seed
- feat(seed): arena bosses pré-configurados (Guardião EC2, Oráculo IAM, Arquiteto S3)
- feat(seed): fontes de notícias pré-configuradas (AWS Blog, AWS Security, dev.to)
- feat(seed): trilhas de aprendizagem pré-configuradas (Fundamentos IAM, S3 do Básico ao Avançado)
- feat(seed): release v1.0.0 no changelog com 10 entradas de exemplo

### Bug Fixes

#### Segurança
- fix(security): score farming prevenido — Daily Quiz, Weekly Challenge e Arena Battle agora validam questionIds server-side
- fix(security): sprint não aceita mais `correct: boolean` do cliente — correção sempre computada server-side
- fix(security): victory gate no boss battle — rematches não geram XP duplicado
- fix(security): guards TOCTOU com `prisma.$transaction` em Daily Quiz e Weekly Challenge
- fix(security): SSRF prevenido em `feedUrl` e `artworkUrl` via `isAllowedFeedUrl` / `isAllowedArtworkUrl`
- fix(security): multi-select excluído de todos os pools de Phase 4 (Arena, Weekly, Sprint, Daily Quiz seeder)

#### LGPD / Privacidade
- fix(lgpd): direito de exclusão agora cobre todas as tabelas Phase 1-4 (Flashcard, FalseBeliefSignal, MentorRecommendation, BossBattle, WeeklyChallengeEntry, DailyQuizAttempt, UserBehaviorProfile, QuestChainProgress)
- fix(lgpd): exportação de dados agora inclui todas as tabelas Phase 1-4
- fix(lgpd): `FalseBeliefSignal` recebeu FK explícita com `onDelete: Cascade` (migration `20260605030000`)

#### Outros
- fix(news): API de notícias agora filtra por `source.active: true` — fontes desativadas não aparecem aos usuários
- fix(arena): `BattleStageScreen` usava `<a>` para navegação interna → substituído por `<Link>`
- fix(weekly): `openWeeklyChallenge` é agora idempotente (guarda contra `weekStart` duplicado)

### Tests
- test: 109 testes (era 85) — 24 novos testes cobrindo sprint scoring, arena victory gate, weekly challenge, exportação LGPD e exclusão LGPD
- test: TC-044 a TC-050 implementados para os fixes de Phase 4

### Chore
- chore(responsiveness): auditoria estática de responsividade — 9 telas verificadas em 375px / 768px / 1280px (CA-20)
- chore(docs): T4.6-Responsiveness-Audit.md, Test-Report-006-final.md, Security-Report-Phase4-v2.md, LGPD-Report-Phase4.md

### Breaking Changes
- feat!: KC usa worker dedicado `kc-generation` para preencher gaps on-demand; KC não gera mais questões inline em runtime

---

## [1.0.0] — 2026-06-03

### Features
- feat: plataforma base com Simulados, Knowledge Check e Labs gerados por IA
- feat: sistema de XP com pesos configuráveis por tipo de atividade
- feat: 6 níveis de progressão (Recruta → Lendário)
- feat: 12 conquistas automáticas com badges gerados via Pollinations API
- feat: Jornada de certificação com rastreamento de progresso
- feat: detecção automática de áreas fracas (correctRate < 60%)
- feat: self-feeding loop — geração contínua de questões via Gemini ponderada por domínios do blueprint
- feat: leaderboard em tempo real via Supabase Realtime
- feat: pipeline de ingestão de PDFs com deduplicação por SHA-256
- feat: painel administrativo completo (usuários, questões, workers, simulado maker)
