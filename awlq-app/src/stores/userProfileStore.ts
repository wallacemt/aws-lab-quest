"use client";

import { create } from "zustand";
import { CertificationPreset, UserProfile } from "@/lib/types";

type ApiProfileResponse = {
  id: string;
  userId: string;
  certification: string;
  role: string;
  certificationPresetCode: string;
  favoriteTheme: string;
  avatarUrl: string | null;
  bgImageUrl?: string | null;
  themePreset?: string | null;
  customColors?: Record<string, string> | null;
  needsCertificationReview?: boolean;
  user: { name: string; email: string; username?: string | null };
};

const defaultProfile: UserProfile = {
  name: "",
  username: "",
  certification: "",
  certificationPresetCode: "",
  favoriteTheme: "",
  totalXp: 0,
};

type UserProfileState = {
  profile: UserProfile;
  certificationOptions: CertificationPreset[];
  needsCertificationReview: boolean;
  avatarUrl: string | null;
  hydrated: boolean;
  loading: boolean;
  // `undefined` = no session observed yet; `null` = confirmed logged out.
  // Lets syncSession tell "first call after page load" apart from "the
  // logged-in user actually changed", see syncSession below.
  loadedUserId: string | null | undefined;
  loadProfile: () => Promise<void>;
  syncSession: (userId: string | null) => void;
  reloadProfile: () => Promise<void>;
  refreshTotalXp: () => Promise<void>;
  setProfile: (next: UserProfile) => Promise<ApiProfileResponse>;
  setNeedsCertificationReview: (next: boolean) => void;
  setAvatarUrl: (next: string | null) => void;
  patchPersonalization: (patch: {
    themePreset?: string;
    bgImageUrl?: string | null;
    customColors?: Record<string, string> | null;
  }) => void;
};

let inFlightLoad: Promise<void> | null = null;
// Bumped on every account switch so a fetch started for the previous
// account can recognize itself as stale once it finally resolves — see
// syncSession() and loadProfile() below (LSF: race found in PR #59 review,
// a late-resolving fetch from account A was overwriting account B's
// already-loaded profile after a logout+login).
let loadGeneration = 0;

async function fetchProfileSnapshot(): Promise<{
  profileData: ApiProfileResponse;
  certData: { certifications?: CertificationPreset[] };
  totalXp: number;
}> {
  const [profileData, certData, totalXp] = await Promise.all([
    fetch("/api/user/profile", { cache: "no-store" }).then((r) => r.json() as Promise<ApiProfileResponse>),
    fetch("/api/certifications", { cache: "no-store" }).then(
      (r) => r.json() as Promise<{ certifications?: CertificationPreset[] }>,
    ),
    fetchTotalXpFromHistory(),
  ]);

  return { profileData, certData, totalXp };
}

async function fetchTotalXpFromHistory(): Promise<number> {
  const [questData, studyData] = await Promise.all([
    fetch("/api/quest-history").then((r) => r.json() as Promise<{ history?: { xp: number }[] }>),
    fetch("/api/study/history").then((r) => r.json() as Promise<{ history?: { gainedXp?: number }[] }>),
  ]);

  return (
    (questData.history ?? []).reduce((sum, item) => sum + item.xp, 0) +
    (studyData.history ?? []).reduce((sum, item) => sum + (item.gainedXp ?? 0), 0)
  );
}

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: defaultProfile,
  certificationOptions: [],
  needsCertificationReview: false,
  avatarUrl: null,
  hydrated: false,
  loading: false,
  loadedUserId: undefined,
  syncSession: (userId) => {
    const { loadedUserId } = get();

    if (loadedUserId === undefined) {
      // First observation of the session — whatever is already loaded (or
      // loading) belongs to this user, nothing to discard.
      set({ loadedUserId: userId });
      return;
    }

    if (userId === loadedUserId) {
      return;
    }

    // The logged-in user changed (login after logout, or a straight switch
    // between accounts) — the previous account's profile is no longer valid.
    // Bump the generation so a fetch already in flight for the old account
    // discards its own result instead of overwriting the new account's data.
    loadGeneration += 1;
    inFlightLoad = null;

    set({
      profile: defaultProfile,
      certificationOptions: [],
      needsCertificationReview: false,
      avatarUrl: null,
      hydrated: false,
      loading: false,
      loadedUserId: userId,
    });
  },
  loadProfile: async () => {
    if (get().hydrated || get().loading) {
      return;
    }

    if (inFlightLoad) {
      return inFlightLoad;
    }

    const generation = loadGeneration;
    set({ loading: true });

    const thisLoad: Promise<void> = fetchProfileSnapshot()
      .then(({ profileData, certData, totalXp }) => {
        // A syncSession() reset happened while this fetch was in flight —
        // its result belongs to a session that's no longer current.
        if (generation !== loadGeneration) return;

        set({
          profile: {
            name: profileData.user?.name ?? "",
            username: profileData.user?.username ?? "",
            certification: profileData.certification ?? "",
            certificationPresetCode: profileData.certificationPresetCode ?? "",
            role: profileData.role ?? "",
            favoriteTheme: profileData.favoriteTheme ?? "",
            totalXp,
            bgImageUrl: profileData.bgImageUrl ?? null,
            themePreset: profileData.themePreset ?? "default",
          },
          needsCertificationReview: Boolean(profileData.needsCertificationReview),
          avatarUrl: profileData.avatarUrl,
          certificationOptions: certData.certifications ?? [],
          hydrated: true,
          loading: false,
        });
      })
      .catch(() => {
        if (generation !== loadGeneration) return;
        set({ hydrated: true, loading: false });
      })
      .finally(() => {
        // Only clear the module-level slot if it's still pointing at this
        // load — a stale load's finally must not drop a newer one that's
        // still in flight.
        if (inFlightLoad === thisLoad) {
          inFlightLoad = null;
        }
      });

    inFlightLoad = thisLoad;
    return thisLoad;
  },
  reloadProfile: async () => {
    set({ loading: true });

    try {
      const { profileData, certData, totalXp } = await fetchProfileSnapshot();
      set({
        profile: {
          name: profileData.user?.name ?? "",
          username: profileData.user?.username ?? "",
          certification: profileData.certification ?? "",
          certificationPresetCode: profileData.certificationPresetCode ?? "",
          role: profileData.role ?? "",
          favoriteTheme: profileData.favoriteTheme ?? "",
          totalXp,
          bgImageUrl: profileData.bgImageUrl ?? null,
          themePreset: profileData.themePreset ?? "default",
          customColors: profileData.customColors ?? null,
        },
        needsCertificationReview: Boolean(profileData.needsCertificationReview),
        avatarUrl: profileData.avatarUrl,
        certificationOptions: certData.certifications ?? [],
        hydrated: true,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
  refreshTotalXp: async () => {
    try {
      const totalXp = await fetchTotalXpFromHistory();
      set((state) => ({
        profile: {
          ...state.profile,
          totalXp,
        },
      }));
    } catch {
      return;
    }
  },
  setProfile: async (next: UserProfile) => {
    const response = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    const data = (await response.json()) as ApiProfileResponse & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Nao foi possivel salvar o perfil.");
    }

    set((state) => ({
      profile: {
        ...state.profile,
        name: data.user?.name ?? "",
        username: data.user?.username ?? "",
        certification: data.certification ?? "",
        certificationPresetCode: data.certificationPresetCode ?? "",
        favoriteTheme: data.favoriteTheme ?? "",
        role: data.role ?? state.profile.role,
        // PUT response doesn't include personalization fields — preserve current state
        bgImageUrl: data.bgImageUrl ?? state.profile?.bgImageUrl,
        themePreset: data.themePreset ?? state.profile?.themePreset,
      },
      needsCertificationReview: Boolean(data.needsCertificationReview),
      avatarUrl: data.avatarUrl ?? null,
      hydrated: true,
    }));

    return data;
  },
  setNeedsCertificationReview: (next) => set({ needsCertificationReview: next }),
  setAvatarUrl: (next) => set({ avatarUrl: next }),
  patchPersonalization: (patch) =>
    set((state) => ({ profile: { ...state.profile, ...patch } })),
}));
