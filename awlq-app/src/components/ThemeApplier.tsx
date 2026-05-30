"use client";

import { useEffect } from "react";
import { useUserProfileStore } from "@/stores/userProfileStore";
import { findThemePreset } from "@/lib/themes";

export function ThemeApplier() {
  const { profile, hydrated } = useUserProfileStore();

  useEffect(() => {
    if (!hydrated) return;

    const preset = findThemePreset(profile.themePreset ?? "default");
    const root = document.documentElement;

    for (const [key, value] of Object.entries(preset.vars)) {
      root.style.setProperty(key, value);
    }

    if (Object.keys(preset.vars).length === 0) {
      const defaultVarNames = [
        "--pixel-primary",
        "--pixel-accent",
        "--pixel-bg",
        "--pixel-card",
        "--pixel-border",
      ];
      for (const key of defaultVarNames) {
        root.style.removeProperty(key);
      }
    }
  }, [hydrated, profile.themePreset]);

  useEffect(() => {
    if (!hydrated) return;

    const body = document.body;
    const existing = body.style.backgroundImage;
    const bgUrl = profile.bgImageUrl;

    const isPixelArt = bgUrl?.startsWith("/backgrounds/");

    if (bgUrl) {
      body.style.backgroundImage = `url('${bgUrl}')`;
      body.style.backgroundSize = "cover";
      body.style.backgroundAttachment = "fixed";
      body.style.backgroundPosition = "center";
      body.style.imageRendering = isPixelArt ? "pixelated" : "";
    } else if (existing && existing !== "none") {
      body.style.backgroundImage = "";
      body.style.backgroundSize = "";
      body.style.backgroundAttachment = "";
      body.style.backgroundPosition = "";
      body.style.imageRendering = "";
    }
  }, [hydrated, profile.bgImageUrl]);

  return null;
}
