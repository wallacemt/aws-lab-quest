import { SeedAwsService } from "@/types/seeds";

export const LEVEL_DEFS = [
  {
    level: 1,
    name: "Recruta",
    prompt:
      "Pixel art badge shield for 'Recruta'. Young adventurer with simple helmet holding a cloud icon. Sky blue and white. 8-bit retro Nintendo style achievement badge.",
  },
  {
    level: 2,
    name: "Cadete",
    prompt:
      "Pixel art badge shield for 'Cadete'. Cadet with training gear, teal and white colors, small AWS logo, stars. 8-bit retro Nintendo style badge.",
  },
  {
    level: 3,
    name: "Explorador",
    prompt:
      "Pixel art badge shield for 'Explorador'. Explorer with map and compass, purple and yellow colors, cloud motifs. 8-bit retro Nintendo style adventure badge.",
  },
  {
    level: 4,
    name: "Especialista",
    prompt:
      "Pixel art badge shield for 'Especialista'. Armored specialist holding circuit board. Red, gold, and AWS orange accents. 8-bit retro expert badge.",
  },
  {
    level: 5,
    name: "Guardião AWS",
    prompt:
      "Pixel art badge shield for 'Guardião AWS'. Guardian warrior protecting a cloud server. AWS orange armor, dark tones. 8-bit retro epic badge.",
  },
  {
    level: 6,
    name: "Lendário",
    prompt:
      "Pixel art badge shield for 'Lendário'. Legendary hero with crown, golden clouds and stars, rainbow colors. 8-bit retro legendary badge.",
  },
] as const;
export const SERVICE_FALLBACK: SeedAwsService[] = [
  { code: "EC2", name: "Amazon EC2", description: "Computacao elastica na nuvem." },
  { code: "S3", name: "Amazon S3", description: "Armazenamento de objetos." },
  { code: "IAM", name: "AWS IAM", description: "Identidade e acesso." },
  { code: "VPC", name: "Amazon VPC", description: "Rede virtual na AWS." },
  { code: "RDS", name: "Amazon RDS", description: "Banco relacional gerenciado." },
  { code: "LAMBDA", name: "AWS Lambda", description: "Computacao serverless." },
  { code: "CLOUDWATCH", name: "Amazon CloudWatch", description: "Observabilidade e monitoramento." },
  { code: "ROUTE53", name: "Amazon Route 53", description: "DNS gerenciado." },
  { code: "DYNAMODB", name: "Amazon DynamoDB", description: "Banco NoSQL gerenciado." },
  { code: "CLOUDFRONT", name: "Amazon CloudFront", description: "CDN global." },
  { code: "ECS", name: "Amazon ECS", description: "Orquestracao de containers." },
  { code: "EKS", name: "Amazon EKS", description: "Kubernetes gerenciado." },
  { code: "SQS", name: "Amazon SQS", description: "Fila de mensagens." },
  { code: "SNS", name: "Amazon SNS", description: "Pub/sub e notificacoes." },
  { code: "API_GATEWAY", name: "Amazon API Gateway", description: "Gerenciamento de APIs." },
  { code: "CLOUDFORMATION", name: "AWS CloudFormation", description: "Infraestrutura como codigo." },
  { code: "KMS", name: "AWS KMS", description: "Gerenciamento de chaves e criptografia." },
  { code: "SECRETS_MANAGER", name: "AWS Secrets Manager", description: "Segredos e rotacao de credenciais." },
  { code: "EVENTBRIDGE", name: "Amazon EventBridge", description: "Barramento de eventos." },
  { code: "STEP_FUNCTIONS", name: "AWS Step Functions", description: "Orquestracao de workflows." },
];