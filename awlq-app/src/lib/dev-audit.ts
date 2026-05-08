type AuditPayload = Record<string, unknown>;

function sanitizePayload(payload: AuditPayload): AuditPayload {
  const redacted = { ...payload };

  if (typeof redacted.extractedText === "string") {
    redacted.extractedText = `[omitted:${(redacted.extractedText as string).length} chars]`;
  }

  if (typeof redacted.preview === "string") {
    redacted.preview = `[omitted:${(redacted.preview as string).length} chars]`;
  }

  return redacted;
}

export function devAuditLog(event: string, payload: AuditPayload = {}): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const timestamp = new Date().toISOString();
  console.info(`[DEV-AUDIT][${timestamp}] ${event}`, sanitizePayload(payload));
}
