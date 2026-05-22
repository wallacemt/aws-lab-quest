import "dotenv/config";

function require(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const val = parseInt(process.env[name] ?? "", 10);
  return isNaN(val) ? fallback : val;
}

function optionalFloat(name: string, fallback: number): number {
  const val = parseFloat(process.env[name] ?? "");
  return isNaN(val) ? fallback : val;
}

export const config = {
  database: {
    url: require("DATABASE_URL"),
    poolMax: optionalInt("DATABASE_POOL_MAX", 3),
    idleTimeoutMs: optionalInt("DATABASE_POOL_IDLE_TIMEOUT_MS", 30_000),
    connectionTimeoutMs: optionalInt("DATABASE_POOL_CONNECTION_TIMEOUT_MS", 10_000),
  },
  redis: {
    url: require("REDIS_URL"),
  },
  gemini: {
    apiKey: require("GEMINI_API_KEY"),
    model: optional("GEMINI_MODEL", "gemini-2.5-flash"),
    safeTokensPerMinute: optionalInt("GEMINI_SAFE_TOKENS_PER_MINUTE", 9000),
    minCallIntervalMs: optionalInt("GEMINI_MIN_CALL_INTERVAL_MS", 2500),
  },
  worker: {
    logLevel: optional("LOG_LEVEL", "info"),
    weakAreaThreshold: optionalFloat("WEAK_AREA_THRESHOLD", 0.60),
    weakAreaWindowDays: optionalInt("WEAK_AREA_WINDOW_DAYS", 30),
    triggerPollIntervalMs: optionalInt("TRIGGER_POLL_INTERVAL_MS", 30_000),
  },
  email: {
    username: optional("MAIL_USERNAME", ""),
    password: optional("MAIL_PASSWORD", ""),
    from: optional("EMAIL_FROM", "AWS Quest <noreply@example.com>"),
  },
  app: {
    url: optional("APP_URL", "https://awslabquest.com"),
  },
};
