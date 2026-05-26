"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { getLevel } from "@/lib/levels";
import { AchievementToast } from "./AchievementToast";
import { LevelUpToast } from "./LevelUpToast";

export type NewAchievement = {
  code: string;
  name: string;
  description: string;
  rarity: string;
  imageUrl?: string | null;
};

export type ProgressPayload = {
  prevXp: number;
  newXp: number;
  newAchievements: NewAchievement[];
};

export function useProgressNotifications() {
  return useCallback((payload: ProgressPayload) => {
    const { prevXp, newXp, newAchievements } = payload;

    const prevLevel = getLevel(prevXp);
    const newLevel = getLevel(newXp);

    if (newLevel.number > prevLevel.number) {
      toast.custom(() => LevelUpToast({ level: newLevel }), {
        duration: 5000,
        position: "top-center",
      });
    }

    newAchievements.forEach((achievement, index) => {
      setTimeout(() => {
        toast.custom(() => AchievementToast({ achievement }), {
          duration: 6000,
          position: "top-center",
        });
      }, (index + 1) * 700);
    });
  }, []);
}
