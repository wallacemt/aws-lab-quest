// @vitest-environment jsdom
/**
 * OnboardingGallery — TC-001 to TC-004
 *
 * Rotating welcome-image carousel shown inside UserProfileModal while the
 * profile is incomplete. Manual navigation only (no timers) — a modal that
 * opens/closes shouldn't carry interval cleanup edge cases for something
 * this decorative.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OnboardingGallery } from "@/components/ui/onboarding-gallery";
import { ONBOARDING_IMAGES } from "@/lib/onboarding";

afterEach(() => {
  cleanup();
});

describe("TC-001 — OnboardingGallery: shows the first image by default", () => {
  it("renders the first onboarding image's alt text", () => {
    render(<OnboardingGallery />);
    expect(screen.getByAltText(ONBOARDING_IMAGES[0]!.alt)).toBeTruthy();
  });

  it("renders one dot per image", () => {
    render(<OnboardingGallery />);
    const dots = screen.getAllByRole("button", { name: /ver imagem/i });
    expect(dots).toHaveLength(ONBOARDING_IMAGES.length);
  });
});

describe("TC-002 — OnboardingGallery: next/prev navigation", () => {
  it("advances to the second image on next", () => {
    render(<OnboardingGallery />);
    fireEvent.click(screen.getByRole("button", { name: /proxima imagem/i }));
    expect(screen.getByAltText(ONBOARDING_IMAGES[1]!.alt)).toBeTruthy();
  });

  it("wraps from the last image back to the first on next", () => {
    render(<OnboardingGallery />);
    const nextButton = screen.getByRole("button", { name: /proxima imagem/i });
    for (let i = 0; i < ONBOARDING_IMAGES.length; i++) {
      fireEvent.click(nextButton);
    }
    expect(screen.getByAltText(ONBOARDING_IMAGES[0]!.alt)).toBeTruthy();
  });

  it("wraps from the first image back to the last on prev", () => {
    render(<OnboardingGallery />);
    fireEvent.click(screen.getByRole("button", { name: /imagem anterior/i }));
    expect(screen.getByAltText(ONBOARDING_IMAGES[ONBOARDING_IMAGES.length - 1]!.alt)).toBeTruthy();
  });
});

describe("TC-003 — OnboardingGallery: jump directly to an image via dots", () => {
  it("shows the third image when its dot is clicked", () => {
    render(<OnboardingGallery />);
    fireEvent.click(screen.getByRole("button", { name: "Ver imagem 3" }));
    expect(screen.getByAltText(ONBOARDING_IMAGES[2]!.alt)).toBeTruthy();
  });
});

describe("TC-004 — OnboardingGallery: exposes all 4 welcome images", () => {
  it("has exactly 4 onboarding images configured", () => {
    expect(ONBOARDING_IMAGES).toHaveLength(4);
  });

  it("every image points at a local /onboarding/ public asset", () => {
    for (const image of ONBOARDING_IMAGES) {
      expect(image.src).toMatch(/^\/onboarding\/.+\.png$/);
    }
  });
});
