# Pipeline tecnico de ingestao de questoes (PDF e Markdown)

Este documento descreve o pipeline deterministico de ingestao de questoes usado no painel admin.

Status atual:

- OCR removido do fluxo de ingestao.
- Parsing por chunks cegos removido.
- Extracao em bloco completo por questao antes de qualquer chamada de IA.
- Deduplicacao por hash de uso (usageHash).
- Persistencia com estrutura normalizada (QuestionOption, QuestionAwsService, QuestionTopic).

## Objetivo

- Ingerir questoes de arquivos PDF e Markdown com previsibilidade.
- Garantir integridade do bloco completo da questao (enunciado + alternativas + metadados).
- Persistir questoes com deduplicacao consistente e rastreabilidade.
- Exibir preview das questoes extraidas no frontend admin em fluxo de pagina unica.

## Arquitetura atual

Fluxo principal:

1. Admin abre a tela de upload unica.
2. Admin seleciona certificacao e envia um ou mais arquivos (PDF/MD).
3. Endpoint de ingestao processa o arquivo no pipeline deterministico.
4. Cada bloco de questao e validado e enviado para IA individualmente.
5. Saida da IA e validada por schema e regras de negocio.
6. Dados validos sao persistidos em transacao com deduplicacao por usageHash.
7. API retorna resumo e preview para a interface.

Arquivos principais:

- src/features/admin/screens/AdminPdfUploadScreen.tsx
- src/features/admin/hooks/useAdminPdfUpload.ts
- src/app/api/admin/pdf/ingest/route.ts
- src/lib/question-ingestion-pipeline.ts
- prisma/schema.prisma

## Regras mandatorias implementadas

### Extracao

- PDF: uso de pdf-parse (sem OCR).
- Markdown: leitura nativa do arquivo.
- Texto normalizado antes de detectar questoes.

### Deteccao de blocos

- Deteccao por regex e heuristicas de inicio de questao.
- Nao existe chunking cego para enviar texto parcial ao modelo.
- Bloco so e considerado valido se tiver enunciado e no minimo duas linhas de alternativa.

### Uso de IA

- Uma chamada de IA por bloco de questao.
- Prompt exige JSON estrito.
- Se o JSON vier incompleto/invalido, o bloco e rejeitado.

### Validacao

A questao e rejeitada quando:

- enunciado ausente ou muito curto;
- menos de 2 alternativas;
- nenhuma alternativa correta;
- alternativas duplicadas;
- alternativas curtas demais.

### Deduplicacao

- usageHash calculado sobre conteudo canonico da questao.
- Se usageHash ja existe, a questao nao e duplicada no banco.

## Estrutura de persistencia

Campos e tabelas usados pelo pipeline:

- StudyQuestion:
  - statement
  - difficulty
  - questionType
  - active
  - rawText
  - ingestionVersion
  - usageHash
  - relacionamentos de certificacao/upload

- QuestionOption:
  - questionId
  - content
  - isCorrect
  - order
  - explanation

- QuestionAwsService:
  - questionId
  - serviceId

- Topic
- QuestionTopic

Observacao:

- O schema ainda contem campos legados para compatibilidade operacional de telas/endpoints antigos em outras areas, mas o novo pipeline grava tambem no modelo normalizado e usa usageHash como chave de dedupe.

## Contrato da API de ingestao

Endpoint:

- POST /api/admin/pdf/ingest

Entrada:

- multipart/form-data
  - certificationCode
  - files[] (PDF/MD)

Saida:

- jobId
- certificationCode
- generatedCount
- savedCount
- duplicateCount
- rejectedCount
- extractedQuestions (preview)
- rejects (motivos por bloco)

## Fluxo de frontend admin

Tela:

- src/features/admin/screens/AdminPdfUploadScreen.tsx

Passos na UI:

1. Selecionar certificacao.
2. Selecionar arquivos (PDF/MD).
3. Clicar em Processar.
4. Ver loading.
5. Ver resumo final e preview das questoes persistidas.

## Mudancas relevantes em runtime

- Rotas de estudo (KC e Simulado) nao fazem mais geracao automatica de pool durante a requisicao.
- O banco precisa estar previamente abastecido via ingestao admin.
- Em caso de pool insuficiente, as rotas retornam erro de disponibilidade.

## Operacao recomendada

1. Validar certificacao alvo no perfil do usuario/admin.
2. Enviar arquivos fonte no admin upload.
3. Conferir preview e rejeicoes.
4. Confirmar crescimento do banco de questoes por certificacao.
5. Testar KC e Simulado com usuario da mesma certificacao.

## Checklist de observabilidade

- Verificar contadores: generatedCount, savedCount, duplicateCount, rejectedCount.
- Auditar rejects por motivo para melhorar qualidade da fonte.
- Auditar uso de usageHash para confirmar deduplicacao.

## Limites e decisoes

- Sem OCR: PDFs escaneados sem texto selecionavel nao sao suportados pela ingestao automatica.
- Sem chunking cego: blocos incompletos sao descartados.
- Sem reparo heuristico de JSON: payload invalido da IA e rejeitado.
