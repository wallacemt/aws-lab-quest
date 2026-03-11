"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { STORAGE_KEYS } from "@/lib/storage";
import { UserProfile } from "@/lib/types";

const defaultProfile: UserProfile = {
  name: "",
  certification: "",
  favoriteTheme: "",
};

export function useUserProfile() {
  const state = useLocalStorage<UserProfile>(STORAGE_KEYS.user, defaultProfile);

  const isProfileComplete = useMemo(() => {
    const p = state.value;
    return Boolean(p.name.trim() && p.certification.trim());
  }, [state.value]);

  return {
    profile: state.value,
    setProfile: state.setValue,
    hydrated: state.hydrated,
    isProfileComplete,
  };
}
