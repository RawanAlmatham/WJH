import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getActiveBoardId: vi.fn(async () => 17),
  hasBoardRole: vi.fn(async (_userId: number, roles: string[]) =>
    roles.includes("manager")
  ),
  canUserAccessDeliverable: vi.fn(async () => true),
  createTeamInvitation: vi.fn(async () => ({
    token: "x".repeat(32),
    memberId: 8,
    invitePath: `/invite/${"x".repeat(32)}`,
    accessRole: "member",
  })),
  getInvitationByToken: vi.fn(async (token: string) => ({
    invitation: { token, status: "pending", email: "new.member@example.com" },
    member: { id: 8, name: "موظف جديد", role: "أخصائي عمليات" },
  })),
  addDeliverableComment: vi.fn(async () => undefined),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function managerContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "department-manager",
      email: "manager@example.com",
      name: "مدير القسم",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workspace invitation and delivery comment flow", () => {
  it("creates a member invitation and returns a dedicated acceptance path", async () => {
    const caller = appRouter.createCaller(managerContext());
    await expect(
      caller.workspace.inviteMember({
        name: "موظف جديد",
        teamRole: "أخصائي عمليات",
        email: "new.member@example.com",
        accessRole: "member",
      })
    ).resolves.toEqual({
      token: "x".repeat(32),
      memberId: 8,
      invitePath: `/invite/${"x".repeat(32)}`,
      accessRole: "member",
    });
  });

  it("retrieves the pending invitation for the acceptance screen", async () => {
    const caller = appRouter.createCaller(managerContext());
    await expect(
      caller.workspace.invitationByToken({ token: "x".repeat(32) })
    ).resolves.toMatchObject({
      invitation: { status: "pending" },
      member: { name: "موظف جديد" },
    });
  });

  it("allows the department manager to add a comment to a deliverable", async () => {
    const caller = appRouter.createCaller(managerContext());
    await expect(
      caller.workspace.addDeliverableComment({
        deliverableId: 1,
        body: "يرجى مراجعة ملخص التوصيات قبل الاعتماد.",
      })
    ).resolves.toBeUndefined();
  });
});
