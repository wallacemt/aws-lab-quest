// LSF-2026-007: verify file magic bytes instead of trusting client-supplied MIME type.
// This prevents SVG/HTML/executable files disguised as images from being stored.
const IMAGE_MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

export function verifyImageMagicBytes(buffer: Buffer): string | null {
  for (const sig of IMAGE_MAGIC_BYTES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    const match = sig.bytes.every((byte, i) => buffer[offset + i] === byte);
    if (match) {
      // Extra check for WebP: bytes 8-11 must be "WEBP"
      if (sig.mime === "image/webp") {
        if (buffer.length < 12) continue;
        const webp = [0x57, 0x45, 0x42, 0x50];
        if (!webp.every((byte, i) => buffer[8 + i] === byte)) continue;
      }
      return sig.mime;
    }
  }
  return null;
}

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
  username: string;
  certification: string;
  certificationPresetCode: string;
  favoriteTheme: string;
};

export function sanitizeProfileInput(input: Partial<ProfileInput>): ProfileInput {
  return {
    name: sanitizeUserText(input.name ?? ""),
    username: sanitizeUserText(input.username ?? "").toLowerCase(),
    certification: sanitizeUserText(input.certification ?? ""),
    certificationPresetCode: sanitizeUserText(input.certificationPresetCode ?? "").toUpperCase(),
    favoriteTheme: sanitizeUserText(input.favoriteTheme ?? ""),
  };
}

export function getProfileValidationError(profile: ProfileInput): string | null {
  if (!profile.name) {
    return "Informe seu nome de jogador.";
  }

  if (!profile.username) {
    return "Informe um nome de usuario.";
  }

  if (!/^[a-z0-9_]{3,24}$/.test(profile.username)) {
    return "Nome de usuario invalido. Use 3-24 caracteres com letras, numeros ou _.";
  }

  if (!profile.certificationPresetCode) {
    return "Selecione sua certificacao AWS alvo.";
  }

  if (!profile.certification) {
    return "Informe sua certificacao AWS alvo.";
  }

  if (!profile.favoriteTheme) {
    return "Informe o tema favorito para quests.";
  }

  return null;
}
