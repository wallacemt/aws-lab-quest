export type OnboardingStep = "manual" | "profile";

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
