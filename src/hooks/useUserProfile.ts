"use client";

import { useEffect } from "react";
import { useUserProfileStore } from "@/stores/userProfileStore";

export function useUserProfile() {
  const {
    profile,
    certificationOptions,
    needsCertificationReview,
    avatarUrl,
    hydrated,
    loading,
    loadProfile,
    reloadProfile,
    refreshTotalXp,
    setProfile,
    setNeedsCertificationReview,
    setAvatarUrl,
  } = useUserProfileStore();

  useEffect(() => {
    if (!hydrated && !loading) {
      void loadProfile();
    }
  }, [hydrated, loadProfile, loading]);

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
    refreshTotalXp,
    reloadProfile,
    hydrated,
    isProfileComplete,
    certificationOptions,
    needsCertificationReview,
    setNeedsCertificationReview,
    avatarUrl,
    setAvatarUrl,
  };
}
