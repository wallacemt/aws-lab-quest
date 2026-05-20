"use client";

import { create } from "zustand";
import { STORAGE_KEYS, safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from "@/lib/storage";

export type AdminMode = "admin" | "user";

type AdminModeState = {
  mode: AdminMode | null;
  hydrated: boolean;
  hydrate: () => void;
  setMode: (mode: AdminMode) => void;
  resetMode: () => void;
};

export const useAdminModeStore = create<AdminModeState>((set) => ({
  mode: null,
  hydrated: false,
  hydrate: () => {
    const stored = safeLocalStorageGet<unknown>(STORAGE_KEYS.adminMode, null);
    const valid: AdminMode | null = stored === "admin" || stored === "user" ? stored : null;
    set({ mode: valid, hydrated: true });
  },
  setMode: (mode) => {
    safeLocalStorageSet(STORAGE_KEYS.adminMode, mode);
    set({ mode });
  },
  resetMode: () => {
    safeLocalStorageRemove(STORAGE_KEYS.adminMode);
    set({ mode: null });
  },
}));
