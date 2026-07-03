import { callAI } from "../ai.js";
import { extractJsonArray } from "../shared/ingestion-pipeline.js";
import { logger } from "../shared/logger.js";

export type ParsedDomain = {
  number: number;
  name: string;
  weightPercent: number;
  subTopics: string[];
};

const DOMAIN_REGEX =
  /domain\s+(\d+)[:\s]+([^\n(]+)\s*\(?\s*(\d+(?:\.\d+)?)\s*%\s*\)?/gi;

export function parseDomainsFromText(text: string): ParsedDomain[] {
  const domains: ParsedDomain[] = [];
  let match: RegExpExecArray | null;

  while ((match = DOMAIN_REGEX.exec(text)) !== null) {
    const number = parseInt(match[1]!, 10);
    const name = match[2]!.trim().replace(/\s+/g, " ");
    const weightPercent = parseFloat(match[3]!);
    if (!isNaN(number) && !isNaN(weightPercent) && name.length > 3) {
      domains.push({ number, name, weightPercent, subTopics: [] });
    }
  }

  return domains;
}

function extractSubTopicsForDomain(
  text: string,
  domainName: string,
  nextDomainName?: string
): string[] {
  const start = text.indexOf(domainName);
  if (start === -1) return [];

  const end = nextDomainName ? text.indexOf(nextDomainName, start + domainName.length) : text.length;
  const section = text.slice(start, end > start ? end : undefined);

  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("•") || l.startsWith("-") || /^\d+\.\d+/.test(l))
    .map((l) => l.replace(/^[•\-\d.]+\s*/, "").trim())
    .filter((l) => l.length > 5)
    .slice(0, 12);
}

export async function extractDomainsWithAI(
  text: string,
  certificationCode: string
): Promise<ParsedDomain[]> {
  const prompt = `
You are analyzing an official AWS ${certificationCode} exam guide.
Extract the exam blueprint domains (sections that cover exam content weights).

Return a JSON array ONLY with this structure:
[
  {
    "number": 1,
    "name": "Domain name as written",
    "weightPercent": 30.0,
    "subTopics": ["sub-topic 1", "sub-topic 2"]
  }
]

The weightPercent values should sum to approximately 100.
Text excerpt (first 6000 chars):
${text.slice(0, 6000)}
`.trim();

  try {
    const response = await callAI(prompt, "WORKER_BLUEPRINT_PARSER");
    const jsonStr = extractJsonArray(response);
    if (!jsonStr) return [];

    const parsed = JSON.parse(jsonStr) as unknown[];
    return parsed
      .filter((d): d is ParsedDomain => {
        if (!d || typeof d !== "object") return false;
        const t = d as Record<string, unknown>;
        return (
          typeof t.number === "number" &&
          typeof t.name === "string" &&
          typeof t.weightPercent === "number"
        );
      })
      .map((d) => ({
        ...d,
        subTopics: Array.isArray(d.subTopics)
          ? (d.subTopics as unknown[]).map(String).slice(0, 12)
          : [],
      }));
  } catch (err) {
    logger.warn({ err, certificationCode }, "AI domain extraction failed");
    return [];
  }
}

export async function parseBlueprintDomains(
  text: string,
  certificationCode: string
): Promise<ParsedDomain[]> {
  let domains = parseDomainsFromText(text);

  if (domains.length >= 3) {
    for (let i = 0; i < domains.length; i++) {
      domains[i]!.subTopics = extractSubTopicsForDomain(
        text,
        domains[i]!.name,
        domains[i + 1]?.name
      );
    }
    return domains;
  }

  // Fallback to AI extraction
  logger.info({ certificationCode }, "Regex found < 3 domains, falling back to AI extraction");
  domains = await extractDomainsWithAI(text, certificationCode);

  return domains;
}
