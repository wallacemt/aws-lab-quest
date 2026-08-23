// @vitest-environment jsdom
/**
 * UserProfileModal — onboarding checklist banner — TC-001 to TC-002
 *
 * LSF: onboarding used to open this modal with no indication of which
 * fields were still required — the checklist lived in a separate one-shot
 * overlay that vanished after the first choice. The modal now always shows
 * exactly what's missing, computed live from the current draft.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { UserProfileModal } from "@/components/ui/user-profile-modal";
import type { UserProfile } from "@/lib/types";

afterEach(() => {
  cleanup();
});

const BASE_PROPS = {
  onSave: vi.fn(),
  onClose: vi.fn(),
  certificationOptions: [],
  currentUsername: "ana_dev",
};

describe("TC-001 — UserProfileModal: incomplete profile shows the missing-fields checklist", () => {
  it("lists exactly the fields that are still blank", () => {
    const incomplete: UserProfile = {
      name: "Ana",
      username: "",
      certification: "",
      certificationPresetCode: "",
      favoriteTheme: "",
    };

    render(<UserProfileModal {...BASE_PROPS} profile={incomplete} open />);

    expect(screen.getByText(/complete estes campos/i)).toBeTruthy();
    const checklist = within(screen.getByRole("list"));
    expect(checklist.getByText("Nome de usuário")).toBeTruthy();
    expect(checklist.getByText("Certificação AWS alvo")).toBeTruthy();
    expect(checklist.getByText("Tema favorito")).toBeTruthy();
    expect(checklist.queryByText("Nome de exibição")).toBeNull();
  });
});

describe("TC-002 — UserProfileModal: complete profile hides the checklist", () => {
  it("does not render the checklist banner when every field is filled", () => {
    const complete: UserProfile = {
      name: "Ana",
      username: "ana_dev",
      certification: "AWS Solutions Architect Associate",
      certificationPresetCode: "SAA-C03",
      favoriteTheme: "games",
    };

    render(<UserProfileModal {...BASE_PROPS} profile={complete} open />);

    expect(screen.queryByText(/complete estes campos/i)).toBeNull();
  });
});
