"use client";

import { create } from "zustand";
import { CertificationPreset, UserProfile } from "@/lib/types";

type ApiProfileResponse = {
  id: string;
  userId: string;
  certification: string;
  certificationPresetCode: string;
  favoriteTheme: string;
  avatarUrl: string | null;
  needsCertificationReview?: boolean;
  user: { name: string; email: string; username?: string | null };
};

const defaultProfile: UserProfile = {
  name: "",
  username: "",
  certification: "",
  certificationPresetCode: "",
  favoriteTheme: "",
};

type UserProfileState = {
  profile: UserProfile;
  certificationOptions: CertificationPreset[];
  needsCertificationReview: boolean;
  avatarUrl: string | null;
  hydrated: boolean;
  loading: boolean;
  loadProfile: () => Promise<void>;
  setProfile: (next: UserProfile) => Promise<ApiProfileResponse>;
  setNeedsCertificationReview: (next: boolean) => void;
  setAvatarUrl: (next: string | null) => void;
};

let inFlightLoad: Promise<void> | null = null;

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: defaultProfile,
  certificationOptions: [],
  needsCertificationReview: false,
  avatarUrl: null,
  hydrated: false,
  loading: false,
  loadProfile: async () => {
    if (get().hydrated || get().loading) {
      return;
    }

    if (inFlightLoad) {
      return inFlightLoad;
    }

    set({ loading: true });

    inFlightLoad = Promise.all([
      fetch("/api/user/profile").then((r) => r.json()),
      fetch("/api/certifications").then((r) => r.json()),
    ])
      .then(([profileData, certData]: [ApiProfileResponse, { certifications?: CertificationPreset[] }]) => {
        set({
          profile: {
            name: profileData.user?.name ?? "",
            username: profileData.user?.username ?? "",
            certification: profileData.certification ?? "",
            certificationPresetCode: profileData.certificationPresetCode ?? "",
            favoriteTheme: profileData.favoriteTheme ?? "",
          },
          needsCertificationReview: Boolean(profileData.needsCertificationReview),
          avatarUrl: profileData.avatarUrl,
          certificationOptions: certData.certifications ?? [],
          hydrated: true,
          loading: false,
        });
      })
      .catch(() => {
        set({ hydrated: true, loading: false });
      })
      .finally(() => {
        inFlightLoad = null;
      });

    return inFlightLoad;
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

    set({
      profile: {
        name: data.user?.name ?? "",
        username: data.user?.username ?? "",
        certification: data.certification ?? "",
        certificationPresetCode: data.certificationPresetCode ?? "",
        favoriteTheme: data.favoriteTheme ?? "",
      },
      needsCertificationReview: Boolean(data.needsCertificationReview),
      avatarUrl: data.avatarUrl ?? null,
      hydrated: true,
    });

    return data;
  },
  setNeedsCertificationReview: (next) => set({ needsCertificationReview: next }),
  setAvatarUrl: (next) => set({ avatarUrl: next }),
}));
