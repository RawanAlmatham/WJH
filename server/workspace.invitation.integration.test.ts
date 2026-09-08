import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  annualGoals,
  boardMemberships,
  deliverableComments,
  deliverables,
  lessonsLearned,
  managementBoards,
  projectMembers,
  projects,
  tasks,
  teamInvitations,
  teamMembers,
  users,
} from "../drizzle/schema";
import {
  acceptTeamInvitation,
  addDeliverableComment,
  createAnnualGoal,
  createLessonLearned,
  createManagementBoard,
  createTeamInvitation,
  getDb,
  getInvitationByToken,
  getWorkspaceData,
  updateBoardMemberAccess,
  upsertUser,
} from "./db";
import { appRouter } from "./routers";
import { DEFAULT_BOARD_MODULES } from "@shared/boardModules";

const marker = `invite-test-${Date.now()}`;
const invitationEmail = `${marker}@example.test`;
const managerEmail = `${marker}-manager@example.test`;
const linkJoinerEmail = `${marker}-link@example.test`;
const pendingMemberEmail = `${marker}-pending@example.test`;
let managerId = 0;
let acceptedUserId = 0;
let invitedMemberId = 0;
let linkJoinerId = 0;
let baseBoardId = 0;
let baseProjectId = 0;
let baseDeliverableId = 0;
let annualGoalId = 0;
let lessonId = 0;
let managerMemberId = 0;

describe.skipIf(!process.env.DATABASE_URL)(
  "persistent invitation journey",
  () => {
    beforeAll(async () => {
      const db = await getDb();
      if (!db)
        throw new Error(
          "Database connection is required for invitation integration test"
        );
      const result = await db.insert(users).values({
        openId: `${marker}-manager`,
        email: managerEmail,
        name: "مدير اختبار",
        loginMethod: "test",
        role: "admin",
        lastSignedIn: new Date(),
      });
      managerId = Number(result[0].insertId);
      const board = await createManagementBoard(marker, managerId);
      baseBoardId = board.id;
      const managerMember = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(eq(teamMembers.userId, managerId))
        .limit(1);
      managerMemberId = managerMember[0]!.id;
      const projectResult = await db.insert(projects).values({
        boardId: baseBoardId,
        title: `${marker}-base`,
        ownerMemberId: managerMemberId,
        startDate: new Date("2026-09-01T00:00:00Z"),
        endDate: new Date("2026-10-01T00:00:00Z"),
        progress: 0,
        status: "planned",
      });
      baseProjectId = Number(projectResult[0].insertId);
      const deliverableResult = await db.insert(deliverables).values({
        projectId: baseProjectId,
        title: `${marker}-deliverable`,
        progress: 0,
        status: "not_started",
      });
      baseDeliverableId = Number(deliverableResult[0].insertId);
    });

    afterAll(async () => {
      const db = await getDb();
      if (!db) return;
      const boards = await db
        .select({ id: managementBoards.id })
        .from(managementBoards)
        .where(eq(managementBoards.name, marker));
      await db.delete(tasks).where(eq(tasks.title, marker));
      await db
        .delete(lessonsLearned)
        .where(eq(lessonsLearned.boardId, baseBoardId));
      const createdProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.title, marker));
      if (createdProjects.length)
        await db.delete(projectMembers).where(
          inArray(
            projectMembers.projectId,
            createdProjects.map(project => project.id)
          )
        );
      await db.delete(projects).where(eq(projects.title, marker));
      await db
        .delete(teamInvitations)
        .where(eq(teamInvitations.email, invitationEmail));
      await db
        .delete(teamInvitations)
        .where(eq(teamInvitations.email, pendingMemberEmail));
      await db
        .delete(deliverableComments)
        .where(eq(deliverableComments.body, marker));
      if (baseDeliverableId)
        await db
          .delete(deliverables)
          .where(eq(deliverables.id, baseDeliverableId));
      if (baseProjectId)
        await db.delete(projects).where(eq(projects.id, baseProjectId));
      if (annualGoalId)
        await db.delete(annualGoals).where(eq(annualGoals.id, annualGoalId));
      for (const board of boards)
        await db
          .delete(boardMemberships)
          .where(eq(boardMemberships.boardId, board.id));
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.email, invitationEmail));
      await db.delete(teamMembers).where(eq(teamMembers.email, managerEmail));
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.email, linkJoinerEmail));
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.email, pendingMemberEmail));
      await db
        .delete(managementBoards)
        .where(eq(managementBoards.name, marker));
      if (acceptedUserId)
        await db.delete(users).where(eq(users.id, acceptedUserId));
      if (linkJoinerId)
        await db.delete(users).where(eq(users.id, linkJoinerId));
      if (managerId) await db.delete(users).where(eq(users.id, managerId));
    });

    it("creates, retrieves, and accepts an invitation when the invited email signs in", async () => {
      const created = await createTeamInvitation(
        {
          name: "موظف اختبار",
          teamRole: "أخصائي عمليات",
          email: invitationEmail,
        },
        managerId
      );
      expect(created.invitePath).toBe(`/invite/${created.token}`);

      const pending = await getInvitationByToken(created.token);
      expect(pending).toMatchObject({
        invitation: { status: "pending", email: invitationEmail },
        member: { name: "موظف اختبار" },
      });
      invitedMemberId = pending!.member!.id;

      await upsertUser({
        openId: `${marker}-employee`,
        email: invitationEmail,
        name: "موظف اختبار",
        loginMethod: "test",
        role: "user",
        lastSignedIn: new Date(),
      });
      const db = await getDb();
      const account = await db!
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, `${marker}-employee`))
        .limit(1);
      acceptedUserId = account[0]!.id;
      await acceptTeamInvitation(created.token, {
        id: acceptedUserId,
        email: invitationEmail,
      });

      const accepted = await getInvitationByToken(created.token);
      expect(accepted).toMatchObject({
        invitation: { status: "accepted" },
        member: { userId: acceptedUserId },
      });
    });

    it("persists a manager comment against a deliverable", async () => {
      const workspace = await getWorkspaceData(baseBoardId);
      const deliverable = workspace.deliverables.find(
        item => item.id === baseDeliverableId
      );
      expect(deliverable).toBeDefined();
      await addDeliverableComment({
        deliverableId: deliverable!.id,
        authorUserId: managerId,
        body: marker,
        boardId: baseBoardId,
      });
      const db = await getDb();
      const comment = await db!
        .select()
        .from(deliverableComments)
        .where(eq(deliverableComments.body, marker))
        .limit(1);
      expect(comment[0]).toMatchObject({
        deliverableId: deliverable!.id,
        authorUserId: managerId,
        body: marker,
      });
    });

    it("persists an annual goal in the active board", async () => {
      const created = await createAnnualGoal({
        title: `${marker}-goal`,
        theme: "محور الاختبار",
        year: 2026,
        ownerMemberId: managerMemberId,
        boardId: baseBoardId,
      });
      annualGoalId = created.id;
      const workspace = await getWorkspaceData(baseBoardId);
      expect(workspace.goals).toContainEqual(
        expect.objectContaining({
          id: annualGoalId,
          title: `${marker}-goal`,
          progress: 0,
        })
      );
    });

    it("persists a lesson linked to a project in the active board", async () => {
      const created = await createLessonLearned({
        title: `${marker}-lesson`,
        projectId: baseProjectId,
        category: "success",
        lesson: "درس متكامل لاختبار الحفظ والربط.",
        recommendation: "تكرار الممارسة الناجحة.",
        lessonDate: new Date("2026-09-07T09:00:00Z"),
        boardId: baseBoardId,
        createdByUserId: managerId,
      });
      lessonId = created.id;
      const workspace = await getWorkspaceData(baseBoardId);
      expect(workspace.lessons).toContainEqual(
        expect.objectContaining({
          id: lessonId,
          projectId: baseProjectId,
          projectTitle: `${marker}-base`,
          authorName: "مدير اختبار",
        })
      );
    });

    it("allows an accepted team member to create a task", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: acceptedUserId,
          openId: `${marker}-employee`,
          email: invitationEmail,
          name: "موظف اختبار",
          loginMethod: "test",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      await expect(
        caller.workspace.createTask({
          title: marker,
          priority: "medium",
          status: "not_started",
        })
      ).resolves.toMatchObject({ showLoadWarning: false });
      const db = await getDb();
      const created = await db!
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.title, marker))
        .limit(1);
      expect(created).toHaveLength(1);
    });

    it("allows an accepted team member to create a project, assign work, and leave a deliverable comment", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: acceptedUserId,
          openId: `${marker}-employee`,
          email: invitationEmail,
          name: "موظف اختبار",
          loginMethod: "test",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      await expect(
        caller.workspace.createProject({
          title: marker,
          ownerMemberId: invitedMemberId,
          startDate: new Date("2026-09-01T00:00:00Z"),
          endDate: null,
          status: "planned",
        })
      ).resolves.toEqual({ id: expect.any(Number) });
      const workspace = await getWorkspaceData(baseBoardId);
      const createdTask = workspace.tasks.find(task => task.title === marker)!;
      const createdProject = workspace.projects.find(
        project => project.title === marker
      )!;
      const deliverable = workspace.deliverables.find(
        item => item.id === baseDeliverableId
      )!;
      expect(createdProject.endDate).toBeNull();
      await expect(
        caller.workspace.assignTask({
          id: createdTask.id,
          assigneeMemberId: invitedMemberId,
        })
      ).resolves.toBeUndefined();
      await expect(
        caller.workspace.updateProjectStatus({
          id: createdProject.id,
          status: "in_progress",
        })
      ).resolves.toBeUndefined();
      await expect(
        caller.workspace.addDeliverableComment({
          deliverableId: deliverable.id,
          body: marker,
        })
      ).resolves.toBeUndefined();
      await expect(
        caller.workspace.inviteMember({
          name: "دعوة غير مسموحة",
          teamRole: "اختبار",
          email: `${marker}-denied@example.test`,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const db = await getDb();
      const assigned = await db!
        .select({ assigneeMemberId: tasks.assigneeMemberId })
        .from(tasks)
        .where(eq(tasks.id, createdTask.id))
        .limit(1);
      const projectStatus = await db!
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, createdProject.id))
        .limit(1);
      const comment = await db!
        .select({ authorUserId: deliverableComments.authorUserId })
        .from(deliverableComments)
        .where(eq(deliverableComments.body, marker));
      expect(assigned[0]?.assigneeMemberId).toBe(invitedMemberId);
      expect(projectStatus[0]?.status).toBe("in_progress");
      expect(comment.some(item => item.authorUserId === acceptedUserId)).toBe(
        true
      );
    });

    it("limits a restricted member to the projects selected by the board manager", async () => {
      const manager = appRouter.createCaller({
        user: {
          id: managerId,
          openId: `${marker}-manager`,
          email: managerEmail,
          name: "مدير اختبار",
          loginMethod: "test",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      const member = appRouter.createCaller({
        user: {
          id: acceptedUserId,
          openId: `${marker}-employee`,
          email: invitationEmail,
          name: "موظف اختبار",
          loginMethod: "test",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      const workspace = await getWorkspaceData(baseBoardId);
      const hiddenProject = workspace.projects.find(
        project => project.title === marker
      )!;

      await manager.workspace.updateTeamMemberProjectAccess({
        memberId: invitedMemberId,
        projectAccess: "selected",
        allowedProjectIds: [baseProjectId],
      });

      const restrictedWorkspace = await member.workspace.overview();
      expect(restrictedWorkspace.projects.map(project => project.id)).toEqual([
        baseProjectId,
      ]);
      await expect(
        member.workspace.updateProjectStatus({
          id: hiddenProject.id,
          status: "complete",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await manager.workspace.updateTeamMemberProjectAccess({
        memberId: invitedMemberId,
        projectAccess: "all",
        allowedProjectIds: [],
      });
    });

    it("lets the board manager administer only members of the active board", async () => {
      const manager = appRouter.createCaller({
        user: {
          id: managerId,
          openId: `${marker}-manager`,
          email: managerEmail,
          name: "مدير اختبار",
          loginMethod: "test",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });

      const before = await manager.workspace.teamAdministration();
      expect(before.members).toContainEqual(
        expect.objectContaining({
          id: invitedMemberId,
          accessStatus: "active",
        })
      );
      await expect(
        manager.workspace.updateTeamMemberAccess({
          memberId: invitedMemberId,
          accessRole: "viewer",
        })
      ).resolves.toEqual({ success: true });
      const changed = await manager.workspace.teamAdministration();
      expect(
        changed.members.find(member => member.id === invitedMemberId)
          ?.accessRole
      ).toBe("viewer");
      await manager.workspace.updateTeamMemberAccess({
        memberId: invitedMemberId,
        accessRole: "member",
      });
      await expect(
        manager.workspace.setTeamMemberActive({
          memberId: managerMemberId,
          active: false,
        })
      ).rejects.toThrow("لا يمكن إيقاف مدير اللوحة الأساسي");
      await expect(
        updateBoardMemberAccess({
          memberId: invitedMemberId,
          accessRole: "viewer",
          boardId: baseBoardId + 10_000,
          actingUserId: managerId,
        })
      ).rejects.toThrow();
    });

    it("reissues a pending invitation and deletes its unlinked member", async () => {
      const manager = appRouter.createCaller({
        user: {
          id: managerId,
          openId: `${marker}-manager`,
          email: managerEmail,
          name: "مدير اختبار",
          loginMethod: "test",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      const original = await createTeamInvitation(
        {
          name: "عضو بانتظار القبول",
          teamRole: "عضو اختبار",
          email: pendingMemberEmail,
          accessRole: "member",
        },
        managerId
      );
      const replacement = await manager.workspace.reissueTeamInvitation({
        memberId: original.memberId,
      });
      expect(replacement.token).not.toBe(original.token);
      expect(
        (await getInvitationByToken(original.token))?.invitation.status
      ).toBe("cancelled");
      expect(
        (await getInvitationByToken(replacement.token))?.invitation.status
      ).toBe("pending");
      await expect(
        manager.workspace.deleteTeamMember({ memberId: original.memberId })
      ).resolves.toEqual({ success: true });
      const db = await getDb();
      const deleted = await db!
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(eq(teamMembers.id, original.memberId));
      expect(deleted).toHaveLength(0);
    });

    it("refuses to delete a member who has linked work", async () => {
      const manager = appRouter.createCaller({
        user: {
          id: managerId,
          openId: `${marker}-manager`,
          email: managerEmail,
          name: "مدير اختبار",
          loginMethod: "test",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      await expect(
        manager.workspace.deleteTeamMember({ memberId: invitedMemberId })
      ).rejects.toThrow("لديه أعمالًا مرتبطة");
    });

    it("persists one navigation configuration for the whole board", async () => {
      const manager = appRouter.createCaller({
        user: {
          id: managerId,
          openId: `${marker}-manager`,
          email: managerEmail,
          name: "مدير اختبار",
          loginMethod: "test",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      const enabledModules = ["projects", "tasks", "team", "reports"] as const;
      await expect(
        manager.workspace.updateBoardModules({
          enabledModules: [...enabledModules],
        })
      ).resolves.toEqual({ enabledModules: [...enabledModules] });
      const boards = await manager.boards.mine();
      expect(
        boards.find(board => board.id === baseBoardId)?.enabledModules
      ).toEqual([...enabledModules]);
      await manager.workspace.updateBoardModules({
        enabledModules: DEFAULT_BOARD_MODULES,
      });
    });

    it("creates a board and joins it through both the code and shared link", async () => {
      const manager = appRouter.createCaller({
        user: {
          id: managerId,
          openId: `${marker}-manager`,
          email: managerEmail,
          name: "مدير اختبار",
          loginMethod: "test",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      const teamMember = appRouter.createCaller({
        user: {
          id: acceptedUserId,
          openId: `${marker}-employee`,
          email: invitationEmail,
          name: "موظف اختبار",
          loginMethod: "test",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      const board = await manager.boards.create({ name: marker });
      expect(board).toMatchObject({ name: marker, membershipRole: "manager" });
      await expect(
        teamMember.boards.joinByCode({ joinCode: board.joinCode })
      ).resolves.toMatchObject({ boardId: board.id, membershipRole: "member" });
      await upsertUser({
        openId: `${marker}-link`,
        email: linkJoinerEmail,
        name: "عضو رابط",
        loginMethod: "test",
        role: "user",
        lastSignedIn: new Date(),
      });
      const db = await getDb();
      const joiner = await db!
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, `${marker}-link`))
        .limit(1);
      linkJoinerId = joiner[0]!.id;
      const linkMember = appRouter.createCaller({
        user: {
          id: linkJoinerId,
          openId: `${marker}-link`,
          email: linkJoinerEmail,
          name: "عضو رابط",
          loginMethod: "test",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      await expect(
        linkMember.boards.joinByLink({ inviteToken: board.inviteToken })
      ).resolves.toMatchObject({ boardId: board.id, membershipRole: "member" });
      await expect(manager.boards.mine()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: board.id, membershipRole: "manager" }),
        ])
      );
    });

    it("protects board actions from anonymous users and rejects invalid join credentials", async () => {
      const anonymous = appRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      await expect(
        anonymous.boards.create({ name: "لوحة غير مصرح بها" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        anonymous.boards.joinByCode({ joinCode: "ABC12345" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        anonymous.boards.joinByLink({ inviteToken: "x".repeat(32) })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      const manager = appRouter.createCaller({
        user: {
          id: managerId,
          openId: `${marker}-manager`,
          email: managerEmail,
          name: "مدير اختبار",
          loginMethod: "test",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });
      await expect(
        manager.boards.joinByCode({ joinCode: "INVALID0" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        manager.boards.joinByLink({ inviteToken: "x".repeat(32) })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  }
);
