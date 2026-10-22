# E-mail e importação de simulados

## Resend

Configure `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no ambiente do app e worker (ou no `.env` usado pelo Docker Compose). O remetente deve pertencer a um domínio verificado no Resend. Nenhuma chave deve ser versionada. O envio usa a API HTTP com timeout de 15 segundos e falha explicitamente quando o provedor recusa a mensagem, preservando o tratamento de erro e retries dos chamadores.

## Banco de questões

Em Importar JSON, selecione um arquivo `.json` ou cole o conteúdo. A prévia só aceita questões válidas. Revise, desmarque itens indesejados e confirme. A API repete a validação e grava todas as questões em uma transação. Formatos aceitos: array de questões ou `{ "questions": [...] }`. Limites: 1 a 200 questões, 2 MB. Veja `examples/question-import.json`.

Cada questão exige `statement`, `options` com 2–5 alternativas A–E preenchidas, e `correctOption` ou `correctOptions`. As respostas devem existir nas alternativas, sem duplicatas. `questionType` aceita `single` ou `multi`; `difficulty` aceita `easy`, `medium`, `hard`, `nightmare`. `topic`, `certificationCode`, `explanations`, `awsServiceCodes` e `awsServiceNames` continuam compatíveis com o importador anterior. Códigos de certificação desconhecidos são rejeitados. Nomes de serviços mantêm a resolução aproximada anterior; serviços não encontrados não recebem vínculo.

## Simulado Maker

Defina nome e certificação. Anexe o JSON com 20 a 65 questões; revise e confirme a criação. Todas as questões ficam vinculadas à certificação selecionada, independentemente do código no arquivo. Questões e simulado são gravados na mesma transação. A seleção manual do banco continua disponível; cada simulado usa um arquivo ou a seleção manual.

Marque “Origem: AWS Skill Builder” quando a equipe tiver conferido a procedência. A identificação aparece em cards e listas, com tooltip acessível, e pode ser alterada na edição administrativa. Alunos podem filtrar “AWS Skill Builder”. A marcação indica origem conferida pela equipe, sem afirmar endosso ou verificação da AWS.

## Deploy

Aplique `prisma migrate deploy` usando `packages/db/prisma/schema.prisma` antes de subir o app/worker atualizado. A migration adiciona `SimuladoPack.isSkillBuilder` com default `false`, preservando packs existentes. Configure as duas variáveis Resend no ambiente de execução. O workflow roda testes e type-checks de app e worker antes de publicar imagens.
