/**
 * Social login providers config — TC-001 to TC-005
 *
 * `resolveSocialProviders` decides which OAuth providers Better Auth should
 * enable, based on which env var pairs are actually set. Kept as a pure
 * function (no `lib/auth.ts` import, no Prisma/DB side effects) so it can be
 * unit tested without spinning up the real Better Auth instance.
 */

import { describe, it, expect } from "vitest";
import { resolveSocialProviders, socialAccountLinking } from "@/lib/auth-providers";

describe("TC-001 — resolveSocialProviders: no env vars set", () => {
  it("returns no providers when nothing is configured", () => {
    expect(resolveSocialProviders({})).toEqual({});
  });
});

describe("TC-002 — resolveSocialProviders: Google fully configured", () => {
  it("includes google when both id and secret are set", () => {
    const providers = resolveSocialProviders({
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
    });
    expect(providers.google).toEqual({ clientId: "gid", clientSecret: "gsecret" });
    expect(providers.github).toBeUndefined();
  });
});

describe("TC-003 — resolveSocialProviders: GitHub fully configured", () => {
  it("includes github when both id and secret are set", () => {
    const providers = resolveSocialProviders({
      GITHUB_CLIENT_ID: "hid",
      GITHUB_CLIENT_SECRET: "hsecret",
    });
    expect(providers.github).toEqual({ clientId: "hid", clientSecret: "hsecret" });
    expect(providers.google).toBeUndefined();
  });
});

describe("TC-004 — resolveSocialProviders: both providers configured", () => {
  it("includes both when all four env vars are set", () => {
    const providers = resolveSocialProviders({
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
      GITHUB_CLIENT_ID: "hid",
      GITHUB_CLIENT_SECRET: "hsecret",
    });
    expect(Object.keys(providers).sort()).toEqual(["github", "google"]);
  });
});

describe("TC-005 — resolveSocialProviders: half-configured pairs are rejected", () => {
  it("excludes a provider when only the client id is set", () => {
    expect(resolveSocialProviders({ GOOGLE_CLIENT_ID: "gid" })).toEqual({});
  });

  it("excludes a provider when only the client secret is set", () => {
    expect(resolveSocialProviders({ GITHUB_CLIENT_SECRET: "hsecret" })).toEqual({});
  });
});

/**
 * TC-006 to TC-008 — socialAccountLinking
 *
 * Bug: signing in with Google/GitHub using an email that already has a
 * password account failed with Better Auth's "account not linked" error.
 * Root cause has two layers:
 *  1. Implicit linking is off unless `accountLinking.enabled` lists the
 *     provider in `trustedProviders`.
 *  2. Even then, Better Auth also requires the *existing local* account's
 *     `emailVerified` to be true (`requireLocalEmailVerified`, defaults to
 *     true) — and this app never implements email verification (grep for
 *     `emailVerified` across src/ turns up nothing), so every
 *     email/password user is permanently stuck at emailVerified:false.
 *     Leaving the default would make linking dead code that always 403s.
 */
describe("TC-006 — socialAccountLinking: linking is enabled for both providers", () => {
  it("trusts both google and github to auto-link matching emails", () => {
    expect(socialAccountLinking.enabled).toBe(true);
    expect(socialAccountLinking.trustedProviders).toEqual(expect.arrayContaining(["google", "github"]));
  });
});

describe("TC-007 — socialAccountLinking: does not require local email verification", () => {
  it("sets requireLocalEmailVerified to false, since this app never verifies emails", () => {
    expect(socialAccountLinking.requireLocalEmailVerified).toBe(false);
  });
});

describe("TC-008 — socialAccountLinking: does not silently disable implicit linking", () => {
  it("never sets disableImplicitLinking (that would recreate the exact bug this fixes)", () => {
    expect(socialAccountLinking.disableImplicitLinking).not.toBe(true);
  });
});
