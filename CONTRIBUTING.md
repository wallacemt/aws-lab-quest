# Guia de Contribuição

Obrigado por considerar contribuir com o **AWS Lab Quest**! Este documento explica como participar do projeto, seja reportando bugs, sugerindo funcionalidades ou enviando código.

---

## Índice

- [Código de Conduta](#código-de-conduta)
- [Como posso contribuir?](#como-posso-contribuir)
- [Configuração do ambiente](#configuração-do-ambiente)
- [Fluxo de desenvolvimento](#fluxo-de-desenvolvimento)
- [Padrões de código](#padrões-de-código)
- [Pull Requests](#pull-requests)
- [Reportando Bugs](#reportando-bugs)
- [Sugerindo Funcionalidades](#sugerindo-funcionalidades)

---

## Código de Conduta

Ao participar deste projeto, você concorda em seguir nosso [Código de Conduta](CODE_OF_CONDUCT.md). Trate todos com respeito e crie um ambiente acolhedor.

---

## Como posso contribuir?

### Contribuições que aceitamos

- **Correção de bugs** — Qualquer issue marcado com `bug`
- **Melhorias de UX/UI** — Acessibilidade, responsividade, fluidez
- **Novas questões/certificações** — Adicionar suporte a outras certs AWS
- **Performance** — Otimizações de query, cache, bundle
- **Documentação** — Melhorar docs existentes ou adicionar novos exemplos
- **Testes** — Adicionar cobertura de testes unitários/integração
- **Internacionalização** — Suporte a outros idiomas (base já é PT-BR)

### O que requer discussão prévia

- Novas funcionalidades grandes (abrir uma issue `proposal` primeiro)
- Mudanças no schema do banco de dados
- Alterações na arquitetura do worker
- Mudanças de dependências principais

---

## Configuração do Ambiente

### Pré-requisitos

- Node.js 22+
- Docker + Docker Compose
- Chave da API Gemini (Google AI Studio)
- Projeto Supabase

### Passos

```bash
# 1. Fork o repositório e clone localmente
git clone https://github.com/SEU_USUARIO/aws-lab-quest.git
cd aws-lab-quest

# 2. Adicione o remote upstream
git remote add upstream https://github.com/REPOSITORIO_ORIGINAL/aws-lab-quest.git

# 3. Instale dependências em ambos os projetos
cd awlq-app && npm install
cd ../awlq-worker && npm install
cd ..

# 4. Configure as variáveis de ambiente
cp .env.example awlq-app/.env
cp .env.example awlq-worker/.env
# Edite os arquivos .env com suas credenciais

# 5. Suba a infraestrutura local
docker compose up -d postgres redis

# 6. Prepare o banco
cd awlq-app
npm run db:generate
npm run db:migrate
npm run db:seed
cd ..

# 7. Inicie os serviços em terminais separados
cd awlq-app && npm run dev        # http://localhost:3000
cd awlq-worker && npm run dev     # worker em background
```

---

## Fluxo de Desenvolvimento

### 1. Sincronize com o upstream

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

### 2. Crie uma branch descritiva

```bash
# Padrão: tipo/descricao-curta
git checkout -b fix/simulado-timer-overflow
git checkout -b feat/certificacao-cloud-practitioner
git checkout -b docs/atualizar-readme-worker
```

| Prefixo | Quando usar |
|---|---|
| `feat/` | Nova funcionalidade |
| `fix/` | Correção de bug |
| `docs/` | Apenas documentação |
| `refactor/` | Refatoração sem mudança de comportamento |
| `style/` | Formatação, lint, sem mudança de lógica |
| `test/` | Adição ou correção de testes |

### 3. Desenvolva e commit

```bash
git add -p                      # adicione com atenção, evite commits de arquivos sensíveis
git commit -m "fix: corrige overflow do timer no modo simulado"
```

Mensagens de commit seguem [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(escopo?): descrição curta em minúsculas

Corpo opcional explicando o "porquê" da mudança.

Refs: #123
```

Exemplos:
```
feat(simulado): adiciona modo foco com sidebar colapsável
fix(worker): corrige atualização do contador para trigger manual
docs: adiciona guia de setup no CONTRIBUTING
```

### 4. Antes de abrir o PR

```bash
# Checklist mínimo:
cd awlq-app

npm run lint               # zero erros de lint
npx tsc --noEmit           # zero erros TypeScript
npx next build             # build de produção sem erros
```

```bash
# No worker:
cd awlq-worker
npx tsc --noEmit           # zero erros TypeScript
```

### 5. Sincronize novamente antes de abrir o PR

```bash
git fetch upstream
git rebase upstream/main   # prefira rebase para histórico limpo
```

---

## Padrões de Código

### TypeScript

- **Sem `any` implícito** — Use tipos explícitos ou `unknown` + type guard
- **Nomes em inglês** — Variáveis, funções, tipos, arquivos
- **Conteúdo em PT-BR** — Strings visíveis ao usuário, mensagens de erro, labels
- **Funções pequenas** — Prefira composição a funções longas
- **Sem comentários óbvios** — Comente apenas o "porquê" não-óbvio

### React / Next.js

- Componentes de apresentação em `src/components/ui/`
- Lógica de domínio em `src/features/[dominio]/`
- Sem `useEffect` para dados que podem ser `useMemo`
- Sem chamadas de API diretas em componentes — use serviços em `src/features/*/services/`

### Banco de dados (Prisma)

- Toda migration deve ser acompanhada de um comentário no arquivo gerado
- Não altere migrations já aplicadas em produção — crie novas
- Novos campos opcionais devem ter `@default` definido

### Worker (BullMQ)

- Cada worker tem concorrência limitada (`concurrency: 1` para jobs que chamam AI)
- Jobs devem ser idempotentes quando possível
- Falhas silenciosas aceitáveis apenas para deduplicação (usageHash collision)
- Logar progresso em jobs longos com `logger.info`

---

## Pull Requests

### Template de PR

Ao abrir um PR, descreva:

```markdown
## O que foi feito
- Bullet points do que mudou

## Por que foi feito
- Motivação / issue relacionada

## Como testar
- Passo a passo para validar a mudança

## Checklist
- [ ] lint e TypeScript sem erros
- [ ] build de produção passou
- [ ] testei manualmente o fluxo afetado
- [ ] documentação atualizada (se aplicável)
```

### Critérios de aceite

- PR foca em **uma** mudança coesa (sem commits não relacionados)
- Sem arquivos de ambiente (`.env`, `.env.local`) commitados
- Sem `console.log` de debug esquecidos
- Sem dependências novas sem justificativa clara
- Screenshots ou vídeo para mudanças visuais

---

## Reportando Bugs

Abra uma [issue](../../issues/new?template=bug_report.md) com:

- **Versão** do Node.js e sistema operacional
- **Passos para reproduzir** (numerados)
- **Comportamento esperado** vs **comportamento atual**
- **Logs de erro** (console do browser ou terminal)
- **Screenshot** se o bug for visual

### Bugs de Segurança

**Não abra uma issue pública para vulnerabilidades de segurança.** Envie um email diretamente para o mantenedor ou use a aba "Security" do GitHub (Advisories).

---

## Sugerindo Funcionalidades

Abra uma [issue](../../issues/new?template=feature_request.md) com o template `proposal`:

- **Problema que resolve** — Qual dor ou oportunidade motiva a funcionalidade?
- **Solução proposta** — Como você imagina a implementação?
- **Alternativas consideradas** — O que mais você avaliou?
- **Escopo estimado** — É uma mudança pequena, média ou grande?

Funcionalidades grandes passam por discussão antes de serem aceitas para desenvolvimento.

---

## Dúvidas?

Abra uma [Discussion](../../discussions) no GitHub ou entre em contato pelos canais do projeto.

---

Agradecemos cada contribuição, seja uma linha de código, um bug reportado ou uma sugestão de melhoria. **Bora construir juntos!**
