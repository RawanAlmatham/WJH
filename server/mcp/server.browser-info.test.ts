import { describe, expect, it } from "vitest";
import {
  MCP_DEFAULT_AUTHORIZATION_SCOPES,
  shouldShowMcpBrowserInfo,
} from "./server";

describe("WJH MCP browser information page", () => {
  it("requests read and write access when an MCP client authenticates", () => {
    expect(MCP_DEFAULT_AUTHORIZATION_SCOPES).toBe("wjh:read wjh:write");
  });

  it("shows the status page only for unauthenticated browser navigation", () => {
    expect(shouldShowMcpBrowserInfo("GET", "text/html", "")).toBe(true);
    expect(
      shouldShowMcpBrowserInfo("GET", "text/html", "Bearer wjh_at_example")
    ).toBe(false);
  });

  it("preserves MCP client requests and write methods", () => {
    expect(shouldShowMcpBrowserInfo("GET", "text/event-stream", "")).toBe(
      false
    );
    expect(
      shouldShowMcpBrowserInfo(
        "POST",
        "application/json, text/event-stream",
        ""
      )
    ).toBe(false);
  });
});
