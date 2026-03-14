import { prisma } from "@/lib/prisma";

const ADJECTIVES = [
  "cloud",
  "retro",
  "pixel",
  "nimble",
  "silver",
  "steady",
  "rapid",
  "bright",
  "storm",
  "crystal",
  "silent",
  "vector",
];

const NOUNS = [
  "architect",
  "builder",
  "explorer",
  "guardian",
  "operator",
  "runner",
  "ranger",
  "pilot",
  "artisan",
  "seeker",
  "strategist",
  "creator",
];

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,24}$/.test(username);
}

export function normalizeUsername(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomSuffix(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

export function createRandomUsernameCandidate(): string {
  return `${randomFrom(ADJECTIVES)}_${randomFrom(NOUNS)}_${randomSuffix()}`;
}

export async function generateUniqueUsername(maxAttempts = 20): Promise<string> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = createRandomUsernameCandidate();
    const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }

  return `player_${Date.now().toString().slice(-8)}`;
}
