const ALWAYS_REDACTED_KEYS = new Set([
  "ip",
  "ipAddress",
  "lastUsedIp",
  "userAgent",
  "phone",
  "cpf",
  "birthDate",
  "image",
  "avatarUrl",
  "accessDecisionReason",
]);

const PERSON_VALUE_KEYS = new Set([
  "user",
  "users",
  "author",
  "reporter",
  "owner",
  "createdBy",
  "member",
]);

const EMAIL_PATTERN = /([\w.+-]+)@([\w-]+)((?:\.[\w-]+)+)/g;

function maskEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, (_match, localPart: string, domain: string, suffix: string) => {
    const tld = suffix.slice(suffix.lastIndexOf(".") + 1);
    return `${localPart[0]}***@${domain[0]}***.${tld}`;
  });
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word[0].toLocaleUpperCase()}.`)
    .join(" ");
}

function transform(value: unknown, isPerson = false): unknown {
  if (typeof value === "string") return maskEmails(value);
  if (Array.isArray(value)) return value.map((item) => transform(item, isPerson));
  if (value === null || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const person = isPerson || Object.prototype.hasOwnProperty.call(source, "email");
  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(source)) {
    if (key === "email") {
      result[key] = item === null || item === undefined ? item : typeof item === "string" ? maskEmails(item) : transform(item);
      continue;
    }

    if (ALWAYS_REDACTED_KEYS.has(key)) {
      result[key] = item === null || item === undefined ? item : "[redacted]";
      continue;
    }

    if (key === "id" || key.endsWith("Id")) {
      result[key] = item;
      continue;
    }

    if (person && key === "name" && typeof item === "string" && item.trim() !== "") {
      result[key] = initials(item);
      continue;
    }

    if (person && key === "username" && typeof item === "string" && item !== "") {
      result[key] = `${item[0].toLocaleLowerCase()}***`;
      continue;
    }

    result[key] = transform(item, PERSON_VALUE_KEYS.has(key));
  }

  return result;
}

/** Returns a deep transformed copy with personal data masked. */
export function maskPersonalData(value: unknown): unknown {
  return transform(value);
}
