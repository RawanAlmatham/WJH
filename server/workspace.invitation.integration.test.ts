import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { boardMemberships, deliverableComments, managementBoards, projects, tasks, teamInvitations, teamMembers, users } from "../drizzle/schema";
import { addDeliverableComment, createTeamInvitation, getDb, getInvitationByToken, getWorkspaceData, upsertUser } from "./db";
import { appRouter } from "./routers";

const marker = `invite-test-${Date.now()}`;
const invitationEmail = `${marker}@example.test`;
const managerEmail = `${marker}-manager@example.test`;
const linkJoinerEmail = `${marker}-link@example.test`;
let managerId = 0;
let acceptedUserId = 0;
let invitedMemberId = 0;
let linkJoinerId = 0;

describe("persistent invitation journey", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection is required for invitation integration test");
    const result = await db.insert(users).values({ openId: `${marker}-manager`, email: managerEmail, name: "مدير اختبار", loginMethod: "test", role: "admin", lastSignedIn: new Date() });
    managerId = Number(result[0].insertId);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const member = await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.email, invitationEmail)).limit(1);
    const managerMember = await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.email, managerEmail)).limit(1);
    const linkJoinerMember = await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.email, linkJoinerEmail)).limit(1);
    const boards = await db.select({ id: managementBoards.id }).from(managementBoards).where(eq(managementBoards.name, marker));
    await db.delete(tasks).where(eq(tasks.title, marker));
    await db.delete(projects).where(eq(projects.title, marker));
    await db.delete(teamInvitations).where(eq(teamInvitations.email, invitationEmail));
    await db.delete(deliverableComments).where(eq(deliverableComments.body, marker));
    for (const board of boards) await db.delete(boardMemberships).where(eq(boardMemberships.boardId, board.id));
    await db.delete(managementBoards).where(eq(managementBoards.name, marker));
    if (member[0]) await db.delete(teamMembers).where(eq(teamMembers.id, member[0].id));
    if (managerMember[0]) await db.delete(teamMembers).where(eq(teamMembers.id, managerMember[0].id));
    if (linkJoinerMember[0]) await db.delete(teamMembers).where(eq(teamMembers.id, linkJoinerMember[0].id));
    if (acceptedUserId) await db.delete(users).where(eq(users.id, acceptedUserId));
    if (linkJoinerId) await db.delete(users).where(eq(users.id, linkJoinerId));
    if (managerId) await db.delete(users).where(eq(users.id, managerId));
  });

  it("creates, retrieves, and accepts an invitation when the invited email signs in", async () => {
    const created = await createTeamInvitation({ name: "موظف اختبار", teamRole: "أخصائي عمليات", email: invitationEmail }, managerId);
    expect(created.invitePath).toBe(`/invite/${created.token}`);

    const pending = await getInvitationByToken(created.token);
    expect(pending).toMatchObject({ invitation: { status: "pending", email: invitationEmail }, member: { name: "موظف اختبار" } });
    invitedMemberId = pending!.member!.id;

    await upsertUser({ openId: `${marker}-employee`, email: invitationEmail, name: "موظف اختبار", loginMethod: "test", role: "user", lastSignedIn: new Date() });
    const db = await getDb();
    const account = await db!.select({ id: users.id }).from(users).where(eq(users.openId, `${marker}-employee`)).limit(1);
    acceptedUserId = account[0]!.id;

    const accepted = await getInvitationByToken(created.token);
    expect(accepted).toMatchObject({ invitation: { status: "accepted" }, member: { userId: acceptedUserId } });
  });

  it("persists a manager comment against a deliverable", async () => {
    const workspace = await getWorkspaceData();
    const deliverable = workspace.deliverables[0];
    expect(deliverable).toBeDefined();
    await addDeliverableComment({ deliverableId: deliverable!.id, authorUserId: managerId, body: marker });
    const db = await getDb();
    const comment = await db!.select().from(deliverableComments).where(eq(deliverableComments.body, marker)).limit(1);
    expect(comment[0]).toMatchObject({ deliverableId: deliverable!.id, authorUserId: managerId, body: marker });
  });

  it("allows an accepted team member to create a task", async () => {
    const caller = appRouter.createCaller({
      user: { id: acceptedUserId, openId: `${marker}-employee`, email: invitationEmail, name: "موظف اختبار", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });
    await expect(caller.workspace.createTask({ title: marker, priority: "medium", status: "not_started" })).resolves.toMatchObject({ showLoadWarning: false });
    const db = await getDb();
    const created = await db!.select({ id: tasks.id }).from(tasks).where(eq(tasks.title, marker)).limit(1);
    expect(created).toHaveLength(1);
  });

  it("allows an accepted team member to create a project, assign work, and leave a deliverable comment", async () => {
    const caller = appRouter.createCaller({
      user: { id: acceptedUserId, openId: `${marker}-employee`, email: invitationEmail, name: "موظف اختبار", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });
    await expect(caller.workspace.createProject({ title: marker, ownerMemberId: invitedMemberId, startDate: new Date("2026-09-01T00:00:00Z"), endDate: new Date("2026-10-01T00:00:00Z"), status: "planned" })).resolves.toBeUndefined();
    const workspace = await getWorkspaceData();
    const createdTask = workspace.tasks.find((task) => task.title === marker)!;
    const createdProject = workspace.projects.find((project) => project.title === marker)!;
    const deliverable = workspace.deliverables[0]!;
    await expect(caller.workspace.assignTask({ id: createdTask.id, assigneeMemberId: invitedMemberId })).resolves.toBeUndefined();
    await expect(caller.workspace.updateProjectStatus({ id: createdProject.id, status: "in_progress" })).resolves.toBeUndefined();
    await expect(caller.workspace.addDeliverableComment({ deliverableId: deliverable.id, body: marker })).resolves.toBeUndefined();
    await expect(caller.workspace.inviteMember({ name: "دعوة غير مسموحة", teamRole: "اختبار", email: `${marker}-denied@example.test` })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const db = await getDb();
    const assigned = await db!.select({ assigneeMemberId: tasks.assigneeMemberId }).from(tasks).where(eq(tasks.id, createdTask.id)).limit(1);
    const projectStatus = await db!.select({ status: projects.status }).from(projects).where(eq(projects.id, createdProject.id)).limit(1);
    const comment = await db!.select({ authorUserId: deliverableComments.authorUserId }).from(deliverableComments).where(eq(deliverableComments.body, marker));
    expect(assigned[0]?.assigneeMemberId).toBe(invitedMemberId);
    expect(projectStatus[0]?.status).toBe("in_progress");
    expect(comment.some((item) => item.authorUserId === acceptedUserId)).toBe(true);
  });

  it("creates a board and joins it through both the code and shared link", async () => {
    const manager = appRouter.createCaller({ user: { id: managerId, openId: `${marker}-manager`, email: managerEmail, name: "مدير اختبار", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as any, res: {} as any });
    const teamMember = appRouter.createCaller({ user: { id: acceptedUserId, openId: `${marker}-employee`, email: invitationEmail, name: "موظف اختبار", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as any, res: {} as any });
    const board = await manager.boards.create({ name: marker });
    expect(board).toMatchObject({ name: marker, membershipRole: "owner" });
    await expect(teamMember.boards.joinByCode({ joinCode: board.joinCode })).resolves.toMatchObject({ boardId: board.id, membershipRole: "member" });
    await upsertUser({ openId: `${marker}-link`, email: linkJoinerEmail, name: "عضو رابط", loginMethod: "test", role: "user", lastSignedIn: new Date() });
    const db = await getDb();
    const joiner = await db!.select({ id: users.id }).from(users).where(eq(users.openId, `${marker}-link`)).limit(1);
    linkJoinerId = joiner[0]!.id;
    const linkMember = appRouter.createCaller({ user: { id: linkJoinerId, openId: `${marker}-link`, email: linkJoinerEmail, name: "عضو رابط", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as any, res: {} as any });
    await expect(linkMember.boards.joinByLink({ inviteToken: board.inviteToken })).resolves.toMatchObject({ boardId: board.id, membershipRole: "member" });
    await expect(manager.boards.mine()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: board.id, membershipRole: "owner" })]));
  });

  it("protects board actions from anonymous users and rejects invalid join credentials", async () => {
    const anonymous = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as any, res: {} as any });
    await expect(anonymous.boards.create({ name: "لوحة غير مصرح بها" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.boards.joinByCode({ joinCode: "ABC12345" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.boards.joinByLink({ inviteToken: "x".repeat(32) })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const manager = appRouter.createCaller({ user: { id: managerId, openId: `${marker}-manager`, email: managerEmail, name: "مدير اختبار", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as any, res: {} as any });
    await expect(manager.boards.joinByCode({ joinCode: "INVALID0" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(manager.boards.joinByLink({ inviteToken: "x".repeat(32) })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
