import { describe, expect, it } from "vitest";
import { maskPersonalData } from "@/features/mcp/server/pii-mask";

describe("maskPersonalData", () => {
  it("masks every email in free text while preserving surrounding text", () => {
    expect(maskPersonalData("Contato: joao.silva@example.com, por favor.")).toBe(
      "Contato: j***@e***.com, por favor.",
    );
    expect(maskPersonalData("a@google.com e b@test.com.br")).toBe(
      "a***@g***.com e b***@t***.br",
    );
  });

  it("masks email fields and redacts every designated key at any depth", () => {
    const keys = ["ip", "ipAddress", "lastUsedIp", "userAgent", "phone", "cpf", "birthDate", "image", "avatarUrl", "accessDecisionReason"];
    const input = {
      email: "person@example.com",
      nested: Object.fromEntries(keys.map((key) => [key, "private"])),
    };

    expect(maskPersonalData(input)).toEqual({
      email: "p***@e***.com",
      nested: Object.fromEntries(keys.map((key) => [key, "[redacted]"])),
    });
  });

  it("reduces names and usernames on email-bearing person objects", () => {
    expect(maskPersonalData({ email: "maria@example.com", name: "Maria João da Silva", username: "Usuario123" })).toEqual({
      email: "m***@e***.com",
      name: "M. J. D. S.",
      username: "u***",
    });
  });

  it("recognizes people by parent key, including arrays under plural users", () => {
    expect(maskPersonalData({
      author: { name: "João Silva", username: "joao", id: "a1" },
      users: [{ name: "Maria", username: "maria" }],
      member: { name: "Ana" },
    })).toEqual({
      author: { name: "J. S.", username: "j***", id: "a1" },
      users: [{ name: "M.", username: "m***" }],
      member: { name: "A." },
    });
  });

  it("preserves IDs and leaves non-person names unchanged", () => {
    expect(maskPersonalData({
      email: "x@example.com",
      name: "João Silva",
      id: "user-1",
      userId: "user-1",
      tokenId: "token-1",
      boss: { name: "Dragão Flamejante" },
    })).toEqual({
      email: "x***@e***.com",
      name: "J. S.",
      id: "user-1",
      userId: "user-1",
      tokenId: "token-1",
      boss: { name: "Dragão Flamejante" },
    });
  });

  it("does not mutate input and handles valid empty/null values", () => {
    const input = { email: "a@example.com" };
    expect(maskPersonalData(input)).not.toBe(input);
    expect(input.email).toBe("a@example.com");
    expect(maskPersonalData(null)).toBeNull();
    expect(maskPersonalData([])).toEqual([]);
    expect(maskPersonalData({})).toEqual({});
  });
});
