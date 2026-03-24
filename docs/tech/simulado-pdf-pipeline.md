# Pipeline tecnico de PDF de Simulado

Este documento descreve como funciona o fluxo de ingestao de PDFs de simulados na plataforma, desde o upload no painel admin ate o uso das questoes no endpoint que alimenta o modo Simulado.

## Objetivo do pipeline

- Permitir que o admin envie PDFs de simulados.
- Extrair texto do PDF com seguranca e validacoes.
- Gerar questoes estruturadas com IA.
- Salvar as questoes no banco para reutilizacao.
- Reaproveitar esse banco no endpoint de Simulado dos usuarios.

## Visao geral da arquitetura

Fluxo em alto nivel:

1. Admin envia PDF no painel [src/features/admin/screens/AdminPdfUploadScreen.tsx](../../src/features/admin/screens/AdminPdfUploadScreen.tsx).
2. API extrai texto via [src/app/api/admin/pdf/extract/route.ts](../../src/app/api/admin/pdf/extract/route.ts).
3. Admin confirma ingestao via [src/app/api/admin/pdf/ingest/route.ts](../../src/app/api/admin/pdf/ingest/route.ts).
4. Servico gera/sanitiza/salva questoes em [src/lib/study-question-generation.ts](../../src/lib/study-question-generation.ts).
5. Endpoint de Simulado busca questoes no banco em [src/app/api/study/simulado/questions/route.ts](../../src/app/api/study/simulado/questions/route.ts).

## Pré-condicoes importantes

Antes de ingerir PDF de simulado, o sistema exige que a certificacao tenha um Exam Guide valido salvo no banco.

- O Exam Guide e salvo por [src/app/api/admin/pdf/exam-guide/route.ts](../../src/app/api/admin/pdf/exam-guide/route.ts).
- A ingestao de simulado falha se o Exam Guide estiver ausente/curto (regra em [src/lib/study-question-generation.ts](../../src/lib/study-question-generation.ts)).
- O endpoint de Simulado tambem bloqueia execucao sem Exam Guide da certificacao do usuario (regra em [src/app/api/study/simulado/questions/route.ts](../../src/app/api/study/simulado/questions/route.ts)).

## Etapa 1: Upload e extracao do PDF

Entrada:

- `multipart/form-data` com:
  - `file` (PDF)
  - `certificationCode`

Endpoint:

- [src/app/api/admin/pdf/extract/route.ts](../../src/app/api/admin/pdf/extract/route.ts)

Validacoes principais:

- Usuario precisa ser admin (`requireAdmin`).
- Arquivo precisa ser PDF.
- Limite de tamanho: 20 MB.
- Certificacao precisa existir em `CertificationPreset`.

Extracao de texto:

- Implementada em [src/features/admin/services/pdf-extraction.ts](../../src/features/admin/services/pdf-extraction.ts).
- Usa `pdf2json` para extrair texto.
- Normaliza whitespace e corta tamanho maximo (`MAX_TEXT_LENGTH`).
- Se o texto vier vazio (PDF escaneado), retorna erro orientando OCR/fallback manual.

Saida do endpoint de extracao:

- `fileName`
- `characters`
- `preview`
- `extractedText`
- `certification` (code e name)

## Etapa 2: Ingestao das questoes

Depois da extracao, o admin aciona "Gerar e salvar questoes" no frontend.

Endpoint:

- [src/app/api/admin/pdf/ingest/route.ts](../../src/app/api/admin/pdf/ingest/route.ts)

Payload esperado:

- `certificationCode`
- `extractedText`
- `desiredCount` (opcional; limitado entre 5 e 50)

Validacoes:

- Admin autenticado.
- Payload JSON valido.
- Texto extraido minimo (>= 80 chars).

Servico chamado:

- `ingestQuestionsFromPdf` em [src/lib/study-question-generation.ts](../../src/lib/study-question-generation.ts).

## Etapa 3: Geracao com IA e sanitizacao

No `ingestQuestionsFromPdf`:

1. Carrega certificacao por `certificationCode`.
2. Verifica se existe `examGuide` suficiente.
3. Busca servicos AWS ativos (`AwsService`) para limitar dominios validos.
4. Chama `generateQuestionsWithAi` com:
   - `usage: "BOTH"` (questoes podem servir para KC e Simulado)
   - `difficulty: "mixed"`
   - `sourceText: extractedText` (texto do PDF)
   - contexto do exam guide + lista de servicos permitidos
5. Sanitiza as questoes com `sanitizeGeneratedQuestion`:
   - normaliza dificuldade
   - normaliza alternativa correta
   - corrige serviceCode invalido para fallback
   - garante strings minimas e consistencia
6. Persiste com `saveGeneratedQuestions` em `StudyQuestion`.

Retorno final da ingestao:

- `certificationCode`
- `generatedCount`
- `savedCount`

## Estrutura de dados no banco

Tabelas centrais (Prisma):

- `CertificationPreset`:
  - contem metadados da certificacao e `examGuide`.
- `AwsService`:
  - catalogo de servicos permitidos para classificar questoes.
- `StudyQuestion`:
  - banco principal de questoes para KC e Simulado.
  - campos relevantes: `usage`, `difficulty`, `topic`, `optionA..E`, `correctOption`, `explanationA..E`, `active`, FKs para certificacao/servico.

Modelo completo: [prisma/schema.prisma](../../prisma/schema.prisma).

## Como o Simulado consome esse banco

Endpoint de prova:

- [src/app/api/study/simulado/questions/route.ts](../../src/app/api/study/simulado/questions/route.ts)

Fluxo:

1. Autentica usuario.
2. Carrega certificacao alvo do perfil (`UserProfile`).
3. Bloqueia se nao houver exam guide.
4. Para cada dificuldade selecionada, chama `ensureQuestionPool(...)`.
   - Esse metodo preenche faltas do pool com IA quando necessario.
5. Consulta `StudyQuestion` com filtros:
   - `active = true`
   - `certificationPresetId` do usuario
   - `usage in ["SIMULADO", "BOTH"]`
   - dificuldade opcional
6. Sorteia perguntas aleatorias e mapeia para DTO de resposta (`mapDbQuestionToStudyQuestion`).
7. Retorna para frontend:
   - `questions`
   - `certificationCode`
   - `examMinutes`

Observacao:

- Mesmo sem novo PDF, o endpoint continua funcionando com o banco acumulado.
- O PDF melhora e expande a base de questoes para aquela certificacao.

## Relacao com KC

O mesmo banco `StudyQuestion` e reutilizado no KC.

- Endpoint KC: [src/app/api/study/kc/questions/route.ts](../../src/app/api/study/kc/questions/route.ts)
- Filtro de uso para KC: `usage in ["KC", "BOTH"]`.
- Isso permite compartilhar parte do conhecimento gerado por PDF entre os dois modos.

## Tratamento de falhas e mensagens

Falhas comuns e resposta esperada:

- PDF invalido ou maior que 20 MB: erro de validacao.
- PDF escaneado sem texto: erro orientando OCR/fallback manual.
- Certificacao invalida: erro 400.
- Sem Exam Guide: bloqueio da ingestao e do simulado.
- IA sem retorno JSON util: ingestao falha com mensagem de negocio.

## Checklist operacional (admin)

1. Fazer upload do Exam Guide oficial.
2. Fazer upload do PDF de Simulado.
3. Validar preview extraido.
4. Executar ingestao e confirmar `savedCount` > 0.
5. Testar Simulado com usuario da mesma certificacao alvo.

## Pontos de extensao

Sugestoes para evolucao futura:

- Guardar versao/origem do PDF ingerido em tabela dedicada.
- Evitar duplicadas semanticas de questoes (deduplicacao por embedding/hash).
- Adicionar score de confianca por questao e curadoria humana.
- Criar dashboard de cobertura por servico AWS e dificuldade.
