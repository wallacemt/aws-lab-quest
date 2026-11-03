/**
 * seed-rich-text-simulado.ts
 *
 * Creates one active SimuladoPack for SAA-C03 whose questions deliberately
 * exercise every branch of the rich-text engine (src/lib/statement-formatting.ts
 * + src/components/rich-text/*): JSON blocks, YAML/config blocks, shell
 * commands, error messages with embedded blobs, long base64-like tokens,
 * inline markdown, inline links, and "Referências AWS:" footer links.
 *
 * Meant for local UI/UX testing of the Simulado flow (and, since the same
 * engine now renders flashcard front/back, for flashcards created from
 * these questions once F6 lands).
 *
 * Requires the SAA-C03 CertificationPreset to exist (run `bun run db:seed`
 * first) and sets a placeholder `examGuide` on it if missing/too short,
 * since /api/study/simulado/pack-questions refuses to serve a pack whose
 * certification has no exam guide (>=120 chars) uploaded.
 *
 * Run: cd awlq-app && bun run db:seed:rich-text
 */
import { prisma } from "@/lib/prisma";

const CERT_CODE = "SAA-C03";
const PACK_NAME = "[TESTE LOCAL] Textos especiais (rich text)";

const PLACEHOLDER_EXAM_GUIDE = `# AWS Certified Solutions Architect – Associate (SAA-C03)

Placeholder de guia de exame gerado pelo seed de teste local
(seed-rich-text-simulado.ts) só para satisfazer a checagem de
"Exam Guide presente" da rota de pack-questions. Não é o guia oficial —
substitua subindo o PDF real pelo admin se for testar a extração real.

Domínios cobertos (placeholder): projeto de arquiteturas resilientes,
desempenho de alta performance, segurança, otimização de custos.`;

type QuestionSeed = {
  externalId: string;
  topic: string;
  statement: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
};

const QUESTIONS: QuestionSeed[] = [
  {
    externalId: "rich-text-test-json-policy",
    topic: "AWS IAM",
    statement:
      "Uma equipe de segurança revisou a seguinte policy do IAM anexada a um usuário e encontrou um problema. " +
      'Policy: {"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Action": "s3:*", "Resource": "*"}]} ' +
      "Qual é o principal problema de segurança nessa policy?",
    optionA: "Ela concede `s3:*` em todos os recursos (`Resource: \"*\"`), violando o princípio do menor privilégio.",
    optionB: "O campo `Version` está desatualizado e a policy não funcionará.",
    optionC: "Falta o campo `Principal`, então a policy será ignorada pelo IAM.",
    optionD: "O `Effect: Allow` deveria ser `Effect: Permit`.",
    correctOption: "A",
  },
  {
    externalId: "rich-text-test-yaml-cfn",
    topic: "AWS CloudFormation",
    statement:
      "Um engenheiro escreveu o seguinte trecho de template do CloudFormation para uma fila do SQS:\n" +
      "Resources:\n" +
      "  MyQueue:\n" +
      "    Type: AWS::SQS::Queue\n" +
      "    Properties:\n" +
      "      QueueName: minha-fila\n" +
      "      VisibilityTimeout: 30\n" +
      "      MessageRetentionPeriod: 86400\n" +
      "O deploy falha porque outro recurso referencia `!GetAtt MyQueue.Arn` antes da fila existir. " +
      "Qual ajuste resolve a ordem de criação sem alterar a lógica do template?",
    optionA: "Adicionar `DependsOn: MyQueue` no recurso que referencia a fila.",
    optionB: "Renomear `MyQueue` para `myqueue` em minúsculas.",
    optionC: "Remover o `VisibilityTimeout` do template.",
    optionD: "Trocar `!GetAtt` por `!Ref` em todos os lugares.",
    correctOption: "A",
  },
  {
    externalId: "rich-text-test-cli-error-blob",
    topic: "AWS CLI",
    statement:
      "Um desenvolvedor executou o comando abaixo para listar objetos de um bucket:\n" +
      "$ aws s3 ls s3://meu-bucket-privado/\n" +
      "E recebeu o seguinte erro:\n" +
      "An error occurred (AccessDenied) when calling the ListObjectsV2 operation: " +
      "User: arn:aws:iam::123456789012:user/dev-junior is not authorized to perform: s3:ListBucket " +
      "because no identity-based policy allows the s3:ListBucket action. " +
      "RequestId: 7F3K9QZXMD2EXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLE1234567890ABCDEF== " +
      "O que esse erro indica?",
    optionA: "O usuário IAM não tem uma policy que permita a ação `s3:ListBucket` nesse bucket.",
    optionB: "O bucket não existe na região configurada.",
    optionC: "O AWS CLI está desatualizado e precisa ser reinstalado.",
    optionD: "O nome do bucket contém caracteres inválidos.",
    correctOption: "A",
  },
  {
    externalId: "rich-text-test-long-token",
    topic: "Amazon S3",
    statement:
      "Ao gerar uma URL pré-assinada para um objeto privado do S3, a aplicação recebeu o seguinte token de assinatura " +
      "no parâmetro `X-Amz-Signature`: " +
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4 " +
      "Esse token muda a cada nova geração da URL mesmo para o mesmo objeto. Por que isso acontece?",
    optionA:
      "Porque a assinatura é derivada de uma chave temporária (SigV4) que inclui a data/hora da requisição, " +
      "tornando cada assinatura única mesmo para o mesmo objeto.",
    optionB: "Porque o S3 criptografa o nome do objeto a cada requisição.",
    optionC: "Porque o token é um UUID aleatório sem relação com a requisição.",
    optionD: "Porque o bucket tem versionamento habilitado.",
    correctOption: "A",
  },
  {
    externalId: "rich-text-test-inline-markdown-link",
    topic: "Amazon EC2",
    statement:
      "Ao configurar o **Auto Scaling Group**, você precisa decidir a métrica de escala. A documentação recomenda " +
      "consultar o guia de [políticas de escalonamento dinâmico](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html) " +
      "antes de criar a policy. Qual tipo de escalonamento ajusta a capacidade automaticamente para manter uma " +
      "métrica (ex.: `CPUUtilization`) próxima de um valor-alvo definido?",
    optionA: "Target tracking scaling",
    optionB: "Scheduled scaling",
    optionC: "Manual scaling",
    optionD: "Predictive scaling apenas",
    correctOption: "A",
  },
  {
    externalId: "rich-text-test-reference-footer",
    topic: "Amazon VPC",
    statement:
      "Uma VPC tem duas sub-redes privadas em AZs diferentes, cada uma com uma NAT Gateway própria. Uma instância " +
      "em uma das sub-redes privadas precisa acessar a internet para baixar atualizações. Qual configuração de " +
      "rota garante esse acesso pela NAT Gateway da mesma AZ, evitando tráfego entre AZs?\n\n" +
      "Referências AWS: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html " +
      "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-subnets-commands-example.html",
    optionA:
      "A tabela de rotas de cada sub-rede privada deve apontar `0.0.0.0/0` para a NAT Gateway da própria AZ.",
    optionB: "Todas as sub-redes privadas devem compartilhar a mesma tabela de rotas.",
    optionC: "A instância deve ter um Elastic IP público atribuído diretamente.",
    optionD: "É necessário um Internet Gateway anexado à sub-rede privada.",
    correctOption: "A",
  },
  {
    externalId: "rich-text-test-combo-json-and-refs",
    topic: "Amazon DynamoDB",
    statement:
      "Uma query no DynamoDB retornou o seguinte resultado (truncado):\n" +
      '[{"id": "1", "status": "ACTIVE", "retries": 0}, {"id": "2", "status": "FAILED", "retries": 3}] ' +
      "A aplicação precisa reprocessar apenas os itens com `status = \"FAILED\"` e `retries < 5`, sem fazer um " +
      "full table scan. Qual abordagem é a mais eficiente?\n\n" +
      "Referências AWS: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html",
    optionA:
      "Criar um Global Secondary Index (GSI) com `status` como partition key e consultar apenas os itens `FAILED`.",
    optionB: "Fazer um `Scan` completo da tabela filtrando no lado da aplicação.",
    optionC: "Exportar a tabela inteira para o S3 e processar com Athena a cada retry.",
    optionD: "Adicionar um atributo `isFailed` booleano e não indexar nada.",
    correctOption: "A",
  },
  {
    externalId: "rich-text-test-plain-control",
    topic: "AWS Lambda",
    statement:
      "Uma função Lambda com timeout de 3 segundos processa imagens grandes e está sendo encerrada antes de " +
      "terminar. Qual é o ajuste mais direto para resolver isso, assumindo que o código já está otimizado?",
    optionA: "Aumentar o timeout configurado da função (até o limite de 15 minutos).",
    optionB: "Diminuir a memória alocada para a função.",
    optionC: "Trocar o runtime para uma versão mais antiga.",
    optionD: "Remover as variáveis de ambiente da função.",
    correctOption: "A",
  },
];

async function main() {
  console.log("🧪 Seeding rich-text test Simulado pack...");

  const preset = await prisma.certificationPreset.findFirst({ where: { code: CERT_CODE } });
  if (!preset) {
    throw new Error(
      `CertificationPreset "${CERT_CODE}" não encontrado. Rode "bun run db:seed" antes deste script.`,
    );
  }

  if (!preset.examGuide || preset.examGuide.trim().length < 120) {
    await prisma.certificationPreset.update({
      where: { id: preset.id },
      data: { examGuide: PLACEHOLDER_EXAM_GUIDE },
    });
    console.log(`  ✓ examGuide placeholder definido para ${CERT_CODE} (necessário para liberar o pack)`);
  }

  const questionIds: string[] = [];
  for (const q of QUESTIONS) {
    const question = await prisma.studyQuestion.upsert({
      where: { externalId: q.externalId },
      create: {
        externalId: q.externalId,
        statement: q.statement,
        topic: q.topic,
        usage: "SIMULADO",
        difficulty: "medium",
        questionType: "single",
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        certificationPresetId: preset.id,
        active: true,
      },
      update: {
        statement: q.statement,
        topic: q.topic,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        active: true,
      },
    });
    questionIds.push(question.id);
  }
  console.log(`  ✓ ${questionIds.length} questões com texto especial criadas/atualizadas`);

  const existingPack = await prisma.simuladoPack.findFirst({ where: { name: PACK_NAME } });
  const pack = existingPack
    ? await prisma.simuladoPack.update({
        where: { id: existingPack.id },
        data: { active: true, questionCount: questionIds.length, certificationPresetId: preset.id },
      })
    : await prisma.simuladoPack.create({
        data: {
          name: PACK_NAME,
          certificationPresetId: preset.id,
          questionCount: questionIds.length,
          difficultyScore: 1,
          active: true,
        },
      });

  await prisma.simuladoPackQuestion.deleteMany({ where: { packId: pack.id } });
  for (const [index, questionId] of questionIds.entries()) {
    await prisma.simuladoPackQuestion.create({
      data: { packId: pack.id, questionId, position: index + 1 },
    });
  }
  console.log(`  ✓ Pack "${PACK_NAME}" pronto (${questionIds.length} questões, id=${pack.id})`);

  console.log(`\n✅ Pronto! Logue como mock@awlq.dev (ou qualquer usuário aprovado com cert ${CERT_CODE}) e abra`);
  console.log(`   /simulado — o pack "${PACK_NAME}" vai aparecer na lista.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
