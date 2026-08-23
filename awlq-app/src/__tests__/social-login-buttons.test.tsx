// @vitest-environment jsdom
/**
 * SocialLoginButtons — TC-001 to TC-004
 *
 * Buttons that kick off Better Auth's social sign-in flow. Errors are
 * surfaced to the caller (the login/register screen already has its own
 * error banner) instead of being swallowed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const { mockSignInSocial } = vi.hoisted(() => ({
  mockSignInSocial: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: mockSignInSocial } },
}));

import { SocialLoginButtons } from "@/features/auth/components/SocialLoginButtons";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInSocial.mockResolvedValue({ error: null });
});

describe("TC-001 — SocialLoginButtons: renders both providers", () => {
  it("shows a Google and a GitHub button", () => {
    render(<SocialLoginButtons onError={vi.fn()} />);
    expect(screen.getByRole("button", { name: /google/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /github/i })).toBeTruthy();
  });
});

describe("TC-002 — SocialLoginButtons: clicking Google", () => {
  it("calls authClient.signIn.social with provider google and the given callbackURL", () => {
    render(<SocialLoginButtons onError={vi.fn()} callbackURL="/home" />);
    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    expect(mockSignInSocial).toHaveBeenCalledWith({ provider: "google", callbackURL: "/home" });
  });
});

describe("TC-003 — SocialLoginButtons: clicking GitHub", () => {
  it("calls authClient.signIn.social with provider github", () => {
    render(<SocialLoginButtons onError={vi.fn()} callbackURL="/home" />);
    fireEvent.click(screen.getByRole("button", { name: /github/i }));

    expect(mockSignInSocial).toHaveBeenCalledWith({ provider: "github", callbackURL: "/home" });
  });
});

describe("TC-004 — SocialLoginButtons: surfaces provider errors", () => {
  it("calls onError with the message when Better Auth returns an error", async () => {
    mockSignInSocial.mockResolvedValue({ error: { message: "Provedor nao configurado." } });
    const onError = vi.fn();

    render(<SocialLoginButtons onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("Provedor nao configurado."));
  });

  it("does not call onError when the provider call succeeds", async () => {
    const onError = vi.fn();
    render(<SocialLoginButtons onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: /github/i }));

    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("TC-005 — SocialLoginButtons: disabled state", () => {
  it("disables both buttons when disabled=true", () => {
    render(<SocialLoginButtons onError={vi.fn()} disabled />);
    expect((screen.getByRole("button", { name: /google/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /github/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});

/**
 * TC-006 — Sourcery review (PR #59): a rejected authClient.signIn.social()
 * promise (network failure, unexpected client error) was never caught, so
 * it became an unhandled promise rejection and onError was never called —
 * the user would see no login error at all.
 */
describe("TC-006 — SocialLoginButtons: a rejected promise still surfaces an error", () => {
  it("calls onError when authClient.signIn.social() throws instead of resolving with { error }", async () => {
    mockSignInSocial.mockRejectedValue(new Error("Network request failed"));
    const onError = vi.fn();

    render(<SocialLoginButtons onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("Network request failed"));
  });
});
