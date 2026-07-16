/**
 * Flashcard reminder worker test suite — TC-104
 *
 * Test-Report-001 / DEF-005 fix: replaces the shadow-test version that used
 * to live in awlq-app's retention.test.ts (local reimplementations of
 * escapeHtml/grouping/cooldown). This exercises the real exported functions
 * from flashcard-reminder.worker.ts, including a full run of
 * processFlashcardReminderJob against mocked prisma/sendEmail.
 *
 * Scenario: user A has a due card with opted-in notifications, user B is
 * opted out, user C is still within the cooldown window, and one of A's
 * card fronts contains a <script> tag.
 *   -> sendEmail must be called exactly once (for A only)
 *   -> the email body must have the front HTML-escaped
 *   -> a UserEmailEvent must be recorded for A
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockSendEmail } = vi.hoisted(() => {
  const mockPrisma = {
    flashcard: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    userEmailEvent: { findFirst: vi.fn(), create: vi.fn() },
    adminEmailTemplate: { findUnique: vi.fn() },
  };
  const mockSendEmail = vi.fn();
  return { mockPrisma, mockSendEmail };
});

vi.mock("../prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../services/email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/email.js")>();
  return { ...actual, sendEmail: mockSendEmail };
});
vi.mock("../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// processFlashcardReminderJob doesn't use the queue connection at all — only
// createFlashcardReminderWorker (untested here) does — but the worker module
// imports it at the top level, so it still needs a mock to avoid pulling in
// the real ioredis/config module chain (which requires DATABASE_URL etc.).
vi.mock("../queues/index.js", () => ({ connection: {} }));

import {
  escapeHtml,
  groupFrontsByUser,
  shouldSendReminder,
  processFlashcardReminderJob,
} from "../workers/flashcard-reminder.worker.js";

beforeEach(() => {
  vi.clearAllMocks();
  // No admin override by default — falls back to the built-in branded template.
  mockPrisma.adminEmailTemplate.findUnique.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("escapeHtml", () => {
  it("neutralizes HTML/script injection from a user-created card front", () => {
    const escaped = escapeHtml(`<script>alert('xss')</script>`);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toBe("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("O que e uma VPC?")).toBe("O que e uma VPC?");
  });
});

describe("groupFrontsByUser", () => {
  it("sends one digest per user, not one email per card", () => {
    const byUser = groupFrontsByUser([
      { userId: "user-a", front: "Q1" },
      { userId: "user-a", front: "Q2" },
      { userId: "user-b", front: "Q3" },
    ]);

    expect(byUser.size).toBe(2);
    expect(byUser.get("user-a")).toEqual(["Q1", "Q2"]);
    expect(byUser.get("user-b")).toEqual(["Q3"]);
  });
});

describe("shouldSendReminder", () => {
  const now = new Date("2026-07-03T13:00:00Z");

  it("sends when the user has never received a reminder", () => {
    expect(shouldSendReminder({ emailNotifications: true, lastReminderSentAt: null, now })).toBe(true);
  });

  it("skips within the 20h cooldown window", () => {
    const lastReminderSentAt = new Date("2026-07-03T02:00:00Z"); // 11h ago
    expect(shouldSendReminder({ emailNotifications: true, lastReminderSentAt, now })).toBe(false);
  });

  it("sends again once the cooldown has elapsed", () => {
    const lastReminderSentAt = new Date("2026-07-02T12:00:00Z"); // 25h ago
    expect(shouldSendReminder({ emailNotifications: true, lastReminderSentAt, now })).toBe(true);
  });

  it("never sends when the user opted out of emails", () => {
    expect(shouldSendReminder({ emailNotifications: false, lastReminderSentAt: null, now })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TC-104: full processFlashcardReminderJob orchestration
// ---------------------------------------------------------------------------

describe("TC-104: processFlashcardReminderJob — grouping, cooldown, opt-out, escaping", () => {
  it("emails only the opted-in, non-cooldown user, with an escaped body, and records the send", async () => {
    mockPrisma.flashcard.findMany.mockResolvedValue([
      { userId: "user-a", front: `<script>alert('xss')</script>` },
      { userId: "user-b", front: "Q-b" },
      { userId: "user-c", front: "Q-c" },
    ]);

    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "user-a") return { email: "a@example.com", name: "Aluno A", emailNotifications: true };
      if (where.id === "user-b") return { email: "b@example.com", name: "Aluno B", emailNotifications: false };
      if (where.id === "user-c") return { email: "c@example.com", name: "Aluno C", emailNotifications: true };
      return null;
    });

    // user-c has a recent event inside the cooldown window; user-a has none.
    mockPrisma.userEmailEvent.findFirst.mockImplementation(async ({ where }: { where: { userId: string } }) => {
      if (where.userId === "user-c") return { sentAt: new Date() };
      return null;
    });

    mockSendEmail.mockResolvedValue(undefined);
    mockPrisma.userEmailEvent.create.mockResolvedValue({ id: "event-1" });

    await processFlashcardReminderJob();

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [sendArgs] = mockSendEmail.mock.calls[0]!;
    expect(sendArgs.to).toBe("a@example.com");
    expect(sendArgs.html).not.toContain("<script>");
    expect(sendArgs.html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");

    expect(mockPrisma.userEmailEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userEmailEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-a" }) }),
    );
  });

  it("does nothing when there are no due cards", async () => {
    mockPrisma.flashcard.findMany.mockResolvedValue([]);

    await processFlashcardReminderJob();

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Admin-editable template (AdminEmailTemplate code "flashcard-due-reminder")
// ---------------------------------------------------------------------------

describe("processFlashcardReminderJob — admin template override", () => {
  beforeEach(() => {
    mockPrisma.flashcard.findMany.mockResolvedValue([{ userId: "user-a", front: "Q1" }]);
    mockPrisma.user.findUnique.mockResolvedValue({
      email: "a@example.com",
      name: "Aluno A",
      emailNotifications: true,
    });
    mockPrisma.userEmailEvent.findFirst.mockResolvedValue(null);
    mockPrisma.userEmailEvent.create.mockResolvedValue({ id: "event-1" });
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("renders the admin-edited subject/html instead of the built-in fallback", async () => {
    mockPrisma.adminEmailTemplate.findUnique.mockResolvedValue({
      subject: "Ei {{name}}, {{count}} card{{plural}} te esperando!",
      html: "<p>Oi {{name}}</p>{{card_list}}<a href='{{app_url}}/flashcards'>ir</a>",
      active: true,
    });

    await processFlashcardReminderJob();

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [sendArgs] = mockSendEmail.mock.calls[0]!;
    expect(sendArgs.subject).toBe("Ei Aluno A, 1 card te esperando!");
    expect(sendArgs.html).toContain("<p>Oi Aluno A</p>");
    expect(sendArgs.html).toContain("Q1");
  });

  it("skips sending entirely when the admin deactivates the template", async () => {
    mockPrisma.adminEmailTemplate.findUnique.mockResolvedValue({
      subject: "irrelevant",
      html: "irrelevant",
      active: false,
    });

    await processFlashcardReminderJob();

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
