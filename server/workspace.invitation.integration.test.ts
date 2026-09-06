import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { deliverableComments, teamInvitations, teamMembers, users } from "../drizzle/schema";
import { addDeliverableComment, createTeamInvitation, getDb, getInvitationByToken, getWorkspaceData, upsertUser } from "./db";

const marker = `invite-test-${Date.now()}`;
const invitationEmail = `${marker}@example.test`;
let managerId = 0;
let acceptedUserId = 0;

describe("persistent invitation journey", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection is required for invitation integration test");
    const result = await db.insert(users).values({ openId: `${marker}-manager`, email: `${marker}-manager@example.test`, name: "مدير اختبار", loginMethod: "test", role: "admin", lastSignedIn: new Date() });
    managerId = Number(result[0].insertId);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const member = await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.email, invitationEmail)).limit(1);
    await db.delete(teamInvitations).where(eq(teamInvitations.email, invitationEmail));
    await db.delete(deliverableComments).where(eq(deliverableComments.body, marker));
    if (member[0]) await db.delete(teamMembers).where(eq(teamMembers.id, member[0].id));
    if (acceptedUserId) await db.delete(users).where(eq(users.id, acceptedUserId));
    if (managerId) await db.delete(users).where(eq(users.id, managerId));
  });

  it("creates, retrieves, and accepts an invitation when the invited email signs in", async () => {
    const created = await createTeamInvitation({ name: "موظف اختبار", teamRole: "أخصائي عمليات", email: invitationEmail }, managerId);
    expect(created.invitePath).toBe(`/invite/${created.token}`);

    const pending = await getInvitationByToken(created.token);
    expect(pending).toMatchObject({ invitation: { status: "pending", email: invitationEmail }, member: { name: "موظف اختبار" } });

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
});
