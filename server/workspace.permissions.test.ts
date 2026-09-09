import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getActiveBoardId: vi.fn(async () => 23),
  hasBoardRole: vi.fn(async (_userId: number, roles: string[]) =>
    roles.includes("member")
  ),
  canUserAccessProject: vi.fn(async () => true),
  canUserAccessTask: vi.fn(async () => true),
  canUserAccessDeliverable: vi.fn(async () => true),
  canUserAccessResearchFeedItem: vi.fn(async () => true),
  canUserAccessLesson: vi.fn(async () => true),
  canUserAccessCalendarEvent: vi.fn(async () => true),
  createProject: vi.fn(async () => undefined),
  updateProject: vi.fn(async () => ({ success: true })),
  deleteProject: vi.fn(async () => ({ success: true })),
  updateTask: vi.fn(async () => ({ success: true })),
  updateTaskSupport: vi.fn(async () => ({ success: true })),
  deleteTask: vi.fn(async () => ({ success: true })),
  createLessonLearned: vi.fn(async () => ({ id: 71 })),
  updateLessonLearned: vi.fn(async () => ({ success: true })),
  deleteLessonLearned: vi.fn(async () => ({ success: true })),
  createCalendarEvent: vi.fn(async () => ({ id: 72 })),
  updateCalendarEvent: vi.fn(async () => ({ success: true })),
  deleteCalendarEvent: vi.fn(async () => ({ success: true })),
  createAnnualGoal: vi.fn(async () => ({ id: 44 })),
  updateAnnualGoal: vi.fn(async () => ({ success: true })),
  deleteAnnualGoal: vi.fn(async () => ({ success: true })),
  createTeamInvitation: vi.fn(async () => undefined),
  reissueTeamInvitation: vi.fn(async () => ({
    memberId: 12,
    token: "replacement-token",
    invitePath: "/invite/replacement-token",
  })),
  deleteTeamMember: vi.fn(async () => ({ success: true })),
  addDeliverableComment: vi.fn(async () => undefined),
  getBoardTeamAdministration: vi.fn(async () => ({
    board: { id: 23, name: "لوحة القسم" },
    members: [],
  })),
  updateBoardMemberAccess: vi.fn(async () => ({ success: true })),
  updateTeamMemberProjectAccess: vi.fn(async () => ({ success: true })),
  setBoardMemberActive: vi.fn(async () => ({ success: true })),
  updateBoardModules: vi.fn(
    async (_boardId: number, enabledModules: string[]) => ({
      enabledModules,
    })
  ),
  updateBoardPresentationSections: vi.fn(
    async (_boardId: number, presentationSections: string[]) => ({
      presentationSections,
    })
  ),
  getResearchFeed: vi.fn(async () => ({ interests: [], items: [] })),
  createResearchInterest: vi.fn(async () => ({ id: 91 })),
  updateResearchInterest: vi.fn(async () => ({ success: true })),
  setResearchInterestActive: vi.fn(async () => ({ success: true })),
  deleteResearchInterest: vi.fn(async () => ({ success: true })),
  refreshResearchInterest: vi.fn(async () => ({ fetched: 3, skipped: false })),
  refreshBoardResearchFeed: vi.fn(async () => ({
    interests: 1,
    fetched: 3,
    failures: 0,
  })),
  linkResearchFeedItemToProject: vi.fn(async () => ({ success: true })),
  saveResearchFeedArabicTranslations: vi.fn(async input => ({
    updated: input.translations.length,
    ids: input.translations.map((item: { id: number }) => item.id),
  })),
}));
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function memberContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "team-member",
      email: "member@example.com",
      name: "عضو فريق",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function adminContext(): TrpcContext {
  const ctx = memberContext();
  return {
    ...ctx,
    user: { ...ctx.user!, id: 1, openId: "platform-admin", role: "admin" },
  };
}

function managerContext(): TrpcContext {
  const ctx = memberContext();
  return {
    ...ctx,
    user: { ...ctx.user!, id: 3, openId: "board-manager", role: "manager" },
  };
}

describe("workspace permissions", () => {
  it("allows a team member to create a project", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.createProject({
        title: "مشروع غير مسموح",
        ownerMemberId: 1,
        responsibleMemberIds: [1, 2],
        startDate: new Date("2026-08-26T00:00:00Z"),
        endDate: new Date("2026-09-26T00:00:00Z"),
        status: "planned",
      })
    ).resolves.toBeUndefined();
    expect(db.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: 23,
        ownerMemberId: 1,
        responsibleMemberIds: [1, 2],
      })
    );
  });

  it("allows a team member to create an ongoing project without an end date", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.createProject({
        title: "مشروع مستمر",
        ownerMemberId: 1,
        startDate: new Date("2026-09-07T00:00:00Z"),
        endDate: null,
        status: "in_progress",
      })
    ).resolves.toBeUndefined();
    expect(db.createProject).toHaveBeenLastCalledWith(
      expect.objectContaining({ boardId: 23, endDate: null })
    );
  });

  it("allows a team member to edit and delete projects and tasks in the active board", async () => {
    const caller = appRouter.createCaller(memberContext());
    await caller.workspace.updateProject({
      id: 8,
      title: "المشروع المحدّث",
      annualGoalId: null,
      ownerMemberId: 1,
      responsibleMemberIds: [1, 2],
      startDate: new Date("2026-09-07T00:00:00Z"),
      endDate: null,
      status: "in_progress",
    });
    await caller.workspace.updateTask({
      id: 12,
      title: "المهمة المحدّثة",
      projectId: 8,
      assigneeMemberId: 2,
      startDate: new Date("2026-09-07T00:00:00Z"),
      dueDate: new Date("2026-09-10T00:00:00Z"),
      priority: "high",
      status: "in_progress",
    });
    await caller.workspace.deleteTask({ id: 12 });
    await caller.workspace.deleteProject({ id: 8 });
    expect(db.updateProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 8, boardId: 23 })
    );
    expect(db.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, boardId: 23 })
    );
    expect(db.deleteTask).toHaveBeenCalledWith(12, 23);
    expect(db.deleteProject).toHaveBeenCalledWith(8, 23);
  });

  it("blocks a restricted member from opening a project outside their assigned list", async () => {
    vi.mocked(db.canUserAccessProject).mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.updateProjectStatus({ id: 999, status: "in_progress" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "هذا المشروع غير متاح لحسابك",
    });
  });

  it("blocks a restricted member from changing a task in a hidden project", async () => {
    vi.mocked(db.canUserAccessTask).mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.updateTaskStatus({ id: 999, status: "complete" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "هذه المهمة غير متاحة لحسابك",
    });
  });

  it("lets a team member document a lesson only in the active board", async () => {
    const caller = appRouter.createCaller(memberContext());
    const lessonDate = new Date("2026-09-07T09:00:00Z");
    await expect(
      caller.workspace.createLessonLearned({
        title: "درس اختبار",
        projectId: 8,
        category: "improvement",
        lesson: "إشراك المستفيدين في وقت مبكر حسّن جودة النتيجة.",
        recommendation: "إضافة جلسة استكشاف في بداية كل مشروع.",
        lessonDate,
      })
    ).resolves.toEqual({ id: 71 });
    expect(db.createLessonLearned).toHaveBeenCalledWith({
      title: "درس اختبار",
      projectId: 8,
      category: "improvement",
      lesson: "إشراك المستفيدين في وقت مبكر حسّن جودة النتيجة.",
      recommendation: "إضافة جلسة استكشاف في بداية كل مشروع.",
      lessonDate,
      boardId: 23,
      createdByUserId: 2,
    });
  });

  it("enforces project access when an MCP-backed member edits a lesson", async () => {
    vi.mocked(db.canUserAccessLesson).mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.updateLessonLearned({
        id: 71,
        title: "درس مخفي",
        projectId: 999,
        category: "risk",
        lesson: "لا ينبغي أن يقدر العضو على تعديله.",
        lessonDate: new Date("2026-09-08T09:00:00Z"),
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "هذا الدرس مرتبط بمشروع غير متاح لحسابك",
    });
    expect(db.updateLessonLearned).not.toHaveBeenCalled();
  });

  it("allows a member to add, update, and delete a calendar event in their scope", async () => {
    const caller = appRouter.createCaller(memberContext());
    const eventDate = new Date("2026-09-12T09:00:00Z");
    await expect(
      caller.workspace.createCalendarEvent({
        title: "مراجعة المشروع",
        projectId: 8,
        eventDate,
        type: "review",
      })
    ).resolves.toEqual({ id: 72 });
    await expect(
      caller.workspace.updateCalendarEvent({
        id: 72,
        title: "إطلاق المشروع",
        projectId: 8,
        eventDate,
        type: "launch",
      })
    ).resolves.toEqual({ success: true });
    await expect(
      caller.workspace.deleteCalendarEvent({ id: 72 })
    ).resolves.toEqual({ success: true });
    expect(db.createCalendarEvent).toHaveBeenCalledWith({
      title: "مراجعة المشروع",
      projectId: 8,
      eventDate,
      type: "review",
      boardId: 23,
    });
    expect(db.updateCalendarEvent).toHaveBeenCalledWith({
      id: 72,
      title: "إطلاق المشروع",
      projectId: 8,
      eventDate,
      type: "launch",
      boardId: 23,
    });
    expect(db.deleteCalendarEvent).toHaveBeenCalledWith(72, 23);
  });

  it("lets a team member request support for a task in the active board", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.updateTaskSupport({
        id: 12,
        needsSupport: true,
        supportRequest: "أحتاج مراجعة المحتوى قبل الاعتماد",
      })
    ).resolves.toEqual({ success: true });
    expect(db.updateTaskSupport).toHaveBeenCalledWith({
      id: 12,
      needsSupport: true,
      supportRequest: "أحتاج مراجعة المحتوى قبل الاعتماد",
      boardId: 23,
    });
  });

  it("requires a description when a task requests support", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.updateTaskSupport({
        id: 12,
        needsSupport: true,
        supportRequest: "",
      })
    ).rejects.toThrow();
  });

  it("keeps annual goal creation with the board manager", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.createAnnualGoal({
        title: "هدف سنوي",
        theme: "التحول الرقمي",
        year: 2026,
        ownerMemberId: 1,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows the platform admin to create an annual goal in the active board", async () => {
    const caller = appRouter.createCaller(adminContext());
    await expect(
      caller.workspace.createAnnualGoal({
        title: "هدف سنوي",
        theme: "التحول الرقمي",
        year: 2026,
        ownerMemberId: 1,
      })
    ).resolves.toEqual({ id: 44 });
    expect(db.createAnnualGoal).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: 23, ownerMemberId: 1 })
    );
  });

  it("prevents a team member from inviting another employee", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.inviteMember({
        name: "موظف جديد",
        teamRole: "أخصائي عمليات",
        email: "new.member@example.com",
        accessRole: "member",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents a regular member from changing team access", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.updateTeamMemberAccess({
        memberId: 12,
        accessRole: "viewer",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a board manager manage access only through the active board", async () => {
    vi.mocked(db.hasBoardRole).mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(managerContext());
    await expect(
      caller.workspace.updateTeamMemberAccess({
        memberId: 12,
        accessRole: "viewer",
      })
    ).resolves.toEqual({ success: true });
    expect(db.updateBoardMemberAccess).toHaveBeenCalledWith({
      memberId: 12,
      accessRole: "viewer",
      boardId: 23,
      actingUserId: 3,
    });
  });

  it("lets a board manager reissue a pending invitation", async () => {
    vi.mocked(db.hasBoardRole).mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(managerContext());
    await expect(
      caller.workspace.reissueTeamInvitation({ memberId: 12 })
    ).resolves.toMatchObject({ invitePath: "/invite/replacement-token" });
    expect(db.reissueTeamInvitation).toHaveBeenCalledWith({
      memberId: 12,
      boardId: 23,
      invitedByUserId: 3,
    });
  });

  it("lets a board manager delete an unlinked member from the active board", async () => {
    vi.mocked(db.hasBoardRole).mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(managerContext());
    await expect(
      caller.workspace.deleteTeamMember({ memberId: 12 })
    ).resolves.toEqual({ success: true });
    expect(db.deleteTeamMember).toHaveBeenCalledWith({
      memberId: 12,
      boardId: 23,
      actingUserId: 3,
    });
  });

  it("lets a board manager customize the active board modules", async () => {
    vi.mocked(db.hasBoardRole).mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(managerContext());
    const enabledModules = ["projects", "tasks", "team", "reports"] as const;
    await expect(
      caller.workspace.updateBoardModules({
        enabledModules: [...enabledModules],
      })
    ).resolves.toEqual({ enabledModules: [...enabledModules] });
    expect(db.updateBoardModules).toHaveBeenCalledWith(23, [...enabledModules]);
  });

  it("prevents a regular member from customizing board modules", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.updateBoardModules({ enabledModules: ["tasks"] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets only a board manager customize presentation sections", async () => {
    const memberCaller = appRouter.createCaller(memberContext());
    await expect(
      memberCaller.workspace.updateBoardPresentationSections({
        presentationSections: ["completion", "projects", "team"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    vi.mocked(db.hasBoardRole).mockResolvedValueOnce(true);
    const managerCaller = appRouter.createCaller(managerContext());
    await expect(
      managerCaller.workspace.updateBoardPresentationSections({
        presentationSections: ["completion", "projects", "team"],
      })
    ).resolves.toEqual({
      presentationSections: ["completion", "projects", "team"],
    });
    expect(db.updateBoardPresentationSections).toHaveBeenCalledWith(23, [
      "completion",
      "projects",
      "team",
    ]);
  });

  it("shows the active board research feed to every member", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(caller.workspace.researchFeed()).resolves.toEqual({
      interests: [],
      items: [],
    });
    expect(db.getResearchFeed).toHaveBeenCalledWith(23, 2);
  });

  it("lets a team member add research topics and refresh their results", async () => {
    const memberCaller = appRouter.createCaller(memberContext());
    await expect(
      memberCaller.workspace.createResearchInterest({
        name: "معالجة اللغة العربية",
        keywords: ["Arabic NLP", "Arabic language model"],
      })
    ).resolves.toEqual({ id: 91 });
    await expect(
      memberCaller.workspace.refreshResearchInterest({ id: 91 })
    ).resolves.toEqual({ fetched: 3, skipped: false });
    expect(db.createResearchInterest).toHaveBeenCalledWith({
      name: "معالجة اللغة العربية",
      keywords: ["Arabic NLP", "Arabic language model"],
      boardId: 23,
      createdByUserId: 2,
    });
    expect(db.refreshResearchInterest).toHaveBeenCalledWith(91, 23);
  });

  it("keeps research topic editing and deletion with the board manager", async () => {
    const memberCaller = appRouter.createCaller(memberContext());
    await expect(
      memberCaller.workspace.updateResearchInterest({
        id: 91,
        name: "موضوع معدل",
        keywords: ["Arabic evaluation"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    vi.mocked(db.hasBoardRole).mockResolvedValueOnce(true);
    const managerCaller = appRouter.createCaller(managerContext());
    await expect(
      managerCaller.workspace.updateResearchInterest({
        id: 91,
        name: "موضوع معدل",
        keywords: ["Arabic evaluation"],
      })
    ).resolves.toEqual({ success: true });
  });

  it("lets a team member link a feed item to a project in the active board", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.linkResearchFeedItem({ id: 17, projectId: 8 })
    ).resolves.toEqual({ success: true });
    expect(db.linkResearchFeedItemToProject).toHaveBeenCalledWith({
      id: 17,
      projectId: 8,
      boardId: 23,
    });
  });

  it("lets a team member save Arabic translations only for visible feed items", async () => {
    const caller = appRouter.createCaller(memberContext());
    const translation =
      "تقدم هذه الدراسة إطارًا لتقييم النماذج اللغوية عبر مجموعة متنوعة من المهام والمعايير.";
    await expect(
      caller.workspace.saveResearchFeedTranslations({
        translations: [{ id: 17, abstractArabic: translation }],
      })
    ).resolves.toEqual({ updated: 1, ids: [17] });
    expect(db.canUserAccessResearchFeedItem).toHaveBeenCalledWith(2, 23, 17);
    expect(db.saveResearchFeedArabicTranslations).toHaveBeenCalledWith({
      translations: [{ id: 17, abstractArabic: translation }],
      boardId: 23,
      translatedByUserId: 2,
    });

    vi.mocked(db.canUserAccessResearchFeedItem).mockResolvedValueOnce(false);
    await expect(
      caller.workspace.saveResearchFeedTranslations({
        translations: [{ id: 999, abstractArabic: translation }],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a team member to comment on a deliverable", async () => {
    const caller = appRouter.createCaller(memberContext());
    await expect(
      caller.workspace.addDeliverableComment({
        deliverableId: 1,
        body: "يرجى تحديث المسودة.",
      })
    ).resolves.toBeUndefined();
    expect(db.addDeliverableComment).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: 23 })
    );
  });
});
