/**
 * User profile store — session sync test suite — TC-001 to TC-005
 *
 * LSF: `hydrated` never reset on logout, so switching accounts via
 * client-side navigation (no full page reload) kept the previous account's
 * profile/isProfileComplete state. `syncSession()` gives the store an
 * identity signal (the Better Auth session's user id) so it can reset
 * itself whenever the logged-in user actually changes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUserProfileStore } from "@/stores/userProfileStore";

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function mockProfileFetch(overrides: { name?: string; username?: string } = {}) {
  vi.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/user/profile")) {
      return jsonResponse({
        certification: "AWS Solutions Architect",
        certificationPresetCode: "SAA-C03",
        favoriteTheme: "default",
        avatarUrl: null,
        themePreset: "default",
        user: { name: overrides.name ?? "Jogador", username: overrides.username ?? "jogador" },
      });
    }
    if (url.includes("/api/certifications")) {
      return jsonResponse({ certifications: [] });
    }
    if (url.includes("/api/quest-history")) {
      return jsonResponse({ history: [] });
    }
    if (url.includes("/api/study/history")) {
      return jsonResponse({ history: [] });
    }

    throw new Error(`unexpected fetch: ${url}`);
  });
}

const INITIAL_STATE = useUserProfileStore.getState();

beforeEach(() => {
  vi.restoreAllMocks();
  useUserProfileStore.setState(INITIAL_STATE, true);
});

describe("TC-001 — syncSession: first call just records the session identity", () => {
  it("does not reset an already-hydrated store on the very first sync", async () => {
    mockProfileFetch({ name: "Ana" });
    await useUserProfileStore.getState().loadProfile();

    expect(useUserProfileStore.getState().hydrated).toBe(true);

    useUserProfileStore.getState().syncSession("user-a");

    const state = useUserProfileStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.profile.name).toBe("Ana");
  });
});

describe("TC-002 — syncSession: same id is a no-op", () => {
  it("keeps the current profile when the session id has not changed", async () => {
    mockProfileFetch({ name: "Ana" });
    await useUserProfileStore.getState().loadProfile();
    useUserProfileStore.getState().syncSession("user-a");

    useUserProfileStore.getState().syncSession("user-a");

    const state = useUserProfileStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.profile.name).toBe("Ana");
  });
});

describe("TC-003 — syncSession: logout (id -> null) resets the store", () => {
  it("clears profile and hydrated so the next load starts fresh", async () => {
    mockProfileFetch({ name: "Ana" });
    await useUserProfileStore.getState().loadProfile();
    useUserProfileStore.getState().syncSession("user-a");

    useUserProfileStore.getState().syncSession(null);

    const state = useUserProfileStore.getState();
    expect(state.hydrated).toBe(false);
    expect(state.profile.name).toBe("");
    expect(state.profile.username).toBe("");
  });
});

describe("TC-004 — syncSession: switching directly to a different user id resets the store", () => {
  it("discards the previous account's profile even without an intermediate null", async () => {
    mockProfileFetch({ name: "Ana" });
    await useUserProfileStore.getState().loadProfile();
    useUserProfileStore.getState().syncSession("user-a");

    useUserProfileStore.getState().syncSession("user-b");

    const state = useUserProfileStore.getState();
    expect(state.hydrated).toBe(false);
    expect(state.profile.name).toBe("");
  });
});

describe("TC-005 — full account-switch flow: no stale profile leaks into the new account", () => {
  it("re-fetches and reflects account B's data after A logs out and B logs in", async () => {
    // Account A loads and is synced.
    mockProfileFetch({ name: "Ana" });
    await useUserProfileStore.getState().loadProfile();
    useUserProfileStore.getState().syncSession("user-a");
    expect(useUserProfileStore.getState().profile.name).toBe("Ana");

    // A logs out.
    useUserProfileStore.getState().syncSession(null);

    // B logs in — the guard that used to skip re-fetching (`if (hydrated) return`)
    // must not apply anymore, since syncSession reset `hydrated` to false.
    useUserProfileStore.getState().syncSession("user-b");
    mockProfileFetch({ name: "Beto" });
    await useUserProfileStore.getState().loadProfile();

    const state = useUserProfileStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.profile.name).toBe("Beto");
  });
});

/**
 * TC-006 — loadProfile race across an account switch
 *
 * Sourcery review (PR #59): `inFlightLoad` is a module-level promise, not
 * scoped to a session. If A's loadProfile() is still in flight when
 * syncSession() resets the store for a logout+login into B, the store's
 * `loading`/`hydrated` flags get reset but the *promise itself* keeps
 * running — and once it resolves, its `.then()` unconditionally calls
 * `set()`, overwriting B's already-loaded profile with A's stale data.
 */
describe("TC-006 — loadProfile race: a stale in-flight fetch must not clobber the new account", () => {
  it("discards a late-resolving fetch that was started before an account switch", async () => {
    let resolveAProfile!: (value: Response) => void;
    const aProfilePromise = new Promise<Response>((resolve) => {
      resolveAProfile = resolve;
    });

    let profileCallCount = 0;
    vi.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/user/profile")) {
        profileCallCount += 1;
        // First call (account A) hangs until resolveAProfile() below fires.
        // Every subsequent call (account B) resolves immediately.
        return profileCallCount === 1 ? aProfilePromise : jsonResponse({
          certification: "AWS Solutions Architect",
          certificationPresetCode: "SAA-C03",
          favoriteTheme: "default",
          avatarUrl: null,
          themePreset: "default",
          user: { name: "Beto", username: "beto" },
        });
      }
      if (url.includes("/api/certifications")) return jsonResponse({ certifications: [] });
      if (url.includes("/api/quest-history")) return jsonResponse({ history: [] });
      if (url.includes("/api/study/history")) return jsonResponse({ history: [] });

      throw new Error(`unexpected fetch: ${url}`);
    });

    // A's load starts and hangs on the profile fetch.
    const loadA = useUserProfileStore.getState().loadProfile();
    useUserProfileStore.getState().syncSession("user-a");

    // A logs out, B logs in — both before A's fetch ever resolves.
    useUserProfileStore.getState().syncSession(null);
    useUserProfileStore.getState().syncSession("user-b");

    // B's load resolves (fast mocked fetch).
    await useUserProfileStore.getState().loadProfile();
    expect(useUserProfileStore.getState().profile.name).toBe("Beto");

    // A's original fetch finally resolves, late.
    resolveAProfile(
      jsonResponse({
        certification: "x",
        certificationPresetCode: "x",
        favoriteTheme: "x",
        avatarUrl: null,
        themePreset: "default",
        user: { name: "Ana", username: "ana" },
      }),
    );
    await loadA;

    // B's profile must survive — A's stale data must be discarded, not applied.
    expect(useUserProfileStore.getState().profile.name).toBe("Beto");
  });
});
