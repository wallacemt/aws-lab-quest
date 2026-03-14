"use client";

import { useCallback, useEffect, useState } from "react";
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

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [certificationOptions, setCertificationOptions] = useState<CertificationPreset[]>([]);
  const [needsCertificationReview, setNeedsCertificationReview] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/user/profile").then((r) => r.json()), fetch("/api/certifications").then((r) => r.json())])
      .then(([profileData, certData]: [ApiProfileResponse, { certifications?: CertificationPreset[] }]) => {
        setProfileState({
          name: profileData.user?.name ?? "",
          username: profileData.user?.username ?? "",
          certification: profileData.certification ?? "",
          certificationPresetCode: profileData.certificationPresetCode ?? "",
          favoriteTheme: profileData.favoriteTheme ?? "",
        });
        setNeedsCertificationReview(Boolean(profileData.needsCertificationReview));
        setAvatarUrl(
          profileData.avatarUrl ??
            "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/avatars/49f46e8c-1062-4a9d-adbd-f92027e75e31.jpg",
        );
        setCertificationOptions(certData.certifications ?? []);
      })
      .catch(() => void 0)
      .finally(() => setHydrated(true));
  }, []);

  const setProfile = useCallback(async (next: UserProfile) => {
    const response = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    const data = (await response.json()) as ApiProfileResponse & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Nao foi possivel salvar o perfil.");
    }

    setProfileState({
      name: data.user?.name ?? "",
      username: data.user?.username ?? "",
      certification: data.certification ?? "",
      certificationPresetCode: data.certificationPresetCode ?? "",
      favoriteTheme: data.favoriteTheme ?? "",
    });
    setNeedsCertificationReview(Boolean(data.needsCertificationReview));
    setAvatarUrl(data.avatarUrl ?? null);

    return data;
  }, []);

  const isProfileComplete = Boolean(
    profile.name.trim() &&
    profile.username.trim() &&
    profile.certification.trim() &&
    profile.certificationPresetCode.trim() &&
    profile.favoriteTheme.trim(),
  );

  return {
    profile,
    setProfile,
    hydrated,
    isProfileComplete,
    certificationOptions,
    needsCertificationReview,
    setNeedsCertificationReview,
    avatarUrl,
    setAvatarUrl,
  };
}
