import { describe, it, expect } from "vitest";
import {
  navigationKind,
  parseAuthCallback,
} from "../mobile-expo/src/lib/navigation";
import { validMobileChallenge, validMobileState } from "./mobileAuth";
describe("mobile navigation boundaries", () => {
  it("keeps only the exact Wijha origin inside the app and opens Google login in the system browser", () => {
    expect(navigationKind("https://wijha.ralmatham.ai/boards/new")).toBe(
      "internal"
    );
    expect(
      navigationKind("https://wijha.ralmatham.ai/auth/google/start?next=/")
    ).toBe("login");
    expect(navigationKind("https://wijha.ralmatham.ai.evil.test/")).toBe(
      "external"
    );
    expect(navigationKind("javascript:alert(1)")).toBe("blocked");
    expect(navigationKind("http://wijha.ralmatham.ai/")).toBe("blocked");
  });
  it("rejects callbacks with the wrong scheme, host, code or state", () => {
    const state = "a".repeat(64),
      code = "b".repeat(43);
    expect(
      parseAuthCallback(`wijha://auth?code=${code}&state=${state}`, state)
    ).toBe(code);
    for (const url of [
      `other://auth?code=${code}&state=${state}`,
      `wijha://other?code=${code}&state=${state}`,
      `wijha://auth?code=${code}&state=wrong`,
      `wijha://auth?code=short&state=${state}`,
    ])
      expect(() => parseAuthCallback(url, state)).toThrow();
  });
  it("validates challenge/state encoding before starting auth", () => {
    expect(validMobileChallenge("a".repeat(64))).toBe(true);
    expect(validMobileChallenge("//evil")).toBe(false);
    expect(validMobileState("a".repeat(64))).toBe(true);
    expect(validMobileState("a".repeat(10000))).toBe(false);
  });
});
