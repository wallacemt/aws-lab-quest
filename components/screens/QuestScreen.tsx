"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CelebrationScreen } from "@/components/CelebrationScreen";
import { CreatorCredits } from "@/components/CreatorCredits";
import { Header } from "@/components/Header";
import { TasksBoard } from "@/components/TasksBoard";
import { UserProfileModal } from "@/components/UserProfileModal";
import { XPPanel } from "@/components/XPPanel";
import { useQuest } from "@/hooks/useQuest";
import { useUserProfile } from "@/hooks/useUserProfile";

export function QuestScreen() {
  const router = useRouter();
  const { profile, setProfile, hydrated: userHydrated } = useUserProfile();
  const {
    activeQuest,
    hydrated: questHydrated,
    xp,
    completedCount,
    toggleTask,
    finishQuest,
    clearActiveQuest,
  } = useQuest();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const allDone = Boolean(activeQuest?.tasks.length && activeQuest.tasks.every((task) => task.completed));

  useEffect(() => {
    if (!questHydrated || !userHydrated) {
      return;
    }

    if (allDone && activeQuest && !activeQuest.completed) {
      finishQuest(profile);
    }
  }, [activeQuest, allDone, finishQuest, profile, questHydrated, userHydrated]);

  useEffect(() => {
    if (userHydrated && questHydrated && !activeQuest) {
      router.replace("/");
    }
  }, [activeQuest, questHydrated, router, userHydrated]);

  if (!activeQuest) {
    return null;
  }

  return (
    <div className="min-h-screen pb-12">
      <Header xp={xp} name={profile.name} onEditProfile={() => setShowProfileModal(true)} />
      <main className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-8 xl:grid-cols-[420px_minmax(0,1fr)] xl:px-8">
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <XPPanel xp={xp} />
        </div>
        <TasksBoard tasks={activeQuest.tasks} completedCount={completedCount} onToggle={toggleTask} />
      </main>

      <CelebrationScreen
        open={Boolean(activeQuest.completed)}
        xp={xp}
        theme={activeQuest.theme}
        onRestart={() => {
          clearActiveQuest();
          router.push("/");
        }}
      />

      <UserProfileModal
        profile={profile}
        onSave={setProfile}
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      <CreatorCredits compact />
    </div>
  );
}
