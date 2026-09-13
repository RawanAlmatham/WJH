import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getAdminOverview: vi.fn(async () => ({
    managerCount: 0,
    boardCount: 0,
    memberCount: 0,
    userCount: 1,
    pendingInvitationCount: 0,
    boards: [],
    managers: [],
    invitations: [],
  })),
  createManagerInvitation: vi.fn(async () => ({
    token: "m".repeat(32),
    invitePath: `/manager-invite/${"m".repeat(32)}`,
  })),
  createManagementBoard: vi.fn(async (name: string) => ({
    id: 31,
    name,
    membershipRole: "manager",
  })),
  updateBoardMemberAccess: vi.fn(async () => ({ success: true })),
  setBoardMemberActive: vi.fn(async () => ({ success: true })),
}));

import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "user" | "manager" | "admin"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-account`,
      email: `${role}@example.com`,
      name: role,
      loginMethod: "local",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("platform administration", () => {
  it("lets the platform admin invite a department manager", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(
      caller.admin.inviteManager({
        name: "مدير قسم",
        email: "manager@example.com",
      })
    ).resolves.toMatchObject({
      invitePath: expect.stringContaining("/manager-invite/"),
    });
    expect(db.createManagerInvitation).toHaveBeenCalledWith(
      { name: "مدير قسم", email: "manager@example.com" },
      1
    );
  });

  it("prevents a regular user from opening platform administration", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets the platform admin update a board member access role", async () => {
    const caller = appRouter.createCaller(context("admin"));

    await expect(
      caller.admin.updateBoardMemberAccess({
        memberId: 14,
        accessRole: "manager",
      })
    ).resolves.toEqual({ success: true });
    expect(db.updateBoardMemberAccess).toHaveBeenCalledWith({
      memberId: 14,
      accessRole: "manager",
      actingUserId: 1,
    });
  });

  it("lets the platform admin suspend a board member", async () => {
    const caller = appRouter.createCaller(context("admin"));

    await expect(
      caller.admin.setBoardMemberActive({ memberId: 14, active: false })
    ).resolves.toEqual({ success: true });
    expect(db.setBoardMemberActive).toHaveBeenCalledWith({
      memberId: 14,
      active: false,
      actingUserId: 1,
    });
  });

  it("lets a department manager create an independent board", async () => {
    const caller = appRouter.createCaller(context("manager"));
    await expect(
      caller.boards.create({ name: "إدارة التواصل", template: "work" })
    ).resolves.toMatchObject({
      id: 31,
      name: "إدارة التواصل",
      membershipRole: "manager",
    });
  });

  it("lets any authenticated user create a board", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(
      caller.boards.create({ name: "لوحة جديدة", template: "work" })
    ).resolves.toMatchObject({
      name: "لوحة جديدة",
      membershipRole: "manager",
    });
  });
});
