"use client";

import "./landing.css";
import type { Session } from "@/lib/auth";
import { LandingHeader } from "./sections/LandingHeader";
import { HeroSection } from "./sections/HeroSection";
import { MissionSection } from "./sections/MissionSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { DemoVideosSection } from "./sections/DemoVideosSection";
import { CTASection } from "./sections/CTASection";

type Props = {
  session: Session | null;
};

export default function LandingPage({ session }: Props) {
  const user = session?.user
    ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      }
    : null;

  return (
    <div className="landing-page">
      <LandingHeader user={user} />
      <HeroSection authenticated={!!user} />
      <MissionSection />
      <FeaturesSection />
      <DemoVideosSection />
      <CTASection authenticated={!!user} />
    </div>
  );
}
