"use client";

import { useEffect } from "react";
import { useUserProfileStore } from "@/stores/userProfileStore";
import { findThemePreset, ALL_PIXEL_VARS } from "@/lib/themes";

// Shadcn vars that mirror the active pixel preset so light/dark mode
// class changes don't create contrast conflicts with custom themes.
const SHADCN_SYNC_MAP: Record<string, string> = {
  "--background": "--pixel-bg",
  "--foreground": "--pixel-text",
  "--card": "--pixel-card",
  "--card-foreground": "--pixel-text",
  "--border": "--pixel-border",
  "--muted": "--pixel-muted",
  "--muted-foreground": "--pixel-subtext",
};
const SHADCN_VARS = Object.keys(SHADCN_SYNC_MAP);

export function ThemeApplier() {
  const { profile, hydrated, loading, loadProfile } = useUserProfileStore();

  // ThemeApplier lives above AppRouteShell in the tree, so it must trigger
  // profile loading itself to apply themes on all routes (auth, public, admin).
  useEffect(() => {
    if (!hydrated && !loading) {
      void loadProfile();
    }
  }, [hydrated, loading, loadProfile]);

  // Apply pixel theme preset vars + sync shadcn vars to prevent
  // light/dark mode conflicts when a custom preset is active.
  useEffect(() => {
    if (!hydrated) return;

    const preset = findThemePreset(profile.themePreset ?? "default");
    const root = document.documentElement;

    if (Object.keys(preset.vars).length > 0) {
      // Apply all pixel vars from the preset
      for (const [key, value] of Object.entries(preset.vars)) {
        root.style.setProperty(key, value);
      }
      // Mirror into shadcn vars so components using text-foreground / bg-background
      // stay consistent regardless of the .dark class state.
      for (const [shadcnVar, pixelVar] of Object.entries(SHADCN_SYNC_MAP)) {
        const val = preset.vars[pixelVar];
        if (val) root.style.setProperty(shadcnVar, val);
      }
    } else {
      // Default preset: remove all inline overrides so CSS class vars take over
      for (const key of ALL_PIXEL_VARS) {
        root.style.removeProperty(key);
      }
      for (const key of SHADCN_VARS) {
        root.style.removeProperty(key);
      }
    }
  }, [hydrated, profile.themePreset]);

  // Apply background image to body and signal data-has-bg on <html> so
  // CSS adaptive shell rules (.pixel-shell, .pixel-bg-adaptive) can react.
  useEffect(() => {
    if (!hydrated) return;

    const root = document.documentElement;
    const body = document.body;
    const bgUrl = profile.bgImageUrl;
    const isPixelArt = bgUrl?.startsWith("/backgrounds/");

    if (bgUrl) {
      body.style.backgroundImage = `url('${bgUrl}')`;
      body.style.backgroundSize = "cover";
      body.style.backgroundAttachment = "fixed";
      body.style.backgroundPosition = "center";
      body.style.imageRendering = isPixelArt ? "pixelated" : "";
      root.setAttribute("data-has-bg", "1");
    } else {
      const existing = body.style.backgroundImage;
      if (existing && existing !== "none") {
        body.style.backgroundImage = "";
        body.style.backgroundSize = "";
        body.style.backgroundAttachment = "";
        body.style.backgroundPosition = "";
        body.style.imageRendering = "";
      }
      root.removeAttribute("data-has-bg");
    }
  }, [hydrated, profile.bgImageUrl]);

  return null;
}
