/**
 * Onboarding — missing required fields — TC-001 to TC-004
 *
 * LSF: onboarding used to redirect straight into `UserProfileModal` (or the
 * profile page) with no indication of *which* fields were still missing —
 * the checklist only lived in a one-shot welcome overlay that disappeared
 * after the first choice. `getMissingProfileFields` gives any onboarding UI
 * a reliable, always-current list to render.
 */

import { describe, it, expect } from "vitest";
import { getMissingProfileFields } from "@/lib/onboarding";
import type { UserProfile } from "@/lib/types";

const COMPLETE_PROFILE: UserProfile = {
  name: "Ana",
  username: "ana_dev",
  certification: "AWS Solutions Architect Associate",
  certificationPresetCode: "SAA-C03",
  favoriteTheme: "games",
};

describe("TC-001 — getMissingProfileFields: complete profile", () => {
  it("returns an empty list when every required field is filled", () => {
    expect(getMissingProfileFields(COMPLETE_PROFILE)).toEqual([]);
  });
});

describe("TC-002 — getMissingProfileFields: fresh/empty profile", () => {
  it("lists all four required fields for a brand-new profile", () => {
    const fresh: UserProfile = {
      name: "",
      username: "",
      certification: "",
      certificationPresetCode: "",
      favoriteTheme: "",
    };

    const missing = getMissingProfileFields(fresh).map((f) => f.key);
    expect(missing).toEqual(["name", "username", "certificationPresetCode", "favoriteTheme"]);
  });
});

describe("TC-003 — getMissingProfileFields: partially filled profile", () => {
  it("only lists the fields that are still blank", () => {
    const partial: UserProfile = { ...COMPLETE_PROFILE, username: "", favoriteTheme: "   " };

    const missing = getMissingProfileFields(partial).map((f) => f.key);
    expect(missing).toEqual(["username", "favoriteTheme"]);
  });

  it("treats whitespace-only values as missing", () => {
    const whitespaceName: UserProfile = { ...COMPLETE_PROFILE, name: "   " };
    expect(getMissingProfileFields(whitespaceName).map((f) => f.key)).toEqual(["name"]);
  });
});

describe("TC-004 — getMissingProfileFields: human-readable labels", () => {
  it("pairs every missing field with a PT-BR label", () => {
    const fresh: UserProfile = {
      name: "",
      username: "",
      certification: "",
      certificationPresetCode: "",
      favoriteTheme: "",
    };

    const missing = getMissingProfileFields(fresh);
    expect(missing.every((f) => typeof f.label === "string" && f.label.length > 0)).toBe(true);
  });
});

/**
 * TC-005 — Sourcery review (PR #59): getMissingProfileFields only checked
 * `certificationPresetCode`, but `useUserProfile.isProfileComplete` also
 * requires `certification` to be non-empty. A profile with a preset code
 * but no certification name showed an empty checklist (looks complete)
 * while the app stayed locked as incomplete, with no explanation why.
 */
describe("TC-005 — getMissingProfileFields: certification must agree with certificationPresetCode", () => {
  it("flags the certification field as missing when certificationPresetCode is set but certification is blank", () => {
    const mismatched: UserProfile = { ...COMPLETE_PROFILE, certification: "" };
    const missing = getMissingProfileFields(mismatched).map((f) => f.key);
    expect(missing).toContain("certificationPresetCode");
  });

  it("flags it when certification is set but certificationPresetCode is blank", () => {
    const mismatched: UserProfile = { ...COMPLETE_PROFILE, certificationPresetCode: "" };
    const missing = getMissingProfileFields(mismatched).map((f) => f.key);
    expect(missing).toContain("certificationPresetCode");
  });
});
