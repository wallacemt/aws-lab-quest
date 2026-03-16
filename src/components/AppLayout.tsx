"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

type AppLayoutProps = {
  children: ReactNode;
  /** Pass current XP to show the XP badge in the header (quest screen only). */
  xp?: number;
  /** Show the CreatorCredits footer. Defaults to false. */
  credits?: boolean;
  /** Render the credits in compact mode. */
  creditsCompact?: boolean;
};

export function AppLayout({ children, xp, credits = false, creditsCompact = true }: AppLayoutProps) {
  void xp;
  void credits;
  void creditsCompact;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      {children}
    </motion.div>
  );
}
