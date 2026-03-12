"use client";

import { ReactNode } from "react";
import { CreatorCredits } from "@/components/CreatorCredits";
import { Header } from "@/components/Header";

type AppLayoutProps = {
  children: ReactNode;
  /** Pass current XP to show the XP badge in the header (quest screen only). */
  xp?: number;
  /** Show the CreatorCredits footer. Defaults to false. */
  credits?: boolean;
  /** Render the credits in compact mode. */
  creditsCompact?: boolean;
};

export function AppLayout({ children, xp, credits = false, creditsCompact = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen pb-12">
      <Header xp={xp} />
      {children}
      {credits && <CreatorCredits compact={creditsCompact} />}
    </div>
  );
}
