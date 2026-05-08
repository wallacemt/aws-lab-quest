# Refactor do pipeline de ingestao de questoes v2 (pt-BR)

Data: 31/03/2026

Este documento registra o refactor completo do pipeline de ingestao de questoes para certificacoes AWS.

## Escopo da entrega

- Reestruturacao do fluxo admin para ingestao em pagina unica.
- Pipeline deterministico de extracao, parsing e persistencia.
- Remocao de OCR no caminho de ingestao.
- Remocao de parsing por chunk cego.
- Deduplicacao por usageHash.
- Persistencia em modelos normalizados.
- Remocao do ultimo uso ativo de geracao legada em runtime (KC/Simulado).

## Objetivos atendidos

1. Extrair questoes de PDF e Markdown.
2. Detectar blocos completos antes de IA.
3. Processar uma chamada de IA por bloco.
4. Validar payload e descartar incompletos.
5. Persistir com integridade relacional e dedupe.
6. Exibir preview final ao admin.

## Mudancas de codigo (resumo)

### Backend

- Novo modulo de pipeline:
  - src/lib/question-ingestion-pipeline.ts

- Novas capacidades:
  - extractTextFromFile
  - normalizeText
  - detectQuestionBlocks
  - parseQuestionWithLLM
  - validateQuestion
  - ingestQuestions

- Rotas admin atualizadas:
  - src/app/api/admin/pdf/ingest/route.ts
  - src/app/api/admin/pdf/extract/route.ts
  - src/app/api/admin/pdf/exam-guide/route.ts

- OCR removido de componentes ativos:
  - src/features/admin/services/pdf-extraction.ts
  - src/lib/ai.ts
  - src/utils/prompt.utils.ts

- Runtime de estudo sem auto-geracao:
  - src/app/api/study/kc/questions/route.ts
  - src/app/api/study/simulado/questions/route.ts

- Modulo legado removido:
  - src/lib/study-question-generation.ts

### Frontend

- Fluxo unico no admin upload:
  - src/features/admin/screens/AdminPdfUploadScreen.tsx
  - src/features/admin/hooks/useAdminPdfUpload.ts

- Contrato de resposta ampliado:
  - src/features/admin/types.ts

### Banco de dados

- Schema atualizado:
  - prisma/schema.prisma

- Estruturas introduzidas:
  - QuestionOption
  - Topic
  - QuestionAwsService
  - QuestionTopic
  - StudyQuestion.rawText
  - StudyQuestion.ingestionVersion
  - StudyQuestion.usageHash

- Migration criada:
  - prisma/migrations/20260331193000_question_ingestion_normalized/migration.sql

## Contrato funcional do novo pipeline

Entrada:

- certificationCode
- files[] (PDF/MD)

Fluxo:

1. Upload dos arquivos.
2. Extracao de texto bruto.
3. Normalizacao de texto.
4. Deteccao de blocos de questao.
5. Validacao minima de bloco.
6. Parsing com IA (uma chamada por bloco).
7. Validacao de payload.
8. Persistencia transacional.
9. Retorno de preview e rejeicoes.

Saida:

- generatedCount
- savedCount
- duplicateCount
- rejectedCount
- extractedQuestions
- rejects

## Regras de validacao

A questao e rejeitada quando:

- statement ausente ou curto;
- menos de 2 alternativas;
- nenhuma alternativa correta;
- alternativas duplicadas;
- alternativa curta demais.

## Impactos operacionais

- O abastecimento do banco de questoes deve ser feito via upload admin.
- KC e Simulado nao geram mais questoes no momento da requisicao.
- Se o pool estiver insuficiente, as rotas retornam erro explicito.

## Riscos e mitigacoes

Risco:

- fontes com texto ruim ou sem padrao de numeracao.

Mitigacoes:

- normalizacao agressiva antes de detectar blocos;
- rejeicao explicita por motivo (observabilidade);
- preview admin para conferenciar qualidade.

## Validacao executada

- Prisma Client regenerado com sucesso.
- Lint executado sem erros.
- Build de producao executado com sucesso.

## Proximos passos recomendados

1. Finalizar remocao de campos legados em StudyQuestion apos migracao completa dos consumidores antigos.
2. Migrar endpoints admin/questions para ler/gravar exclusivamente QuestionOption e relacoes N:N.
3. Criar testes de regressao com fixtures PDF/MD para cobertura de blocos invalidos, duplicados e payload incompleto.
