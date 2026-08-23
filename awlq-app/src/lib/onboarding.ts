import type { UserProfile } from "@/lib/types";

export type OnboardingStep = "manual" | "profile";

export type MissingProfileField = {
  key: "name" | "username" | "certificationPresetCode" | "favoriteTheme";
  label: string;
  isMissing: (profile: UserProfile) => boolean;
};

// Certification is picked as one unit (a dropdown sets certificationPresetCode
// and certification together), so it's a single checklist entry — but
// isProfileComplete (useUserProfile.ts) requires both fields non-empty, so
// this must check both too, or a profile with one set and the other blank
// would show an empty checklist ("looks complete") while the app stays
// locked as incomplete. (Sourcery review, PR #59.)
const REQUIRED_PROFILE_FIELDS: MissingProfileField[] = [
  { key: "name", label: "Nome de exibição", isMissing: (p) => !p.name.trim() },
  { key: "username", label: "Nome de usuário", isMissing: (p) => !p.username.trim() },
  {
    key: "certificationPresetCode",
    label: "Certificação AWS alvo",
    isMissing: (p) => !p.certificationPresetCode.trim() || !p.certification.trim(),
  },
  { key: "favoriteTheme", label: "Tema favorito", isMissing: (p) => !p.favoriteTheme.trim() },
];

/** Fields still needed before the app is unlocked — used to give the onboarding UI something concrete to point at instead of a generic "complete your profile". */
export function getMissingProfileFields(profile: UserProfile): MissingProfileField[] {
  return REQUIRED_PROFILE_FIELDS.filter((field) => field.isMissing(profile));
}

export type OnboardingImage = { src: string; alt: string };

/** Welcome-carousel art shown in UserProfileModal while onboarding — one beat per screen: greeting, choose a mode, battle, level up. */
export const ONBOARDING_IMAGES: OnboardingImage[] = [
  { src: "/onboarding/onboarding-1.png", alt: "Astronauta acenando ao lado de um painel de controle na nuvem" },
  { src: "/onboarding/onboarding-2.png", alt: "Astronauta escolhendo entre os portais de Lab, Arena e Simulado" },
  { src: "/onboarding/onboarding-3.png", alt: "Astronauta batalhando contra um chefe na Arena" },
  { src: "/onboarding/onboarding-4.png", alt: "Astronauta comemorando um level up com a badge AWS Cloud Practitioner" },
];

const ONBOARDING_STORAGE_KEY = "awlq_onboarding_step";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getOnboardingStep(): OnboardingStep | null {
  if (!canUseStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  return value === "manual" || value === "profile" ? value : null;
}

export function setOnboardingStep(step: OnboardingStep) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, step);
}

export function clearOnboardingStep() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}
