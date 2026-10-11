export const SITE_URL = "https://wijha.ralmatham.ai";
export function navigationKind(
  raw: string
): "internal" | "login" | "external" | "blocked" {
  try {
    const url = new URL(raw);
    if (url.origin === SITE_URL) {
      if (url.pathname === "/auth/google/start") return "login";
      return "internal";
    }
    return url.protocol === "https:" ||
      url.protocol === "mailto:" ||
      url.protocol === "tel:"
      ? "external"
      : "blocked";
  } catch {
    return "blocked";
  }
}
export function parseAuthCallback(raw: string, expectedState: string) {
  const url = new URL(raw);
  if (
    url.protocol !== "wijha:" ||
    url.hostname !== "auth" ||
    url.searchParams.get("state") !== expectedState
  )
    throw new Error("Invalid login callback");
  const code = url.searchParams.get("code");
  if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code))
    throw new Error("Invalid login code");
  return code;
}
