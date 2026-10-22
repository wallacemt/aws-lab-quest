import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../services/email.js";
const input = { to: "recipient@example.com", subject: "Welcome", html: "<p>Hello</p>" };
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "no-reply@example.com");
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Resend transport", () => {
  it("sends the existing email content via Resend", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "email-1" }));
    await sendEmail(input);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers.Authorization).toBe("Bearer test-key");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body)).toEqual({ ...input, to: [input.to], from: "no-reply@example.com" });
  });
  it.each(["RESEND_API_KEY", "RESEND_FROM_EMAIL"])("fails before sending without %s", async key => {
    vi.stubEnv(key, "");
    await expect(sendEmail(input)).rejects.toThrow("obrigatórias");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 422, 429, 500])("propagates HTTP %i for worker retry", async status => {
    fetchMock.mockResolvedValue(Response.json({ message: "secret details" }, { status }));
    await expect(sendEmail(input)).rejects.toThrow(`HTTP ${status}`);
  });
  it("rejects malformed success responses", async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    await expect(sendEmail(input)).rejects.toThrow("inválida");
  });
  it("propagates network and timeout errors", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    await expect(sendEmail(input)).rejects.toThrow("timeout");
  });
});
