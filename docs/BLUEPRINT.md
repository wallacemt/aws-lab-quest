# AWS Lab Quest — Blueprint de Implementação

## Metadata
- Projeto:           AWS Lab Quest
- Data:              2026-06-30
- Arquiteto:         Morpheus Agent
- Versão Blueprint:  v1
- Status:            Draft (aguardando aprovação)
- Origem:            `lab-gamification/taks.md`

> ⚠️ **Convenção de implementação**: toda task deve ser feita em **branch de feature separada**, com PR contra `main` e review obrigatório. **Nunca commitar direto na `main`.**

---

## Notas Arquiteturais (descobertas na fase de Discovery)

Fatos verificados no código que condicionam o Blueprint:

1. **Monorepo / schema compartilhado** — o `schema.prisma` vive em `packages/db/prisma/schema.prisma` (não em `awlq-app/prisma/` como diz o CLAUDE.md). Toda alteração de modelo é feita lá e propagada via `prisma generate` para app e worker.
2. **Gaps não têm entidade própria** — são JSON em `WeakAreaReport.weakAreas`. O contador de remoção de gap (EPIC-03) exige **novo modelo** (`UserGapProgress` ou similar).
3. **Sprint não persiste sessão** — não há modelo de Sprint; o estado é client-side. Os bugs de XP/revisão (EPIC-06) provavelmente exigem persistir a sessão.
4. **Flashcards** já suportam criação do usuário + SM-2 (`Flashcard`, `FlashcardReview`), mas **sem lembrete por e-mail** e o enum `FlashcardSource` não tem `USER_CREATED`.
5. **Boss** (`Boss.maxHp`, `Boss.damagePerCorrect`) é dano fixo — escalonamento por questão e stack de dano (EPIC-07) são lógica de app/worker.
6. **Padrões reutilizáveis já existentes** (princípio: reusar antes de criar):
   - UI de questões do **Simulado** → reusar em Sprint, Trilhas, Arena.
   - **Lock de simulado** (app bloqueado durante prova) → reusar na Arena.
   - **Animação de confete** do simulado → reusar em Sprint e Arena.
   - Padrão `Drawer` (shadcn) → reusar no chat de revisão.
   - Filas BullMQ via `WorkerTrigger` ou push direto → reusar para geração de questões on-demand (KC) e imagens (Trilhas).

---

## Épicos

### EPIC-01 — Biblioteca (Library)
- **Módulo / label**: `library`
- **Branch base**: `fix/library-improvements`
- **Objetivo de negócio**: a biblioteca é a porta de entrada para o conteúdo de estudo. Um PDF que quebra no console e a falta de preview/fullscreen criam atrito e fazem o usuário abandonar o material.
- **Arquivos-chave**: `src/app/(app)/biblioteca/`, `src/features/library/`, `src/app/(admin)/admin/biblioteca/`, modelo `LibraryContent`.

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-01.1 | Renderizar PDF via webview nativa do navegador (remover pdf.js) | fix | S |
| FEAT-01.2 | Preview das mídias na listagem da biblioteca | feat | M |
| FEAT-01.3 | Fullscreen ao visualizar imagens | feat | S |
| FEAT-01.4 | Modal simplificado de criação/edição de conteúdo (admin) com preview | feat | M |

**FEAT-01.1 — PDF via webview nativa**
- Descrição: o erro `No "GlobalWorkerOptions.workerSrc" specified` vem do pdf.js sem worker configurado. Em vez de configurar o worker, **eliminar a dependência**: renderizar o PDF com o visor nativo do navegador via `<iframe src={pdfUrl}>` ou `<object type="application/pdf">`. O `LibraryContent` já guarda a URL no Supabase Storage; basta apontar o iframe para ela. Remover o import/uso de `react-pdf`/`pdfjs-dist` do componente de visualização.
- Critérios de aceite:
  - AC: abrir um PDF na biblioteca não gera erro no console.
  - AC: o PDF é renderizado e navegável (scroll/zoom nativos).
  - AC: a dependência pdf.js não é mais importada nesse fluxo (verificar bundle).
- Dependências: nenhuma.

**FEAT-01.2 — Preview de mídias na listagem**
- Descrição: na grid de conteúdos, exibir miniatura conforme o tipo: imagem → thumbnail; PDF → primeira página ou ícone+nome; vídeo → poster/thumbnail. Usar o `contentType`/`mimeType` de `LibraryContent`. Para PDF, opção lazy: ícone + título (não renderizar a primeira página no servidor a menos que necessário). `// ponytail: thumbnail simples por tipo; gerar 1ª página de PDF só se houver demanda real`.
- Critérios de aceite:
  - AC: cada card mostra um preview coerente com o tipo de mídia.
  - AC: imagens carregam com lazy-loading.
- Dependências: nenhuma.

**FEAT-01.3 — Fullscreen de imagens**
- Descrição: no visualizador de imagem, adicionar botão de fullscreen usando a Fullscreen API nativa (`element.requestFullscreen()`) ou um lightbox simples. Preferir API nativa — zero dependência.
- Critérios de aceite:
  - AC: botão de fullscreen visível ao abrir imagem.
  - AC: entra/sai de fullscreen; ESC fecha.
- Dependências: nenhuma.

**FEAT-01.4 — Modal de criação/edição (admin) com preview**
- Descrição: substituir/simplificar o formulário atual de conteúdo por um modal (shadcn `Dialog`) com layout enxuto. Antes de enviar, mostrar preview da mídia selecionada (imagem/PDF/vídeo) a partir do `File` local via `URL.createObjectURL`. Rota envolvida: `src/app/api/admin/library/[contentId]/upload/route.ts`.
- Critérios de aceite:
  - AC: criar e editar conteúdo via modal.
  - AC: preview da mídia aparece antes do upload.
  - AC: validação de tipo/tamanho de arquivo mantida.
- Dependências: nenhuma.

---

### EPIC-02 — KC (Knowledge Check) — Refatoração em Steps
- **Módulo / label**: `kc`
- **Branch base**: `feat/kc-step-flow`
- **Objetivo de negócio**: o KC é o principal exercício adaptativo. Um fluxo em passos (quantidade → serviços → resumo) torna a montagem intuitiva e a seleção de dificuldade baseada em gaps aumenta o valor pedagógico.
- **Arquivos-chave**: `src/app/(app)/kc/`, `src/features/study/`, fila `kcGenerationQueue` (worker), `WeakAreaReport`.

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-02.1 | Fluxo em steps (quantidade → serviços → resumo → iniciar) | refactor | L |
| FEAT-02.2 | Seleção de dificuldade por gap (gap → mais difícil; senão equilibrado priorizando difíceis) | feat | M |
| FEAT-02.3 | Geração on-demand via worker com prioridade máxima quando faltam questões | feat | M |

**FEAT-02.1 — Fluxo em steps**
- Descrição: refatorar a tela de KC para um wizard de 3 passos. Step 1: selecionar a quantidade de questões. Step 2: selecionar serviços AWS (limitado/coerente com a quantidade do step 1). Step 3: resumo (serviços, quantidade, dificuldade estimada) + botão "Iniciar". Estado do wizard local (componente ou `questStore`).
- Critérios de aceite:
  - AC: usuário avança/volta entre os 3 steps.
  - AC: não é possível iniciar sem quantidade e ao menos 1 serviço.
  - AC: o resumo reflete as escolhas.
- Dependências: nenhuma.

**FEAT-02.2 — Dificuldade por gap**
- Descrição: ao montar o set, consultar gaps do usuário (`WeakAreaReport.weakAreas` / `UserGapProgress` de EPIC-03 se já existir). Para serviço com gap priorizado → selecionar questões de **maior dificuldade**. Para serviço sem gap → distribuição **equilibrada, sempre priorizando as mais difíceis**. A dificuldade vem dos campos de dificuldade/discriminação já calculados em `StudyQuestion` (`performance-compute`).
- Critérios de aceite:
  - AC: serviço com gap retorna predominância de questões difíceis.
  - AC: serviço sem gap retorna mix priorizando difíceis.
- Dependências: leitura de gaps (idealmente após EPIC-03 FEAT-03.2, mas funciona com `WeakAreaReport` atual).

**FEAT-02.3 — Geração on-demand com prioridade**
- Descrição: se o pool de questões do(s) serviço(s) for insuficiente para a quantidade pedida, enfileirar job em `kcGenerationQueue`/`questionGenerationQueue` com **prioridade máxima** (BullMQ `priority: 1`) e exibir loading temático: "Chamando o mestre da AWS para checar as questões". Fazer polling do status até as questões existirem (ou timeout com fallback "quantidade reduzida").
- Critérios de aceite:
  - AC: quantidade > pool disponível dispara geração priorizada.
  - AC: usuário vê a mensagem de loading durante a geração.
  - AC: ao concluir, o KC inicia com as questões geradas; em timeout, inicia com as disponíveis e avisa.
- Dependências: nenhuma (filas já existem).

---

### EPIC-03 — Revisão
- **Módulo / label**: `revisao`
- **Branch base**: `feat/revisao-rework`
- **Objetivo de negócio**: a revisão é onde o usuário ataca seus pontos fracos. Hoje é simples demais. Tornar acionável (ver questões erradas + chat com IA especialista + atalho para KC) e dar um mecanismo real de **remoção de gap** fecha o loop de aprendizado.
- **Arquivos-chave**: `src/app/(app)/revisao/`, `src/lib/ai.ts`, `WeakAreaReport`, `StudySessionHistory`, `QuestChain` (para links de trilha).

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-03.1 | Tela de serviço com gap: questões erradas + alternativas explicadas + chat IA (Drawer/RAG simples) + botão "KC sobre \<assunto\>" | feat | XL |
| FEAT-03.2 | Lógica de remoção de gap por contador (10 acertos seguidos remove; erro zera) + monitor na tela | feat | L |
| FEAT-03.3 | Links para trilhas relacionadas ao serviço do gap | feat | S |

**FEAT-03.1 — Detalhe do gap com chat IA**
- Descrição: ao clicar num serviço com gap priorizado, abrir tela dedicada. Layout `[PERGUNTAS | CHAT]` com o chat em `Drawer` (shadcn) abrível/fechável. Lista as questões que o usuário **errou** naquele serviço (de `StudySessionHistory`) com alternativas certas/erradas e explicação detalhada. O chat usa "RAG simples": o contexto injetado é **apenas** a questão atual + o serviço (não a base toda) — o prompt do sistema transforma o Gemini em "especialista naquele assunto". Botão em destaque "Fazer KC sobre \<assunto\>" que entra direto no fluxo de KC pré-filtrado por aquele serviço.
- Critérios de aceite:
  - AC: clicar num gap abre a tela específica.
  - AC: questões erradas listadas com explicação das alternativas.
  - AC: chat Drawer abre/fecha e responde com contexto limitado à questão+serviço.
  - AC: botão "KC sobre X" inicia KC filtrado por aquele serviço.
- Dependências: integra com EPIC-02 (botão → fluxo KC). Marcar para revisão do **Lawliet Agent**: o chat IA recebe input do usuário (prompt injection / sanitização de contexto).

**FEAT-03.2 — Contador de remoção de gap**
- Descrição: criar modelo `UserGapProgress` (novo) — `userId`, `awsServiceId`/`topic`, `consecutiveCorrect` (default 0), `cleared` (Bool), `updatedAt`. Em cada resposta de questão daquele serviço: acerto → incrementa; ao atingir 10 → marca `cleared` e remove o gap; erro → zera o contador. Exibir o contador (ex: 6/10) na tela de revisão.
- Schema ilustrativo `// ILUSTRATIVO — referência para Neo Agent`:
  ```prisma
  model UserGapProgress {
    id                 String   @id @default(cuid())
    userId             String
    user               User     @relation(fields:[userId], references:[id], onDelete: Cascade)
    awsServiceId       String?
    topic              String?
    consecutiveCorrect Int      @default(0)
    cleared            Boolean  @default(false)
    updatedAt          DateTime @updatedAt
    @@unique([userId, awsServiceId, topic])
    @@index([userId, cleared])
  }
  ```
- Critérios de aceite:
  - AC: 10 acertos seguidos no serviço removem o gap.
  - AC: 1 erro zera o contador.
  - AC: contador visível e atualizado na tela de revisão.
- Dependências: schema em `packages/db`; alimenta EPIC-02 FEAT-02.2.

**FEAT-03.3 — Links para trilhas relacionadas**
- Descrição: na tela de revisão do serviço, listar `QuestChain`/trilhas cujo tema se relaciona ao serviço do gap (match por serviço/tópico). Cada link leva à trilha.
- Critérios de aceite:
  - AC: trilhas relacionadas ao serviço aparecem com link funcional.
  - AC: se não houver trilha relacionada, a seção é omitida.
- Dependências: nenhuma.

---

### EPIC-04 — Flashcards
- **Módulo / label**: `flashcards`
- **Branch base**: `feat/flashcards-user-content`
- **Objetivo de negócio**: flashcards próprios + lembretes por e-mail aumentam retenção e re-engajamento. Decks padrão dos serviços-chave dão valor imediato a quem está começando.
- **Arquivos-chave**: `src/app/(app)/flashcards/`, `Flashcard`/`FlashcardReview`, `emailSendQueue`/`behavioralEmailQueue`, `prisma/seed.ts`.

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-04.1 | Usuário cria seus próprios flashcards + lembretes por e-mail | feat | L |
| FEAT-04.2 | Flashcards default dos principais serviços AWS (s3, ec2, rds, ...) via seed | feat | M |

**FEAT-04.1 — Flashcards do usuário + lembretes**
- Descrição: CRUD de flashcards criados pelo usuário (reusar `Flashcard`; adicionar `USER_CREATED` ao enum `FlashcardSource`). Lembretes por e-mail: enfileirar via `emailSendQueue`, agendados pelo `dueAt` do SM-2 (ou cron do `scheduler.ts` que varre cards vencidos e dispara e-mail). Respeitar preferências/consentimento de e-mail já existentes (retention/LGPD).
- Critérios de aceite:
  - AC: usuário cria/edita/exclui flashcards próprios.
  - AC: card próprio entra no agendamento SM-2.
  - AC: e-mail de lembrete é enviado para cards vencidos (respeitando opt-in).
- Dependências: schema (enum) em `packages/db`. Coordenar com módulo retention/LGPD para consentimento de e-mail.

**FEAT-04.2 — Decks default**
- Descrição: criar flashcards padrão para os principais serviços AWS (S3, EC2, RDS, VPC, IAM, Lambda, etc.) via `prisma/seed.ts`, com `source` apropriado (default/sistema). Disponibilizar como deck "oficial" que o usuário pode estudar sem criar nada.
- Critérios de aceite:
  - AC: seed cria os decks default dos serviços-chave.
  - AC: usuário novo já vê os decks default disponíveis.
- Dependências: nenhuma.

---

### EPIC-05 — (removido — consolidado em EPIC-09) Revisão Diária
> Ver **EPIC-09** (Revisão Diária — Remoção). Mantido como épico separado por ser uma remoção, não uma feature.

---

### EPIC-06 — Sprint Mode
- **Módulo / label**: `sprint`
- **Branch base**: `fix/sprint-mode-rework`
- **Objetivo de negócio**: o Sprint é o modo de prática rápida. Reusar a UI consagrada do simulado, corrigir bugs de XP/revisão e adicionar feedback de conclusão (confete + parabéns) eleva a sensação de progresso.
- **Arquivos-chave**: `src/app/(app)/sprint/`, UI de questões do simulado, `simulatedExamStore`, lógica de XP (`xp-weights.ts`).

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-06.1 | Reusar interface de questões do simulado (central + lista lateral) | refactor | M |
| FEAT-06.2 | Hub de modos: "por questões" / "por minuto" + opções (até 10 min, até 25 questões) | feat | M |
| FEAT-06.3 | Corrigir bugs: revisão pós-término não exibe questões, XP não contabilizado; reusar confete + parabéns | fix | L |

**FEAT-06.1 — Reusar UI do simulado**
- Descrição: extrair/usar o componente de questões do simulado (questão central + navegação lateral de questões) no Sprint. Não duplicar — reusar o componente existente.
- Critérios de aceite:
  - AC: Sprint usa o mesmo componente de questão do simulado.
  - AC: navegação lateral funcional no Sprint.
- Dependências: nenhuma.

**FEAT-06.2 — Hub de modos**
- Descrição: tela de escolha separando "por questões" e "por minuto", com opções configuráveis até o teto (10 min / 25 questões).
- Critérios de aceite:
  - AC: dois modos selecionáveis com seus limites.
  - AC: limites respeitados (máx 10 min, máx 25 questões).
- Dependências: nenhuma.

**FEAT-06.3 — Bugfixes + feedback de conclusão**
- Descrição: investigar root cause de (a) não exibir questões para revisão ao finalizar e (b) XP não creditado. Provável causa: ausência de persistência da sessão de Sprint. Se confirmado, **persistir a sessão** (reusar `StudySessionHistory` se aplicável, ou novo modelo `SprintSession` apenas se necessário — `// ponytail: só criar modelo novo se StudySessionHistory não cobrir`). Reusar a animação de confete do simulado e tela de parabéns ao concluir.
- Critérios de aceite:
  - AC: ao finalizar, as questões respondidas ficam disponíveis para revisão.
  - AC: XP é creditado corretamente na conta.
  - AC: confete + mensagem de parabéns ao concluir.
- Dependências: pode depender de FEAT-06.1 (UI compartilhada). Marcar a contabilização de XP para verificação de QA (Agent Smith).

---

### EPIC-07 — Arena de Batalha
- **Módulo / label**: `arena`
- **Branch base**: `feat/arena-pokemon-rework`
- **Objetivo de negócio**: a Arena é o gancho de gamificação mais forte. Um combate estilo Pokémon (HP, ataques, dano escalonado, vitória/derrota com efeitos) transforma estudo em jogo e aumenta retenção.
- **Arquivos-chave**: `src/app/(app)/arena/`, `src/features/arena/`, `Boss`/`BossBattle`, lock de simulado, confete.

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-07.1 | Lock do app durante a batalha (reusar lock do simulado) | feat | S |
| FEAT-07.2 | Redesign da página estilo combate Pokémon (Hero+HP / título / enunciado / 4 ações) | refactor | L |
| FEAT-07.3 | Questões compatíveis com HP do boss e dano por questão | feat | M |
| FEAT-07.4 | Dano dobra a cada 2 acertos seguidos (stack de dano) | feat | M |
| FEAT-07.5 | Efeitos de vitória (fogos + som) e derrota (tons sombrios + som) | feat | M |

**FEAT-07.1 — Lock durante batalha**
- Descrição: reusar o mecanismo de lock do simulado (app bloqueado até finalizar) na Arena. Ao iniciar a batalha, bloquear navegação até concluir/abandonar.
- Critérios de aceite:
  - AC: durante a batalha o usuário não navega para fora.
  - AC: ao finalizar, o app é desbloqueado.
- Dependências: nenhuma.

**FEAT-07.2 — Redesign Pokémon**
- Descrição: layout: bloco superior Hero (imagem do boss + barra de HP) → título/nome → enunciado da questão → 4 opções como "ataques". Acerto → animação de ataque ao boss; erro → animação sombria (boss ganhando).
- Critérios de aceite:
  - AC: layout segue o wireframe (Hero+HP / nome / enunciado / 4 ações).
  - AC: acerto dispara animação de ataque; erro dispara animação sombria.
- Dependências: nenhuma.

**FEAT-07.3 — Questões compatíveis com HP/dano**
- Descrição: ajustar o número de questões da batalha conforme `Boss.maxHp` e `damagePerCorrect` (HP / dano ≈ nº de acertos necessários). Garantir pool suficiente; se faltar, enfileirar geração (reuso de EPIC-02 FEAT-02.3).
- Critérios de aceite:
  - AC: quantidade de questões coerente com maxHp/damagePerCorrect.
  - AC: derrotar o boss requer o nº esperado de acertos.
- Dependências: opcionalmente reusa geração on-demand (EPIC-02).

**FEAT-07.4 — Stack de dano**
- Descrição: dano dobra a cada 2 acertos consecutivos, acumulando até finalizar o boss (erro reseta o multiplicador). Lógica em `BossBattle` (estado de `remainingHp` + multiplicador corrente, server-side para evitar trapaça).
- Critérios de aceite:
  - AC: 2 acertos seguidos dobram o dano; mantém o stack enquanto acerta.
  - AC: erro reseta o multiplicador.
- Dependências: FEAT-07.3.

**FEAT-07.5 — Efeitos de vitória/derrota**
- Descrição: vitória → fogos (reusar confete) + som de vitória. Derrota → tons sombrios + som de derrota (boss venceu).
- Critérios de aceite:
  - AC: vitória mostra fogos e toca som de vitória.
  - AC: derrota mostra efeito sombrio e toca som de derrota.
- Dependências: nenhuma.

---

### EPIC-08 — Trilhas (Quest Chains)
- **Módulo / label**: `trilhas`
- **Branch base**: `feat/trilhas-improvements`
- **Objetivo de negócio**: trilhas são o conteúdo guiado de longo prazo. Conteúdo melhor revisado, MD legível, ilustrações e UX de loading aumentam conclusão; padronizar a UI de questões e corrigir o "rever" vazio remove frustração.
- **Arquivos-chave**: `src/app/(app)/trilhas/`, `src/features/trails/`, `QuestChain`/`QuestChainStage`/`TrailStageExplain`, worker de geração, `lib/storage.ts`.

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-08.1 | Pós-processamento de revisão para enriquecer dados da trilha | feat | L |
| FEAT-08.2 | Melhorar render de MD (largura limitada, legibilidade) | feat | S |
| FEAT-08.3 | Geração de imagens de ilustração relevantes | feat | M |
| FEAT-08.4 | Mensagens durante loadings | feat | S |
| FEAT-08.5 | Padronizar UI de questões pós-trilha (reusar simulado) | refactor | M |
| FEAT-08.6 | Bug: "rever" após reprovar não exibe nada | fix | M |

**FEAT-08.1 — Pós-processamento de revisão**
- Descrição: etapa de revisão (no worker) que reprocessa/melhora o conteúdo gerado das trilhas (`TrailStageExplain`) — clareza, completude, correção. Reusar padrão do `quality-review.worker`.
- Critérios de aceite:
  - AC: conteúdo de trilha passa por revisão automática antes de publicado.
- Dependências: nenhuma.

**FEAT-08.2 — MD legível**
- Descrição: aplicar largura máxima de leitura (ex: `max-w-prose`), tipografia e espaçamento ao MD renderizado das trilhas.
- Critérios de aceite:
  - AC: conteúdo MD tem largura limitada e legível.
- Dependências: nenhuma.

**FEAT-08.3 — Imagens de ilustração**
- Descrição: gerar imagens relevantes por estágio/tema (reusar o padrão Pollinations já usado para badges; armazenar no Supabase via `lib/storage.ts`). Enfileirar geração no worker.
- Critérios de aceite:
  - AC: estágios exibem ilustração relevante.
  - AC: imagens persistidas no storage e reaproveitadas (sem regerar a cada acesso).
- Dependências: nenhuma.

**FEAT-08.4 — Mensagens de loading**
- Descrição: mensagens temáticas durante carregamentos/gerações da trilha.
- Critérios de aceite:
  - AC: loadings exibem mensagens contextuais.
- Dependências: nenhuma.

**FEAT-08.5 — UI de questões padronizada**
- Descrição: usar a mesma UI de questões do simulado na avaliação pós-trilha.
- Critérios de aceite:
  - AC: questões da trilha usam o componente do simulado.
- Dependências: compartilha o componente com EPIC-06.

**FEAT-08.6 — Bug "rever" vazio**
- Descrição: root cause do "rever" vazio após reprovar. Provável: as respostas/questões da tentativa não são persistidas ou não são recuperadas no fluxo de "rever". Corrigir na fonte (persistência da tentativa) para não tratar só o sintoma da tela.
- Critérios de aceite:
  - AC: após reprovar e clicar em "rever", as questões e respostas da tentativa aparecem.
- Dependências: relacionado a FEAT-08.5. Marcar para QA (Agent Smith).

---

### EPIC-09 — Revisão Diária (Remoção)
- **Módulo / label**: `revisao`
- **Branch base**: `refactor/remove-daily-review`
- **Objetivo de negócio**: a tela de Revisão Diária duplica o que a Revisão (EPIC-03) fará automaticamente. Remover reduz confusão e superfície de manutenção.
- **Arquivos-chave**: `src/app/(app)/daily-review/`, `src/app/api/retention/daily-review/` (+ `/complete`), `src/features/retention/` (DailyReview*), `src/features/utils/home-apps.ts`.

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-09.1 | Remover tela Revisão Diária e todas as referências | refactor | M |

**FEAT-09.1 — Remoção da Revisão Diária**
- Descrição: remover a página `daily-review`, as rotas de API `retention/daily-review` e `retention/daily-review/complete`, os componentes/hooks/screens `DailyReview*` em `features/retention`, e o card em `home-apps.ts`. Verificar que nenhum outro fluxo (e-mails de retention, navegação, links) referencia daily-review antes de remover. **Fazer depois de EPIC-03 estar funcional** para não deixar lacuna funcional.
- Critérios de aceite:
  - AC: nenhuma referência a daily-review/dailyReview/revisao-diaria permanece (grep limpo).
  - AC: app builda e navega sem links quebrados.
  - AC: a função antes coberta pela Revisão Diária está coberta pela Revisão (EPIC-03).
- Dependências: **EPIC-03** (a Revisão precisa cobrir o caso automaticamente antes de remover).

---

### EPIC-10 — Mentor IA
- **Módulo / label**: `mentor-ia`
- **Branch base**: `feat/mentor-daily-limit`
- **Objetivo de negócio**: limitar o Mentor IA a 1 pergunta/dia controla custo de API e cria um hábito de uso intencional.
- **Arquivos-chave**: `src/app/(app)/mentor/`, `src/features/mentor/`, `MentorRecommendation`, `lib/ai.ts`.

| ID | Título | Tipo | Complexidade |
|----|--------|------|------|
| FEAT-10.1 | Limite de 1 pergunta ao Mentor IA por dia | feat | S |

**FEAT-10.1 — Limite diário do Mentor**
- Descrição: permitir apenas 1 pergunta/dia por usuário. Verificar server-side (na rota de API do mentor) por timestamp da última pergunta do usuário (campo/registro) — bloquear a 2ª e informar quando reabre. **A checagem precisa ser server-side** (não confiar no client). `// ponytail: rastrear última pergunta por timestamp; reusar tabela existente se houver, senão 1 campo novo`.
- Critérios de aceite:
  - AC: 1ª pergunta do dia é respondida.
  - AC: 2ª pergunta no mesmo dia é bloqueada com mensagem de quando reabre.
  - AC: o limite é validado no servidor.
- Dependências: nenhuma. Marcar para QA (rate-limit) e potencialmente Lawliet (bypass do limite).

---

## Ordem de Implementação Recomendada

Justificativa por dependências, valor e reuso:

1. **EPIC-01 (Biblioteca)** — quick wins independentes (bug PDF, previews, fullscreen). Baixo risco, valor imediato.
2. **EPIC-10 (Mentor — limite diário)** — pequeno, isolado, controla custo de API desde já.
3. **EPIC-06 (Sprint) FEAT-06.1** primeiro — extrai a **UI de questões compartilhada** do simulado, que EPIC-07 e EPIC-08 reusam. Depois FEAT-06.2/06.3.
4. **EPIC-04 (Flashcards)** — independente; entrega valor (decks default + criação + lembretes).
5. **EPIC-03 (Revisão)** — núcleo pedagógico; FEAT-03.2 (contador de gap) habilita melhor a dificuldade do KC.
6. **EPIC-02 (KC steps)** — usa o contador de gap de EPIC-03 e o padrão de geração on-demand reusado depois pela Arena.
7. **EPIC-07 (Arena)** — reusa lock + confete + UI de questão + geração on-demand já prontos.
8. **EPIC-08 (Trilhas)** — reusa UI de questão; bug "rever" e enriquecimento de conteúdo.
9. **EPIC-09 (Remover Revisão Diária)** — **por último**, só após EPIC-03 cobrir a função, para não deixar lacuna.

> Princípio: construir os **componentes compartilhados primeiro** (UI de questão, lock, confete, geração on-demand) e reusá-los nos épicos seguintes — evita duplicação.

---

## Estratégia de Branches

- **Uma branch por épico**: `feat/<slug>` ou `fix/<slug>` / `refactor/<slug>` (slugs sugeridos em cada épico).
- Tasks grandes (XL/L) podem ter sub-branches mergeadas na branch do épico antes do PR final.
- **PR contra `main`** com review obrigatório. Nada direto na `main`.
- Alterações de schema (`UserGapProgress`, enum `USER_CREATED`, etc.) são feitas em `packages/db/prisma/schema.prisma` + migração, e `prisma generate` rodado para app **e** worker.

---

## Itens para Revisão de Segurança (Lawliet Agent)
- **FEAT-03.1** — chat IA com input do usuário (prompt injection, vazamento de contexto).
- **FEAT-10.1** — bypass do rate-limit diário (deve ser server-side).
- **FEAT-04.1** — lembretes por e-mail (consentimento/LGPD, não vazar dados).

## Itens para QA (Agent Smith)
- **FEAT-06.3** — XP creditado corretamente; revisão pós-término.
- **FEAT-08.6** — bug "rever" vazio.
- **FEAT-07.4** — lógica de stack de dano (server-side, anti-trapaça).
- **FEAT-10.1** — limite diário.

## Fora de Escopo (deste Blueprint)
- Mudanças de infraestrutura/deploy.
- Reescrita do pipeline self-feeding além do necessário às features acima.
- Novas certificações além das já suportadas.

## Riscos e Questões em Aberto
- **R-01**: persistência de sessão de Sprint — confirmar se `StudySessionHistory` cobre ou se exige novo modelo (FEAT-06.3).
- **R-02**: "RAG simples" do chat de revisão — definir exatamente o que entra no contexto (apenas questão+serviço) para controlar custo/segurança.
- **R-03**: geração de imagens de trilha (Pollinations) — custo/latência; cachear no storage é obrigatório.
- **R-04**: remoção da Revisão Diária pode estar acoplada a e-mails de retention — auditar antes (EPIC-09).

---

## Handoff
- Artefato gerado:   `aws-lab-quest/BLUEPRINT.md`
- Status:            Aguardando aprovação
- Próximo agente:    Neo Agent (implementação), por épico/branch
- Ação requerida:    Revisar e aprovar o Blueprint. Após aprovação, criar as issues no GitHub (Fase 2) e iniciar pela ordem recomendada.
- Observações:       Schema vive em `packages/db` (CLAUDE.md desatualizado). Itens de segurança → Lawliet; itens de QA → Agent Smith.
