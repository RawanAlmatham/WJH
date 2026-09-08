import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isAllowedOAuthRedirectUri,
  isAllowedOAuthClientMetadataUrl,
  parseOAuthClientMetadataDocument,
  verifyPkceChallenge,
} from "./oauthRoutes";
import { normalizeOAuthScopes } from "./oauthStore";

describe("Athr MCP OAuth validation", () => {
  it("allows HTTPS callbacks and local HTTP callbacks", () => {
    expect(
      isAllowedOAuthRedirectUri(
        "https://chatgpt.com/connector_platform_oauth_redirect"
      )
    ).toBe(true);
    expect(isAllowedOAuthRedirectUri("http://localhost:8787/callback")).toBe(
      true
    );
    expect(isAllowedOAuthRedirectUri("http://127.0.0.1:3000/callback")).toBe(
      true
    );
  });

  it("rejects insecure remote, credentialed, and fragmented callbacks", () => {
    expect(isAllowedOAuthRedirectUri("http://example.com/callback")).toBe(
      false
    );
    expect(
      isAllowedOAuthRedirectUri("https://user:pass@example.com/callback")
    ).toBe(false);
    expect(
      isAllowedOAuthRedirectUri("https://example.com/callback#fragment")
    ).toBe(false);
    expect(isAllowedOAuthRedirectUri("javascript:alert(1)")).toBe(false);
  });

  it("verifies an S256 PKCE challenge", () => {
    const verifier = "athr-test-verifier-which-is-long-enough-1234567890";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkceChallenge(verifier, challenge)).toBe(true);
    expect(verifyPkceChallenge(verifier, `${challenge}x`)).toBe(false);
    expect(verifyPkceChallenge("short", challenge)).toBe(false);
  });

  it("normalizes supported scopes and rejects unknown access", () => {
    expect(normalizeOAuthScopes("athr:read athr:write athr:read")).toEqual([
      "athr:read",
      "athr:write",
    ]);
    expect(() => normalizeOAuthScopes("athr:admin")).toThrow(
      "صلاحية OAuth غير مدعومة"
    );
  });

  it("accepts trusted ChatGPT and Claude client metadata URLs", () => {
    expect(
      isAllowedOAuthClientMetadataUrl("https://chatgpt.com/oauth/client.json")
    ).toBe(true);
    expect(
      isAllowedOAuthClientMetadataUrl(
        "https://chatgpt.com/oauth/callback_123/client.json"
      )
    ).toBe(true);
    expect(
      isAllowedOAuthClientMetadataUrl(
        "https://claude.ai/oauth/mcp-oauth-client-metadata"
      )
    ).toBe(true);
    expect(
      isAllowedOAuthClientMetadataUrl("https://example.com/oauth/client.json")
    ).toBe(false);
    expect(
      isAllowedOAuthClientMetadataUrl(
        "https://chatgpt.com/oauth/client.json?redirect=evil"
      )
    ).toBe(false);
    expect(
      isAllowedOAuthClientMetadataUrl(
        "https://claude.ai/oauth/mcp-oauth-client-metadata?redirect=evil"
      )
    ).toBe(false);
  });

  it("validates ChatGPT CIMD metadata for a public PKCE client", () => {
    const clientId = "https://chatgpt.com/oauth/client.json";
    expect(
      parseOAuthClientMetadataDocument(clientId, {
        client_id: clientId,
        client_name: "ChatGPT",
        redirect_uris: [
          "https://chatgpt.com/connector_platform_oauth_redirect",
        ],
        token_endpoint_auth_method: "private_key_jwt",
        token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      })
    ).toMatchObject({
      clientId,
      clientName: "ChatGPT",
      tokenEndpointAuthMethod: "none",
    });
  });

  it("validates Claude CIMD metadata for its public PKCE client", () => {
    const clientId = "https://claude.ai/oauth/mcp-oauth-client-metadata";
    expect(
      parseOAuthClientMetadataDocument(clientId, {
        client_id: clientId,
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      })
    ).toMatchObject({
      clientId,
      clientName: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      tokenEndpointAuthMethod: "none",
    });
  });
});
