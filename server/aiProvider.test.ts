import { beforeEach, describe, expect, it, vi } from "vitest";

describe("personal AI settings", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = "test-secret-with-enough-entropy-for-encryption";
  });

  it("encrypts an API key without storing it in the ciphertext", async () => {
    const { decryptPersonalApiKey, encryptPersonalApiKey } = await import(
      "./aiProvider"
    );
    const apiKey = "sk-test-personal-key-123456789";
    const encrypted = encryptPersonalApiKey(apiKey);

    expect(encrypted).not.toContain(apiKey);
    expect(decryptPersonalApiKey(encrypted)).toBe(apiKey);
  });

  it("refuses local URLs before making a request", async () => {
    const { extractPublicSource } = await import("./aiProvider");
    await expect(
      extractPublicSource("http://127.0.0.1:3000/private")
    ).rejects.toThrow("لا يمكن قراءة هذا العنوان");
  });
});
