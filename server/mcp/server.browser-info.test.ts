import { describe, expect, it } from "vitest";
import {
  MCP_DEFAULT_AUTHORIZATION_SCOPES,
  shouldShowMcpBrowserInfo,
  WIJHA_MCP_TOOL_NAMES,
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

  it("exposes only the new Idea Lab tool family", () => {
    expect(WIJHA_MCP_TOOL_NAMES).toContain("wijha_get_lab_summary");
    expect(WIJHA_MCP_TOOL_NAMES).toContain("wijha_create_interview");
    expect(WIJHA_MCP_TOOL_NAMES).toContain("wijha_update_experiment");
    expect(WIJHA_MCP_TOOL_NAMES).toContain("wijha_list_tasks");
    expect(WIJHA_MCP_TOOL_NAMES).toContain("wijha_create_task");
    expect(WIJHA_MCP_TOOL_NAMES).toContain("wijha_update_task");
    expect(WIJHA_MCP_TOOL_NAMES.every(name => name.startsWith("wijha_"))).toBe(
      true
    );
    expect(WIJHA_MCP_TOOL_NAMES).not.toContain("wjh_list_tasks");
    expect(new Set(WIJHA_MCP_TOOL_NAMES).size).toBe(
      WIJHA_MCP_TOOL_NAMES.length
    );
  });
});
