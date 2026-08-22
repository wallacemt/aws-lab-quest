// Record<string, ...> (not a Partial<Record<literal keys, ...>>) so this is
// structurally assignable from NodeJS.ProcessEnv's index signature — a
// literal-keys type has no declared property in common with ProcessEnv and
// TS's weak-type check rejects it even though every key lookup is valid.
type SocialProviderEnv = Record<string, string | undefined>;

type SocialProvidersConfig = {
  google?: { clientId: string; clientSecret: string };
  github?: { clientId: string; clientSecret: string };
};

/**
 * Only enables a provider when its full id+secret pair is present — a
 * half-configured pair (e.g. id set, secret forgotten) is treated as "not
 * configured" rather than passed to Better Auth broken.
 */
export function resolveSocialProviders(env: SocialProviderEnv): SocialProvidersConfig {
  const providers: SocialProvidersConfig = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  }

  return providers;
}
