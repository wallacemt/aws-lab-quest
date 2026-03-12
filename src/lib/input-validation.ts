const INJECTION_PATTERNS = [
  /ignore\s+(all|any|previous|prior)\s+instructions?/i,
  /disregard\s+(all|any|previous|prior)\s+instructions?/i,
  /you\s+are\s+now/i,
  /system\s*prompt/i,
  /developer\s*mode/i,
  /jailbreak/i,
  /act\s+as/i,
  /bypass/i,
  /override/i,
  /<script/i,
  /```/,
];

const AWS_KEYWORDS = [
  "aws",
  "ec2",
  "s3",
  "iam",
  "vpc",
  "rds",
  "lambda",
  "cloudwatch",
  "route 53",
  "dynamodb",
  "cloudfront",
  "eks",
  "ecs",
  "api gateway",
  "sns",
  "sqs",
  "cloudformation",
  "terraform",
  "console",
];

const LAB_ACTION_WORDS = [
  "crie",
  "configure",
  "implemente",
  "acesse",
  "execute",
  "valide",
  "deploy",
  "provisione",
  "etapa",
  "passo",
  "objetivo",
  "lab",
  "laboratorio",
  "hands-on",
  "hands on",
  "task",
  "challenge",
];

export function containsPromptInjection(input: string): boolean {
  const normalized = input.toLowerCase();
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isLikelyAwsLabText(input: string): boolean {
  const normalized = input.toLowerCase();

  const awsHits = AWS_KEYWORDS.reduce((count, word) => (normalized.includes(word) ? count + 1 : count), 0);
  const actionHits = LAB_ACTION_WORDS.reduce((count, word) => (normalized.includes(word) ? count + 1 : count), 0);

  // Strong signal: at least two AWS terms and at least two action/lab indicators.
  return awsHits >= 2 && actionHits >= 2;
}

export function sanitizeUserText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/```/g, "")
    .trim();
}

export type ProfileInput = {
  name: string;
  certification: string;
  favoriteTheme: string;
};

export function sanitizeProfileInput(input: Partial<ProfileInput>): ProfileInput {
  return {
    name: sanitizeUserText(input.name ?? ""),
    certification: sanitizeUserText(input.certification ?? ""),
    favoriteTheme: sanitizeUserText(input.favoriteTheme ?? ""),
  };
}

export function getProfileValidationError(profile: ProfileInput): string | null {
  if (!profile.name) {
    return "Informe seu nome de jogador.";
  }

  if (!profile.certification) {
    return "Informe sua certificacao AWS alvo.";
  }

  if (!profile.favoriteTheme) {
    return "Informe o tema favorito para quests.";
  }

  return null;
}
