/**
 * Admin email send route tests — covers both the pre-existing template-based
 * send and the new raw compose send (subject+html, no saved template),
 * including the new "specific-users" target mode.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockRequireAdmin, mockPrisma } = vi.hoisted(() => {
  const mockRequireAdmin = vi.fn();
  const mockPrisma = {
    adminEmailTemplate: {
      findUnique: vi.fn(),
    },
    workerTrigger: {
      create: vi.fn(),
    },
  };
  return { mockRequireAdmin, mockPrisma };
});

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST as sendEmail } from "@/app/api/admin/email/send/route";

const ADMIN_OK = { ok: true as const, userId: "admin-1", email: "admin@test.com", role: "admin" };
const NOT_ADMIN = {
  ok: false as const,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/email/send", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(ADMIN_OK);
});

describe("POST /api/admin/email/send — auth gate", () => {
  it("returns 403 without an admin session", async () => {
    mockRequireAdmin.mockResolvedValue(NOT_ADMIN);

    const res = await sendEmail(makeRequest({ templateId: "t1" }));

    expect(res.status).toBe(403);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/email/send — template mode (existing behavior)", () => {
  it("queues a WorkerTrigger for an active template", async () => {
    mockPrisma.adminEmailTemplate.findUnique.mockResolvedValue({ id: "t1", active: true });

    const res = await sendEmail(makeRequest({ templateId: "t1", targetMode: "all-users" }));

    expect(res.status).toBe(200);
    expect(mockPrisma.workerTrigger.create).toHaveBeenCalledWith({
      data: {
        action: "email-send",
        payload: {
          templateId: "t1",
          subject: null,
          html: null,
          targetMode: "all-users",
          userId: null,
          userIds: null,
        },
      },
    });
  });

  it("returns 404 for an inactive/missing template", async () => {
    mockPrisma.adminEmailTemplate.findUnique.mockResolvedValue(null);

    const res = await sendEmail(makeRequest({ templateId: "missing" }));

    expect(res.status).toBe(404);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/email/send — raw compose mode (new)", () => {
  it("queues a WorkerTrigger with raw subject+html when no templateId is given", async () => {
    const res = await sendEmail(
      makeRequest({ subject: "Assunto avulso", html: "<p>Ola {{name}}</p>", targetMode: "all-users" }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.adminEmailTemplate.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.workerTrigger.create).toHaveBeenCalledWith({
      data: {
        action: "email-send",
        payload: {
          templateId: null,
          subject: "Assunto avulso",
          html: "<p>Ola {{name}}</p>",
          targetMode: "all-users",
          userId: null,
          userIds: null,
        },
      },
    });
  });

  it("returns 400 when neither templateId nor subject+html are provided", async () => {
    const res = await sendEmail(makeRequest({ targetMode: "all-users" }));

    expect(res.status).toBe(400);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();
  });

  it("returns 400 when only subject is provided without html", async () => {
    const res = await sendEmail(makeRequest({ subject: "So assunto", targetMode: "all-users" }));

    expect(res.status).toBe(400);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/email/send — specific-users target mode (new)", () => {
  it("queues userIds for specific-users mode", async () => {
    const res = await sendEmail(
      makeRequest({
        subject: "Oi",
        html: "<p>Oi</p>",
        targetMode: "specific-users",
        userIds: ["u1", "u2"],
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.workerTrigger.create).toHaveBeenCalledWith({
      data: {
        action: "email-send",
        payload: {
          templateId: null,
          subject: "Oi",
          html: "<p>Oi</p>",
          targetMode: "specific-users",
          userId: null,
          userIds: ["u1", "u2"],
        },
      },
    });
  });

  it("returns 400 when specific-users mode has no userIds", async () => {
    const res = await sendEmail(
      makeRequest({ subject: "Oi", html: "<p>Oi</p>", targetMode: "specific-users", userIds: [] }),
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();
  });
});
