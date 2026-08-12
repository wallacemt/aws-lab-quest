/**
 * getOrCreateActiveJourney must dedupe by certification preset the same way
 * startNewJourney does. Without this, the first lazily-triggered activity
 * write after a preset switch forks a second, empty journey instead of
 * reopening the archived one for that same certification (observed live as
 * duplicate "AWS Certified Cloud Practitioner (CLF-C02)" entries in
 * "Jornadas anteriores", one of them always empty).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    certificationJourney: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma)),
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getOrCreateActiveJourney } from "@/lib/certification-journey";

describe("getOrCreateActiveJourney", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reopens an archived journey for the profile's current preset instead of creating a duplicate", async () => {
    mockPrisma.certificationJourney.findFirst
      .mockResolvedValueOnce(null) // getActiveJourney: no ACTIVE journey
      .mockResolvedValueOnce(null) // re-check inside the transaction
      .mockResolvedValueOnce({ id: "archived-clf-c02", status: "ARCHIVED" }); // existingForPreset match
    mockPrisma.userProfile.findUnique.mockResolvedValue({
      certificationPresetId: "preset-clf-c02",
      certification: "AWS Certified Cloud Practitioner (CLF-C02)",
    });
    mockPrisma.certificationJourney.update.mockResolvedValue({ id: "archived-clf-c02", status: "ACTIVE" });

    const result = await getOrCreateActiveJourney("user-1");

    expect(mockPrisma.certificationJourney.create).not.toHaveBeenCalled();
    expect(mockPrisma.certificationJourney.update).toHaveBeenCalledWith({
      where: { id: "archived-clf-c02" },
      data: { status: "ACTIVE", startedAt: expect.any(Date), endedAt: null },
    });
    expect(result).toEqual({ id: "archived-clf-c02", status: "ACTIVE" });
  });

  it("creates a new journey when no journey exists yet for the current preset", async () => {
    mockPrisma.certificationJourney.findFirst
      .mockResolvedValueOnce(null) // getActiveJourney
      .mockResolvedValueOnce(null) // re-check inside transaction
      .mockResolvedValueOnce(null); // no existing journey for this preset
    mockPrisma.userProfile.findUnique.mockResolvedValue({
      certificationPresetId: "preset-dva-c02",
      certification: "AWS Certified Developer - Associate (DVA-C02)",
    });
    mockPrisma.certificationJourney.create.mockResolvedValue({ id: "new-journey" });

    const result = await getOrCreateActiveJourney("user-1");

    expect(mockPrisma.certificationJourney.update).not.toHaveBeenCalled();
    expect(mockPrisma.certificationJourney.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        certificationPresetId: "preset-dva-c02",
        certificationLabel: "AWS Certified Developer - Associate (DVA-C02)",
      },
    });
    expect(result).toEqual({ id: "new-journey" });
  });
});
