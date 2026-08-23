"use client";

import { useState } from "react";
import Image from "next/image";
import { PixelButton } from "@/components/ui/pixel-button";
import { ONBOARDING_IMAGES } from "@/lib/onboarding";

export function OnboardingGallery() {
  const [index, setIndex] = useState(0);
  const image = ONBOARDING_IMAGES[index]!;

  function goTo(next: number) {
    setIndex((next + ONBOARDING_IMAGES.length) % ONBOARDING_IMAGES.length);
  }

  return (
    <div className="space-y-2 border-2 w-92 mx-auto border-[var(--pixel-border)] bg-[var(--pixel-card)] p-2 shadow-[4px_4px_0_0_var(--pixel-shadow)]">
      <div className="relative aspect-square w-full overflow-hidden border-2 border-[var(--pixel-border)]">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(max-width: 340px) 100vw, 576px"
          className="object-cover"
          priority={index === 0}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <PixelButton
          type="button"
          variant="ghost"
          className="px-2 py-1"
          onClick={() => goTo(index - 1)}
          aria-label="Imagem anterior"
        >
          ‹
        </PixelButton>
        <div className="flex gap-1.5">
          {ONBOARDING_IMAGES.map((img, i) => (
            <button
              key={img.src}
              type="button"
              aria-label={`Ver imagem ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-2.5 w-2.5 border-2 border-[var(--pixel-border)] ${
                i === index ? "bg-[var(--pixel-primary)]" : "bg-transparent"
              }`}
            />
          ))}
        </div>
        <PixelButton
          type="button"
          variant="ghost"
          className="px-2 py-1"
          onClick={() => goTo(index + 1)}
          aria-label="Proxima imagem"
        >
          ›
        </PixelButton>
      </div>
    </div>
  );
}
