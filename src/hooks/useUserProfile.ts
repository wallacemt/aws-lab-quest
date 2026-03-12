"use client";

import { useCallback, useEffect, useState } from "react";
import { UserProfile } from "@/lib/types";

type ApiProfileResponse = {
  id: string;
  userId: string;
  certification: string;
  favoriteTheme: string;
  avatarUrl: string | null;
  user: { name: string; email: string };
};

const defaultProfile: UserProfile = {
  name: "",
  certification: "",
  favoriteTheme: "",
};

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data: ApiProfileResponse) => {
        setProfileState({
          name: data.user?.name ?? "",
          certification: data.certification ?? "",
          favoriteTheme: data.favoriteTheme ?? "",
        });
        setAvatarUrl(data.avatarUrl ?? null);
      })
      .catch(() => void 0)
      .finally(() => setHydrated(true));
  }, []);

  const setProfile = useCallback(async (next: UserProfile) => {
    // Optimistic update
    setProfileState(next);
    try {
      await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      // Silently fail — the UI state is already updated
    }
  }, []);

  const isProfileComplete = Boolean(profile.name.trim() && profile.certification.trim());

  return {
    profile,
    setProfile,
    hydrated,
    isProfileComplete,
    avatarUrl,
    setAvatarUrl,
  };
}
