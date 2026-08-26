import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function memberContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "team-member",
      email: "member@example.com",
      name: "عضو فريق",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workspace permissions", () => {
  it("prevents a team member from creating a project", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(caller.workspace.createProject({
      title: "مشروع غير مسموح",
      ownerMemberId: 1,
      startDate: new Date("2026-08-26T00:00:00Z"),
      endDate: new Date("2026-09-26T00:00:00Z"),
      status: "planned",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
