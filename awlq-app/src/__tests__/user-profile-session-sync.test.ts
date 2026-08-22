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
