import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  annualGoals,
  boardMemberships,
  calendarEvents,
  deliverableComments,
  deliverables,
  InsertUser,
  lessonsLearned,
  managerInvitations,
  managementBoards,
  projectMembers,
  projects,
  researchFeedItems,
  researchFeedMatches,
  researchInterests,
  taskAttachments,
  taskAssignees,
  taskChecklistItems,
  taskComments,
  taskParticipants,
  tasks,
  teamInvitations,
  teamMembers,
  users,
} from "../drizzle/schema";
import { nanoid } from "nanoid";
import { ENV } from "./_core/env";
import { createHash } from "node:crypto";
import type { BoardModule } from "../shared/boardModules";
import { DEFAULT_BOARD_MODULES } from "../shared/boardModules";
import {
  DEFAULT_PRESENTATION_SECTIONS,
  type PresentationSection,
} from "../shared/presentationSections";
import {
  fetchArxivResearchFeed,
  normalizeResearchKeywords,
  RESEARCH_FEED_REFRESH_INTERVAL_MS,
} from "./researchFeeds";

let _db: ReturnType<typeof drizzle> | null = null;

type WorkTask = {
  assigneeMemberId: number | null;
  assigneeMemberIds?: number[];
  status: string;
  priority: string;
};

export function calculateWorkload(tasks: WorkTask[], memberId: number) {
  const active = tasks.filter(
    task =>
      (task.assigneeMemberIds?.includes(memberId) ??
        task.assigneeMemberId === memberId) &&
      task.status !== "complete"
  );
  const load = active.reduce(
    (sum, task) =>
      sum +
      (task.priority === "urgent"
        ? 4
        : task.priority === "high"
          ? 3
          : task.priority === "medium"
            ? 2
            : 1),
    0
  );
  return {
    activeTaskCount: active.length,
    overdueCount: active.filter(task => task.status === "overdue").length,
    load,
    loadStatus: load >= 9 ? "loaded" : load >= 5 ? "busy" : "available",
  } as const;
}

export function shouldWarnAssignee(activeTaskCount: number) {
  return activeTaskCount >= 4;
}

export function summarizeTasks(tasks: Pick<WorkTask, "status">[]) {
  const completed = tasks.filter(task => task.status === "complete").length;
  const overdue = tasks.filter(task => task.status === "overdue").length;
  return {
    achievement: tasks.length
      ? Math.round((completed / tasks.length) * 100)
      : 0,
    overdue,
    completed,
    taskCount: tasks.length,
  };
}

export function calculateProjectProgress(
  projectTasks: { status: string }[],
  projectDeliverables: { status: string }[]
) {
  const completedRatio = (items: { status: string }[]) =>
    items.length
      ? items.filter(item => item.status === "complete").length / items.length
      : 0;
  if (!projectTasks.length && !projectDeliverables.length) return 0;
  if (!projectDeliverables.length)
    return Math.round(completedRatio(projectTasks) * 100);
  if (!projectTasks.length)
    return Math.round(completedRatio(projectDeliverables) * 100);
  return Math.round(
    completedRatio(projectTasks) * 70 + completedRatio(projectDeliverables) * 30
  );
}

export function calculateGoalProgress(linkedProjects: { progress: number }[]) {
  if (!linkedProjects.length) return 0;
  return Math.round(
    linkedProjects.reduce((sum, project) => sum + project.progress, 0) /
      linkedProjects.length
  );
}

async function refreshProjectProgress(projectId: number | null | undefined) {
  if (!projectId) return;
  const db = await getDb();
  if (!db) return;
  const [projectTasks, projectDeliverables] = await Promise.all([
    db
      .select({ status: tasks.status })
      .from(tasks)
      .where(eq(tasks.projectId, projectId)),
    db
      .select({ status: deliverables.status })
      .from(deliverables)
      .where(eq(deliverables.projectId, projectId)),
  ]);
  await db
    .update(projects)
    .set({
      progress: calculateProjectProgress(projectTasks, projectDeliverables),
      isManualProgress: false,
    })
    .where(eq(projects.id, projectId));
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = {
    openId: user.openId,
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };
  const updateSet: Record<string, unknown> = {
    lastSignedIn: values.lastSignedIn,
  };
  (["name", "email", "passwordHash", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role =
    user.role ??
    (user.email?.toLowerCase() === ENV.adminEmail ? "admin" : "user");
  updateSet.role = values.role;
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export function localUserId(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function ensureConfiguredAdmin<
  T extends { id: number; email: string | null; role: string },
>(user: T) {
  if (!ENV.adminEmail || user.email?.toLowerCase() !== ENV.adminEmail)
    return user;
  if (user.role !== "admin") {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
    await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
  }
  return { ...user, role: "admin" as const };
}

export async function isUserTeamMember(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const member = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  return Boolean(member[0]);
}

export type BoardRole = "manager" | "member" | "viewer";
export type ProjectAccess = "all" | "selected";

export async function getActiveBoardId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const account = await db
    .select({ activeBoardId: users.activeBoardId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (account[0]?.activeBoardId) {
    const activeMembership = await db
      .select({ id: boardMemberships.id })
      .from(boardMemberships)
      .where(
        and(
          eq(boardMemberships.userId, userId),
          eq(boardMemberships.boardId, account[0].activeBoardId)
        )
      )
      .limit(1);
    if (activeMembership[0]) return account[0].activeBoardId;
  }
  const firstMembership = await db
    .select({ boardId: boardMemberships.boardId })
    .from(boardMemberships)
    .where(eq(boardMemberships.userId, userId))
    .limit(1);
  return firstMembership[0]?.boardId ?? null;
}

export async function hasBoardRole(
  userId: number,
  roles: BoardRole[],
  boardId?: number | null
) {
  const db = await getDb();
  if (!db) return false;
  const activeBoardId =
    boardId === undefined ? await getActiveBoardId(userId) : boardId;
  if (!activeBoardId) return false;
  const memberships = await db
    .select({ role: boardMemberships.role })
    .from(boardMemberships)
    .where(
      and(
        eq(boardMemberships.userId, userId),
        eq(boardMemberships.boardId, activeBoardId)
      )
    );
  return memberships.some(item => roles.includes(item.role));
}

export async function getUserProjectAccess(userId: number, boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({
      accountRole: users.role,
      membershipRole: boardMemberships.role,
      projectAccess: teamMembers.projectAccess,
      allowedProjectIds: teamMembers.allowedProjectIds,
    })
    .from(boardMemberships)
    .innerJoin(users, eq(boardMemberships.userId, users.id))
    .leftJoin(
      teamMembers,
      and(
        eq(teamMembers.userId, boardMemberships.userId),
        eq(teamMembers.boardId, boardMemberships.boardId),
        eq(teamMembers.isActive, true)
      )
    )
    .where(
      and(
        eq(boardMemberships.userId, userId),
        eq(boardMemberships.boardId, boardId)
      )
    )
    .limit(1);
  const access = rows[0];
  if (!access) return { restricted: true, projectIds: [] as number[] };
  if (
    access.accountRole === "admin" ||
    access.membershipRole !== "member" ||
    access.projectAccess !== "selected"
  )
    return { restricted: false, projectIds: [] as number[] };
  return {
    restricted: true,
    projectIds: Array.isArray(access.allowedProjectIds)
      ? access.allowedProjectIds.filter(
          (id): id is number => Number.isInteger(id) && id > 0
        )
      : [],
  };
}

export async function canUserAccessProject(
  userId: number,
  boardId: number,
  projectId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.boardId, boardId)))
    .limit(1);
  if (!project[0]) return false;
  const access = await getUserProjectAccess(userId, boardId);
  return !access.restricted || access.projectIds.includes(projectId);
}

export async function canUserAccessTask(
  userId: number,
  boardId: number,
  taskId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
    .limit(1);
  const task = rows[0];
  if (!task) return false;
  if (!task.projectId) return true;
  return canUserAccessProject(userId, boardId, task.projectId);
}

export async function canUserAccessDeliverable(
  userId: number,
  boardId: number,
  deliverableId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({ projectId: deliverables.projectId })
    .from(deliverables)
    .innerJoin(projects, eq(deliverables.projectId, projects.id))
    .where(
      and(eq(deliverables.id, deliverableId), eq(projects.boardId, boardId))
    )
    .limit(1);
  const deliverable = rows[0];
  if (!deliverable) return false;
  return canUserAccessProject(userId, boardId, deliverable.projectId);
}

export async function canUserAccessResearchFeedItem(
  userId: number,
  boardId: number,
  feedItemId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({ projectId: researchFeedItems.projectId })
    .from(researchFeedItems)
    .where(
      and(
        eq(researchFeedItems.id, feedItemId),
        eq(researchFeedItems.boardId, boardId)
      )
    )
    .limit(1);
  const item = rows[0];
  if (!item) return false;
  if (!item.projectId) return true;
  return canUserAccessProject(userId, boardId, item.projectId);
}

export async function canUserAccessLesson(
  userId: number,
  boardId: number,
  lessonId: number
) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await database
    .select({ projectId: lessonsLearned.projectId })
    .from(lessonsLearned)
    .where(
      and(eq(lessonsLearned.id, lessonId), eq(lessonsLearned.boardId, boardId))
    )
    .limit(1);
  return rows[0]
    ? canUserAccessProject(userId, boardId, rows[0].projectId)
    : false;
}

export async function canUserAccessCalendarEvent(
  userId: number,
  boardId: number,
  eventId: number
) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await database
    .select({ projectId: calendarEvents.projectId })
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, eventId), eq(calendarEvents.boardId, boardId))
    )
    .limit(1);
  if (!rows[0]) return false;
  return rows[0].projectId
    ? canUserAccessProject(userId, boardId, rows[0].projectId)
    : true;
}

async function ensureTeamMemberForUser(userId: number, boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const existing = await db
    .select({ id: teamMembers.id, isActive: teamMembers.isActive })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.userId, userId), eq(teamMembers.boardId, boardId))
    )
    .limit(1);
  if (existing[0]) {
    if (!existing[0].isActive)
      await db
        .update(teamMembers)
        .set({ isActive: true })
        .where(eq(teamMembers.id, existing[0].id));
    return existing[0].id;
  }
  const account = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const name = account[0]?.name || "عضو فريق";
  const result = await db.insert(teamMembers).values({
    boardId,
    userId,
    name,
    email: account[0]?.email ?? null,
    role: "عضو فريق",
    avatarInitials: initialsFor(name),
  });
  return Number(result[0].insertId);
}

export async function listUserBoards(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const [account, memberships] = await Promise.all([
    db
      .select({ activeBoardId: users.activeBoardId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({
        id: managementBoards.id,
        name: managementBoards.name,
        ownerUserId: managementBoards.ownerUserId,
        joinCode: managementBoards.joinCode,
        inviteToken: managementBoards.inviteToken,
        enabledModules: managementBoards.enabledModules,
        presentationSections: managementBoards.presentationSections,
        membershipRole: boardMemberships.role,
        joinedAt: boardMemberships.joinedAt,
      })
      .from(boardMemberships)
      .innerJoin(
        managementBoards,
        eq(boardMemberships.boardId, managementBoards.id)
      )
      .where(eq(boardMemberships.userId, userId)),
  ]);
  const activeBoardId = account[0]?.activeBoardId ?? memberships[0]?.id ?? null;
  return memberships.map(board => ({
    ...board,
    enabledModules: board.enabledModules ?? DEFAULT_BOARD_MODULES,
    presentationSections:
      board.presentationSections ?? DEFAULT_PRESENTATION_SECTIONS,
    isActive: board.id === activeBoardId,
  }));
}

export async function createManagementBoard(name: string, ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const joinCode = nanoid(8).toUpperCase();
  const inviteToken = nanoid(32);
  const result = await db
    .insert(managementBoards)
    .values({ name, ownerUserId, joinCode, inviteToken });
  const boardId = Number(result[0].insertId);
  await db
    .insert(boardMemberships)
    .values({ boardId, userId: ownerUserId, role: "manager" });
  await db
    .update(users)
    .set({ activeBoardId: boardId })
    .where(eq(users.id, ownerUserId));
  await ensureTeamMemberForUser(ownerUserId, boardId);
  return {
    id: boardId,
    name,
    joinCode,
    inviteToken,
    enabledModules: DEFAULT_BOARD_MODULES,
    presentationSections: DEFAULT_PRESENTATION_SECTIONS,
    membershipRole: "manager" as const,
  };
}

export async function updateBoardModules(
  boardId: number,
  enabledModules: BoardModule[]
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const result = await db
    .update(managementBoards)
    .set({ enabledModules })
    .where(eq(managementBoards.id, boardId));
  if (!result[0].affectedRows) throw new Error("لم نعثر على اللوحة الحالية");
  return { enabledModules };
}

export async function updateBoardPresentationSections(
  boardId: number,
  sections: PresentationSection[]
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const result = await db
    .update(managementBoards)
    .set({ presentationSections: sections })
    .where(eq(managementBoards.id, boardId));
  if (!result[0].affectedRows) throw new Error("لم نعثر على اللوحة الحالية");
  return { presentationSections: sections };
}

export async function getResearchFeed(boardId: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const access = userId
    ? await getUserProjectAccess(userId, boardId)
    : { restricted: false, projectIds: [] as number[] };
  const interests = await db
    .select()
    .from(researchInterests)
    .where(eq(researchInterests.boardId, boardId))
    .orderBy(desc(researchInterests.createdAt));
  const activeInterestIds = interests
    .filter(interest => interest.isActive)
    .map(interest => interest.id);
  const matches = activeInterestIds.length
    ? await db
        .select()
        .from(researchFeedMatches)
        .where(inArray(researchFeedMatches.interestId, activeInterestIds))
    : [];
  const itemIds = Array.from(new Set(matches.map(match => match.feedItemId)));
  const items = itemIds.length
    ? await db
        .select()
        .from(researchFeedItems)
        .where(
          and(
            eq(researchFeedItems.boardId, boardId),
            inArray(researchFeedItems.id, itemIds)
          )
        )
        .orderBy(desc(researchFeedItems.publishedAt))
        .limit(150)
    : [];
  const allowedProjectIds = new Set(access.projectIds);
  const visibleItems = access.restricted
    ? items.filter(
        item => !item.projectId || allowedProjectIds.has(item.projectId)
      )
    : items;
  return {
    interests,
    items: visibleItems.map(item => ({
      ...item,
      translationIsCurrent: Boolean(
        item.abstractArabic &&
          item.abstract &&
          item.abstractArabicSourceHash === researchAbstractHash(item.abstract)
      ),
      interestIds: matches
        .filter(match => match.feedItemId === item.id)
        .map(match => match.interestId),
    })),
  };
}

function researchAbstractHash(abstract: string) {
  return createHash("sha256").update(abstract).digest("hex");
}

export async function saveResearchFeedArabicTranslations(input: {
  boardId: number;
  translatedByUserId: number;
  translations: { id: number; abstractArabic: string }[];
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const translations = Array.from(
    new Map(input.translations.map(item => [item.id, item])).values()
  );
  if (!translations.length) throw new Error("أضف ترجمة واحدة على الأقل");
  const ids = translations.map(item => item.id);
  const items = await database
    .select({ id: researchFeedItems.id, abstract: researchFeedItems.abstract })
    .from(researchFeedItems)
    .where(
      and(
        eq(researchFeedItems.boardId, input.boardId),
        inArray(researchFeedItems.id, ids)
      )
    );
  if (items.length !== ids.length)
    throw new Error("بعض الخلاصات غير موجودة في اللوحة الحالية");
  const originals = new Map(items.map(item => [item.id, item.abstract]));
  if (items.some(item => !item.abstract?.trim()))
    throw new Error("لا يمكن ترجمة خلاصة لا تحتوي على ملخص أصلي");
  const updatedAt = new Date();
  await database.transaction(async transaction => {
    for (const translation of translations) {
      const original = originals.get(translation.id);
      if (!original) continue;
      await transaction
        .update(researchFeedItems)
        .set({
          abstractArabic: translation.abstractArabic.trim(),
          abstractArabicSourceHash: researchAbstractHash(original),
          abstractArabicUpdatedAt: updatedAt,
          abstractArabicUpdatedByUserId: input.translatedByUserId,
        })
        .where(
          and(
            eq(researchFeedItems.id, translation.id),
            eq(researchFeedItems.boardId, input.boardId)
          )
        );
    }
  });
  return { updated: translations.length, ids };
}

export async function createResearchInterest(input: {
  boardId: number;
  name: string;
  keywords: string[];
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const keywords = normalizeResearchKeywords(input.keywords);
  if (!keywords.length) throw new Error("أضف كلمة بحث واحدة على الأقل");
  try {
    const result = await db.insert(researchInterests).values({
      boardId: input.boardId,
      name: input.name.trim(),
      keywords,
      createdByUserId: input.createdByUserId,
    });
    return { id: Number(result[0].insertId) };
  } catch (error) {
    if (error instanceof Error && /duplicate/i.test(error.message))
      throw new Error("يوجد موضوع بهذا الاسم في اللوحة");
    throw error;
  }
}

export async function updateResearchInterest(input: {
  id: number;
  boardId: number;
  name: string;
  keywords: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const keywords = normalizeResearchKeywords(input.keywords);
  if (!keywords.length) throw new Error("أضف كلمة بحث واحدة على الأقل");
  const allowed = await db
    .select({ id: researchInterests.id })
    .from(researchInterests)
    .where(
      and(
        eq(researchInterests.id, input.id),
        eq(researchInterests.boardId, input.boardId)
      )
    )
    .limit(1);
  if (!allowed[0]) throw new Error("لم نعثر على الاهتمام المطلوب");
  await db.transaction(async tx => {
    await tx
      .update(researchInterests)
      .set({
        name: input.name.trim(),
        keywords,
        lastFetchedAt: null,
        lastFetchStatus: "idle",
        lastFetchMessage: null,
      })
      .where(eq(researchInterests.id, input.id));
    await tx
      .delete(researchFeedMatches)
      .where(eq(researchFeedMatches.interestId, input.id));
  });
  return { success: true } as const;
}

export async function setResearchInterestActive(input: {
  id: number;
  boardId: number;
  active: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const result = await db
    .update(researchInterests)
    .set({ isActive: input.active })
    .where(
      and(
        eq(researchInterests.id, input.id),
        eq(researchInterests.boardId, input.boardId)
      )
    );
  if (!result[0].affectedRows) throw new Error("لم نعثر على الاهتمام المطلوب");
  return { success: true } as const;
}

export async function deleteResearchInterest(id: number, boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const result = await db
    .delete(researchInterests)
    .where(
      and(eq(researchInterests.id, id), eq(researchInterests.boardId, boardId))
    );
  if (!result[0].affectedRows) throw new Error("لم نعثر على الاهتمام المطلوب");
  return { success: true } as const;
}

export async function linkResearchFeedItemToProject(input: {
  id: number;
  boardId: number;
  projectId: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  if (input.projectId) {
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.boardId, input.boardId)
        )
      )
      .limit(1);
    if (!project[0])
      throw new Error("لا يمكن الربط بمشروع خارج اللوحة الحالية");
  }
  const result = await db
    .update(researchFeedItems)
    .set({ projectId: input.projectId })
    .where(
      and(
        eq(researchFeedItems.id, input.id),
        eq(researchFeedItems.boardId, input.boardId)
      )
    );
  if (!result[0].affectedRows) throw new Error("لم نعثر على الخلاصة المطلوبة");
  return { success: true } as const;
}

export async function refreshResearchInterest(id: number, boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select()
    .from(researchInterests)
    .where(
      and(eq(researchInterests.id, id), eq(researchInterests.boardId, boardId))
    )
    .limit(1);
  const interest = rows[0];
  if (!interest) throw new Error("لم نعثر على الاهتمام المطلوب");
  if (!interest.isActive) return { fetched: 0, skipped: true } as const;
  try {
    const entries = await fetchArxivResearchFeed(interest.keywords);
    for (const entry of entries) {
      await db
        .insert(researchFeedItems)
        .values({
          boardId,
          source: entry.source,
          externalId: entry.externalId,
          title: entry.title,
          abstract: entry.abstract,
          url: entry.url,
          authors: entry.authors,
          publishedAt: entry.publishedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            title: entry.title,
            abstract: entry.abstract,
            url: entry.url,
            authors: entry.authors,
            publishedAt: entry.publishedAt,
          },
        });
      const item = await db
        .select({ id: researchFeedItems.id })
        .from(researchFeedItems)
        .where(
          and(
            eq(researchFeedItems.boardId, boardId),
            eq(researchFeedItems.source, entry.source),
            eq(researchFeedItems.externalId, entry.externalId)
          )
        )
        .limit(1);
      if (item[0]) {
        await db
          .insert(researchFeedMatches)
          .values({ interestId: interest.id, feedItemId: item[0].id })
          .onDuplicateKeyUpdate({ set: { feedItemId: item[0].id } });
      }
    }
    await db
      .update(researchInterests)
      .set({
        lastFetchedAt: new Date(),
        lastFetchStatus: "success",
        lastFetchMessage: entries.length
          ? `تم العثور على ${entries.length} نتيجة`
          : "لا توجد نتائج جديدة بهذه الكلمات",
      })
      .where(eq(researchInterests.id, interest.id));
    return { fetched: entries.length, skipped: false } as const;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر تحديث الخلاصات";
    await db
      .update(researchInterests)
      .set({ lastFetchStatus: "error", lastFetchMessage: message })
      .where(eq(researchInterests.id, interest.id));
    throw new Error(message);
  }
}

const pause = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export async function refreshBoardResearchFeed(boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const interests = await db
    .select({ id: researchInterests.id })
    .from(researchInterests)
    .where(
      and(
        eq(researchInterests.boardId, boardId),
        eq(researchInterests.isActive, true)
      )
    );
  const results: { id: number; fetched: number; error?: string }[] = [];
  for (let index = 0; index < interests.length; index += 1) {
    const interest = interests[index];
    if (index) await pause(3_100);
    try {
      const result = await refreshResearchInterest(interest.id, boardId);
      results.push({ id: interest.id, fetched: result.fetched });
    } catch (error) {
      results.push({
        id: interest.id,
        fetched: 0,
        error: error instanceof Error ? error.message : "تعذر التحديث",
      });
    }
  }
  return {
    interests: results.length,
    fetched: results.reduce((sum, result) => sum + result.fetched, 0),
    failures: results.filter(result => result.error).length,
  };
}

let refreshJobRunning = false;

export async function refreshDueResearchFeeds() {
  if (refreshJobRunning) return;
  refreshJobRunning = true;
  try {
    const db = await getDb();
    if (!db) return;
    const now = Date.now();
    const interests = (
      await db
        .select({
          id: researchInterests.id,
          boardId: researchInterests.boardId,
          lastFetchedAt: researchInterests.lastFetchedAt,
        })
        .from(researchInterests)
        .where(eq(researchInterests.isActive, true))
    )
      .filter(
        interest =>
          !interest.lastFetchedAt ||
          now - interest.lastFetchedAt.getTime() >=
            RESEARCH_FEED_REFRESH_INTERVAL_MS
      )
      .slice(0, 20);
    for (let index = 0; index < interests.length; index += 1) {
      const interest = interests[index];
      if (index) await pause(3_100);
      await refreshResearchInterest(interest.id, interest.boardId).catch(
        error => console.warn("[Research feeds]", error)
      );
    }
  } finally {
    refreshJobRunning = false;
  }
}

export async function selectManagementBoard(userId: number, boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const membership = await db
    .select({ id: boardMemberships.id })
    .from(boardMemberships)
    .where(
      and(
        eq(boardMemberships.userId, userId),
        eq(boardMemberships.boardId, boardId)
      )
    )
    .limit(1);
  if (!membership[0]) throw new Error("لا تملك صلاحية الوصول إلى هذه اللوحة");
  await db
    .update(users)
    .set({ activeBoardId: boardId })
    .where(eq(users.id, userId));
  return { boardId };
}

export async function getBoardByJoinCode(joinCode: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select()
    .from(managementBoards)
    .where(eq(managementBoards.joinCode, joinCode.toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBoardByInviteToken(inviteToken: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select()
    .from(managementBoards)
    .where(eq(managementBoards.inviteToken, inviteToken))
    .limit(1);
  return rows[0] ?? null;
}

export async function joinManagementBoard(
  boardId: number,
  userId: number,
  role: BoardRole = "member"
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const membership = await db
    .select()
    .from(boardMemberships)
    .where(eq(boardMemberships.boardId, boardId));
  const existing = membership.find(item => item.userId === userId);
  if (!existing)
    await db.insert(boardMemberships).values({ boardId, userId, role });
  await db
    .update(users)
    .set({ activeBoardId: boardId })
    .where(eq(users.id, userId));
  await ensureTeamMemberForUser(userId, boardId);
  return { boardId, membershipRole: existing?.role ?? role };
}

function initialsFor(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0] ?? "")
      .join("")
      .slice(0, 4) || "عضو"
  );
}

export async function createTeamInvitation(
  input: {
    name: string;
    teamRole: string;
    email: string;
    accessRole: BoardRole;
    projectAccess?: ProjectAccess;
    allowedProjectIds?: number[];
  },
  invitedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const email = input.email.trim().toLowerCase();
  const activeBoardId = await getActiveBoardId(invitedByUserId);
  if (!activeBoardId) throw new Error("أنشئ لوحة للقسم قبل دعوة أعضاء الفريق");
  const board = await db
    .select({ id: managementBoards.id })
    .from(boardMemberships)
    .innerJoin(
      managementBoards,
      eq(boardMemberships.boardId, managementBoards.id)
    )
    .where(
      and(
        eq(boardMemberships.userId, invitedByUserId),
        eq(boardMemberships.role, "manager"),
        eq(boardMemberships.boardId, activeBoardId)
      )
    )
    .limit(1);
  if (!board[0]) throw new Error("أنشئ لوحة للقسم قبل دعوة أعضاء الفريق");
  const requestedProjectIds =
    input.accessRole === "member" && input.projectAccess === "selected"
      ? Array.from(new Set(input.allowedProjectIds ?? []))
      : [];
  if (requestedProjectIds.length) {
    const allowedProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.boardId, activeBoardId),
          inArray(projects.id, requestedProjectIds)
        )
      );
    if (allowedProjects.length !== requestedProjectIds.length)
      throw new Error("بعض المشاريع المختارة لا تنتمي إلى اللوحة الحالية");
  }
  const projectAccess =
    input.accessRole === "member" ? (input.projectAccess ?? "all") : "all";
  const existing = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.email, email), eq(teamMembers.boardId, activeBoardId))
    )
    .limit(1);
  let memberId = existing[0]?.id;
  if (memberId) {
    await db
      .update(teamMembers)
      .set({
        name: input.name,
        role: input.teamRole,
        email,
        projectAccess,
        allowedProjectIds:
          projectAccess === "selected" ? requestedProjectIds : null,
        isActive: true,
        avatarInitials: initialsFor(input.name),
      })
      .where(eq(teamMembers.id, memberId));
  } else {
    const result = await db.insert(teamMembers).values({
      boardId: activeBoardId,
      name: input.name,
      role: input.teamRole,
      email,
      projectAccess,
      allowedProjectIds:
        projectAccess === "selected" ? requestedProjectIds : null,
      avatarInitials: initialsFor(input.name),
    });
    memberId = Number(result[0].insertId);
  }
  const token = nanoid(32);
  await db.insert(teamInvitations).values({
    memberId,
    invitedByUserId,
    boardId: board[0].id,
    email,
    token,
    accessRole: input.accessRole,
    status: "pending",
  });
  return {
    token,
    memberId,
    invitePath: `/invite/${token}`,
    accessRole: input.accessRole,
    projectAccess,
    allowedProjectIds: requestedProjectIds,
  };
}

export async function reissueTeamInvitation(input: {
  memberId: number;
  boardId: number;
  invitedByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({
      memberId: teamMembers.id,
      userId: teamMembers.userId,
      isActive: teamMembers.isActive,
      email: teamMembers.email,
    })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, input.memberId),
        eq(teamMembers.boardId, input.boardId)
      )
    )
    .limit(1);
  const member = rows[0];
  if (!member) throw new Error("لم نعثر على عضو الفريق");
  if (member.userId) throw new Error("هذا العضو فعّل حسابه بالفعل");
  const pending = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.memberId, input.memberId),
        eq(teamInvitations.boardId, input.boardId),
        eq(teamInvitations.status, "pending")
      )
    )
    .orderBy(desc(teamInvitations.id))
    .limit(1);
  const invitation = pending[0];
  if (!invitation) throw new Error("لا توجد دعوة معلقة لهذا العضو");
  const token = nanoid(32);
  await db.transaction(async tx => {
    await tx
      .update(teamInvitations)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(teamInvitations.memberId, input.memberId),
          eq(teamInvitations.boardId, input.boardId),
          eq(teamInvitations.status, "pending")
        )
      );
    await tx.insert(teamInvitations).values({
      memberId: input.memberId,
      invitedByUserId: input.invitedByUserId,
      boardId: input.boardId,
      email: invitation.email,
      token,
      accessRole: invitation.accessRole,
      status: "pending",
    });
    if (!member.isActive) {
      await tx
        .update(teamMembers)
        .set({ isActive: true })
        .where(eq(teamMembers.id, input.memberId));
    }
  });
  return {
    token,
    memberId: input.memberId,
    invitePath: `/invite/${token}`,
  };
}

export async function getPendingInvitationForSignup(
  token: string,
  email: string
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.token, token),
        eq(teamInvitations.status, "pending")
      )
    )
    .limit(1);
  const invitation = rows[0];
  if (
    !invitation ||
    invitation.email.toLowerCase() !== email.trim().toLowerCase()
  )
    return null;
  return invitation;
}

export async function listTeamInvitations(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const activeBoardId = await getActiveBoardId(userId);
  if (!activeBoardId) return [];
  return db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.boardId, activeBoardId));
}

export async function createManagerInvitation(
  input: { name: string; email: string },
  invitedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const email = input.email.trim().toLowerCase();
  const account = await getUserByOpenId(localUserId(email));
  if (account?.role === "admin" || account?.role === "manager")
    throw new Error("هذا المستخدم مدير في المنصة بالفعل");

  const pending = await db
    .select({ id: managerInvitations.id })
    .from(managerInvitations)
    .where(
      and(
        eq(managerInvitations.email, email),
        eq(managerInvitations.status, "pending")
      )
    )
    .limit(1);
  const token = nanoid(32);
  if (pending[0]) {
    await db
      .update(managerInvitations)
      .set({ name: input.name, token, invitedByUserId })
      .where(eq(managerInvitations.id, pending[0].id));
    return {
      id: pending[0].id,
      token,
      invitePath: `/manager-invite/${token}`,
    };
  }

  const result = await db.insert(managerInvitations).values({
    name: input.name,
    email,
    token,
    invitedByUserId,
    status: "pending",
  });
  return {
    id: Number(result[0].insertId),
    token,
    invitePath: `/manager-invite/${token}`,
  };
}

export async function getManagerInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select()
    .from(managerInvitations)
    .where(eq(managerInvitations.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPendingManagerInvitationForSignup(
  token: string,
  email: string
) {
  const invitation = await getManagerInvitationByToken(token);
  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.email.toLowerCase() !== email.trim().toLowerCase()
  )
    return null;
  return invitation;
}

export async function acceptManagerInvitation(
  token: string,
  user: { id: number; email: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const invitation = await getManagerInvitationByToken(token);
  if (!invitation || invitation.status === "cancelled")
    throw new Error("رابط الدعوة غير صالح أو تم إلغاؤه");
  if (
    !user.email ||
    user.email.toLowerCase() !== invitation.email.toLowerCase()
  )
    throw new Error("سجّل الدخول بالبريد الإلكتروني الذي أُرسلت إليه الدعوة");

  await db.update(users).set({ role: "manager" }).where(eq(users.id, user.id));
  if (invitation.status !== "accepted")
    await db
      .update(managerInvitations)
      .set({
        status: "accepted",
        acceptedByUserId: user.id,
        acceptedAt: new Date(),
        cancelledAt: null,
      })
      .where(eq(managerInvitations.id, invitation.id));
  return { success: true as const };
}

export async function cancelManagerInvitation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await db
    .update(managerInvitations)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(managerInvitations.id, id));
  return { success: true as const };
}

export async function reissueManagerInvitation(
  id: number,
  invitedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const existing = await db
    .select({ id: managerInvitations.id })
    .from(managerInvitations)
    .where(eq(managerInvitations.id, id))
    .limit(1);
  if (!existing[0]) throw new Error("لم نعثر على الدعوة");
  const token = nanoid(32);
  await db
    .update(managerInvitations)
    .set({
      token,
      invitedByUserId,
      status: "pending",
      acceptedByUserId: null,
      acceptedAt: null,
      cancelledAt: null,
    })
    .where(eq(managerInvitations.id, id));
  return { token, invitePath: `/manager-invite/${token}` };
}

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const [
    managerRows,
    boardRows,
    invitationRows,
    userRows,
    membershipRows,
    memberRows,
    teamInvitationRows,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .where(eq(users.role, "manager")),
    db
      .select({
        id: managementBoards.id,
        name: managementBoards.name,
        ownerUserId: managementBoards.ownerUserId,
        createdAt: managementBoards.createdAt,
      })
      .from(managementBoards),
    db.select().from(managerInvitations),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users),
    db.select().from(boardMemberships),
    db.select().from(teamMembers),
    db.select().from(teamInvitations),
  ]);
  const boardsWithMembers = boardRows.map(board => ({
    ...board,
    members: memberRows
      .filter(member => member.boardId === board.id)
      .map(member => {
        const account = member.userId
          ? userRows.find(user => user.id === member.userId)
          : null;
        const membership = member.userId
          ? membershipRows.find(
              item => item.boardId === board.id && item.userId === member.userId
            )
          : null;
        const latestInvitation = teamInvitationRows
          .filter(invitation => invitation.memberId === member.id)
          .sort((a, b) => b.id - a.id)[0];
        return {
          ...member,
          accessRole: membership?.role ?? latestInvitation?.accessRole ?? null,
          accountRole: account?.role ?? null,
          isOwner: member.userId === board.ownerUserId,
          invitationStatus: latestInvitation?.status ?? null,
          accessStatus: !member.isActive
            ? ("inactive" as const)
            : membership
              ? ("active" as const)
              : latestInvitation?.status === "pending"
                ? ("pending" as const)
                : ("inactive" as const),
        };
      }),
  }));
  return {
    managerCount: managerRows.length,
    boardCount: boardRows.length,
    userCount: userRows.length,
    memberCount: memberRows.filter(member => member.isActive).length,
    pendingInvitationCount: invitationRows.filter(
      invitation => invitation.status === "pending"
    ).length,
    managers: managerRows.map(manager => ({
      ...manager,
      boards: boardRows.filter(board => board.ownerUserId === manager.id),
    })),
    boards: boardsWithMembers,
    invitations: invitationRows,
  };
}

export async function getBoardTeamAdministration(boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const [
    boardRows,
    memberRows,
    membershipRows,
    userRows,
    invitationRows,
    projectRows,
  ] = await Promise.all([
    db
      .select({
        id: managementBoards.id,
        name: managementBoards.name,
        ownerUserId: managementBoards.ownerUserId,
      })
      .from(managementBoards)
      .where(eq(managementBoards.id, boardId))
      .limit(1),
    db.select().from(teamMembers).where(eq(teamMembers.boardId, boardId)),
    db
      .select()
      .from(boardMemberships)
      .where(eq(boardMemberships.boardId, boardId)),
    db
      .select({
        id: users.id,
        role: users.role,
      })
      .from(users),
    db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.boardId, boardId)),
    db
      .select({ id: projects.id, title: projects.title })
      .from(projects)
      .where(eq(projects.boardId, boardId))
      .orderBy(projects.title),
  ]);
  const board = boardRows[0];
  if (!board) throw new Error("لم نعثر على اللوحة الحالية");
  return {
    board: { id: board.id, name: board.name },
    projects: projectRows,
    members: memberRows.map(member => {
      const account = member.userId
        ? userRows.find(user => user.id === member.userId)
        : null;
      const membership = member.userId
        ? membershipRows.find(item => item.userId === member.userId)
        : null;
      const latestInvitation = invitationRows
        .filter(invitation => invitation.memberId === member.id)
        .sort((a, b) => b.id - a.id)[0];
      return {
        ...member,
        accessRole: membership?.role ?? latestInvitation?.accessRole ?? null,
        accountRole: account?.role ?? null,
        isOwner: member.userId === board.ownerUserId,
        invitationStatus: latestInvitation?.status ?? null,
        accessStatus: !member.isActive
          ? ("inactive" as const)
          : membership
            ? ("active" as const)
            : latestInvitation?.status === "pending"
              ? ("pending" as const)
              : ("inactive" as const),
      };
    }),
  };
}

export async function updateBoardMemberAccess(input: {
  memberId: number;
  accessRole: BoardRole;
  boardId?: number;
  actingUserId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({
      memberId: teamMembers.id,
      boardId: teamMembers.boardId,
      userId: teamMembers.userId,
      ownerUserId: managementBoards.ownerUserId,
    })
    .from(teamMembers)
    .innerJoin(managementBoards, eq(teamMembers.boardId, managementBoards.id))
    .where(
      input.boardId
        ? and(
            eq(teamMembers.id, input.memberId),
            eq(teamMembers.boardId, input.boardId)
          )
        : eq(teamMembers.id, input.memberId)
    )
    .limit(1);
  const member = rows[0];
  if (!member?.boardId || !member.userId)
    throw new Error("لم يفعّل هذا العضو حسابه بعد");
  if (member.ownerUserId === member.userId && input.accessRole !== "manager")
    throw new Error("لا يمكن تخفيض صلاحية مدير اللوحة الأساسي");
  if (member.userId === input.actingUserId && input.accessRole !== "manager")
    throw new Error("لا يمكنك تخفيض صلاحية حسابك الحالي");
  const result = await db
    .update(boardMemberships)
    .set({ role: input.accessRole })
    .where(
      and(
        eq(boardMemberships.boardId, member.boardId),
        eq(boardMemberships.userId, member.userId)
      )
    );
  if (!result[0].affectedRows)
    throw new Error("لا توجد عضوية نشطة لهذا المستخدم");
  await db
    .update(teamMembers)
    .set({
      isActive: true,
      ...(input.accessRole === "member"
        ? {}
        : { projectAccess: "all" as const, allowedProjectIds: null }),
    })
    .where(eq(teamMembers.id, member.memberId));
  return { success: true as const };
}

export async function updateTeamMemberProjectAccess(input: {
  memberId: number;
  boardId: number;
  projectAccess: ProjectAccess;
  allowedProjectIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({
      memberId: teamMembers.id,
      userId: teamMembers.userId,
      ownerUserId: managementBoards.ownerUserId,
    })
    .from(teamMembers)
    .innerJoin(managementBoards, eq(teamMembers.boardId, managementBoards.id))
    .where(
      and(
        eq(teamMembers.id, input.memberId),
        eq(teamMembers.boardId, input.boardId)
      )
    )
    .limit(1);
  const member = rows[0];
  if (!member) throw new Error("لم نعثر على عضو الفريق");
  if (member.userId === member.ownerUserId && input.projectAccess !== "all")
    throw new Error("مدير اللوحة الأساسي يرى جميع المشاريع دائمًا");

  const memberships = member.userId
    ? await db
        .select({ role: boardMemberships.role })
        .from(boardMemberships)
        .where(
          and(
            eq(boardMemberships.boardId, input.boardId),
            eq(boardMemberships.userId, member.userId)
          )
        )
        .limit(1)
    : [];
  const invitations = !member.userId
    ? await db
        .select({ accessRole: teamInvitations.accessRole })
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.memberId, input.memberId),
            eq(teamInvitations.boardId, input.boardId),
            eq(teamInvitations.status, "pending")
          )
        )
        .orderBy(desc(teamInvitations.id))
        .limit(1)
    : [];
  const accessRole = memberships[0]?.role ?? invitations[0]?.accessRole;
  if (accessRole !== "member")
    throw new Error("تحديد مشاريع بعينها متاح لحسابات الأعضاء فقط");

  const projectIds =
    input.projectAccess === "selected"
      ? Array.from(new Set(input.allowedProjectIds))
      : [];
  if (projectIds.length) {
    const allowedProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.boardId, input.boardId),
          inArray(projects.id, projectIds)
        )
      );
    if (allowedProjects.length !== projectIds.length)
      throw new Error("بعض المشاريع المختارة لا تنتمي إلى اللوحة الحالية");
  }
  await db
    .update(teamMembers)
    .set({
      projectAccess: input.projectAccess,
      allowedProjectIds: input.projectAccess === "selected" ? projectIds : null,
    })
    .where(
      and(
        eq(teamMembers.id, input.memberId),
        eq(teamMembers.boardId, input.boardId)
      )
    );
  return { success: true as const };
}

export async function setBoardMemberActive(input: {
  memberId: number;
  active: boolean;
  actingUserId: number;
  boardId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({
      memberId: teamMembers.id,
      boardId: teamMembers.boardId,
      userId: teamMembers.userId,
      ownerUserId: managementBoards.ownerUserId,
    })
    .from(teamMembers)
    .innerJoin(managementBoards, eq(teamMembers.boardId, managementBoards.id))
    .where(
      input.boardId
        ? and(
            eq(teamMembers.id, input.memberId),
            eq(teamMembers.boardId, input.boardId)
          )
        : eq(teamMembers.id, input.memberId)
    )
    .limit(1);
  const member = rows[0];
  if (!member?.boardId) throw new Error("لم نعثر على عضو الفريق");

  if (!input.active) {
    if (member.userId === member.ownerUserId)
      throw new Error("لا يمكن إيقاف مدير اللوحة الأساسي");
    if (member.userId === input.actingUserId)
      throw new Error("لا يمكنك إيقاف وصول حسابك الحالي");
    await db
      .update(teamMembers)
      .set({ isActive: false })
      .where(eq(teamMembers.id, member.memberId));
    await db
      .update(teamInvitations)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(teamInvitations.memberId, member.memberId),
          eq(teamInvitations.status, "pending")
        )
      );
    if (member.userId) {
      await db
        .delete(boardMemberships)
        .where(
          and(
            eq(boardMemberships.boardId, member.boardId),
            eq(boardMemberships.userId, member.userId)
          )
        );
      await db
        .update(users)
        .set({ activeBoardId: null })
        .where(
          and(
            eq(users.id, member.userId),
            eq(users.activeBoardId, member.boardId)
          )
        );
    }
    return { success: true as const };
  }

  if (!member.userId)
    throw new Error("أرسل دعوة جديدة لهذا العضو ليتمكن من تفعيل حسابه");
  await db
    .insert(boardMemberships)
    .values({ boardId: member.boardId, userId: member.userId, role: "member" })
    .onDuplicateKeyUpdate({ set: { role: "member" } });
  await db
    .update(teamMembers)
    .set({ isActive: true })
    .where(eq(teamMembers.id, member.memberId));
  return { success: true as const };
}

export async function deleteTeamMember(input: {
  memberId: number;
  boardId: number;
  actingUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({
      memberId: teamMembers.id,
      boardId: teamMembers.boardId,
      userId: teamMembers.userId,
      ownerUserId: managementBoards.ownerUserId,
    })
    .from(teamMembers)
    .innerJoin(managementBoards, eq(teamMembers.boardId, managementBoards.id))
    .where(
      and(
        eq(teamMembers.id, input.memberId),
        eq(teamMembers.boardId, input.boardId)
      )
    )
    .limit(1);
  const member = rows[0];
  if (!member?.boardId) throw new Error("لم نعثر على عضو الفريق");
  if (member.userId === member.ownerUserId)
    throw new Error("لا يمكن حذف مدير اللوحة الأساسي");
  if (member.userId === input.actingUserId)
    throw new Error("لا يمكنك حذف حسابك الحالي من الفريق");

  const linkedRecords = await Promise.all([
    db
      .select({ id: annualGoals.id })
      .from(annualGoals)
      .where(eq(annualGoals.ownerMemberId, input.memberId))
      .limit(1),
    db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.ownerMemberId, input.memberId))
      .limit(1),
    db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(eq(projectMembers.memberId, input.memberId))
      .limit(1),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.assigneeMemberId, input.memberId))
      .limit(1),
    db
      .select({ id: taskParticipants.id })
      .from(taskParticipants)
      .where(eq(taskParticipants.memberId, input.memberId))
      .limit(1),
    db
      .select({ id: taskAssignees.id })
      .from(taskAssignees)
      .where(eq(taskAssignees.memberId, input.memberId))
      .limit(1),
    db
      .select({ id: taskChecklistItems.id })
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.assigneeMemberId, input.memberId))
      .limit(1),
    db
      .select({ id: taskComments.id })
      .from(taskComments)
      .where(eq(taskComments.authorMemberId, input.memberId))
      .limit(1),
    db
      .select({ id: taskAttachments.id })
      .from(taskAttachments)
      .where(eq(taskAttachments.uploadedByMemberId, input.memberId))
      .limit(1),
  ]);
  if (linkedRecords.some(records => records.length > 0)) {
    throw new Error(
      "لا يمكن حذف العضو لأن لديه أعمالًا مرتبطة. أوقف وصوله للاحتفاظ بسجل العمل."
    );
  }

  await db.transaction(async tx => {
    await tx
      .delete(teamInvitations)
      .where(eq(teamInvitations.memberId, input.memberId));
    if (member.userId) {
      await tx
        .delete(boardMemberships)
        .where(
          and(
            eq(boardMemberships.boardId, input.boardId),
            eq(boardMemberships.userId, member.userId)
          )
        );
      await tx
        .update(users)
        .set({ activeBoardId: null })
        .where(
          and(
            eq(users.id, member.userId),
            eq(users.activeBoardId, input.boardId)
          )
        );
    }
    await tx.delete(teamMembers).where(eq(teamMembers.id, input.memberId));
  });
  return { success: true as const };
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const invitation = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .limit(1);
  if (!invitation[0]) return null;
  const member = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, invitation[0].memberId))
    .limit(1);
  const board = invitation[0].boardId
    ? await db
        .select({ id: managementBoards.id, name: managementBoards.name })
        .from(managementBoards)
        .where(eq(managementBoards.id, invitation[0].boardId))
        .limit(1)
    : [];
  return {
    invitation: invitation[0],
    member: member[0] ?? null,
    board: board[0] ?? null,
  };
}

export async function acceptTeamInvitation(
  token: string,
  user: { id: number; email: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const invitation = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .limit(1);
  const item = invitation[0];
  if (!item || item.status === "cancelled")
    throw new Error("رابط الدعوة غير صالح أو تم إلغاؤه");
  if (!user.email || user.email.toLowerCase() !== item.email.toLowerCase())
    throw new Error("سجّل الدخول بالبريد الإلكتروني الذي أُرسلت إليه الدعوة");
  await db
    .update(teamMembers)
    .set({ userId: user.id })
    .where(eq(teamMembers.id, item.memberId));
  if (item.status !== "accepted")
    await db
      .update(teamInvitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(teamInvitations.id, item.id));
  if (item.boardId)
    await joinManagementBoard(item.boardId, user.id, item.accessRole);
  return { success: true as const, boardId: item.boardId };
}

export async function addDeliverableComment(input: {
  deliverableId: number;
  authorUserId: number;
  body: string;
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const allowed = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .innerJoin(projects, eq(deliverables.projectId, projects.id))
    .where(
      and(
        eq(deliverables.id, input.deliverableId),
        eq(projects.boardId, input.boardId)
      )
    )
    .limit(1);
  if (!allowed[0]) throw new Error("المخرج غير موجود في اللوحة الحالية");
  await db.insert(deliverableComments).values({
    deliverableId: input.deliverableId,
    authorUserId: input.authorUserId,
    body: input.body,
  });
}

const d = (value: string) => new Date(`${value}T09:00:00.000Z`);

async function ensureDemoData() {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .limit(1);
  if (existing.length) return;

  await db.insert(teamMembers).values([
    {
      name: "سارة الحربي",
      role: "مديرة القسم",
      avatarInitials: "سح",
      color: "#52769F",
    },
    {
      name: "عمر العتيبي",
      role: "قائد المشاريع",
      avatarInitials: "عع",
      color: "#6C8FB8",
    },
    {
      name: "نورة السالم",
      role: "أخصائية المحتوى",
      avatarInitials: "نس",
      color: "#839EBE",
    },
    {
      name: "فيصل القحطاني",
      role: "محلل أعمال",
      avatarInitials: "فق",
      color: "#94AABD",
    },
    {
      name: "ريم الدوسري",
      role: "مصممة تجربة",
      avatarInitials: "رد",
      color: "#7899B7",
    },
    {
      name: "خالد الغامدي",
      role: "منسق عمليات",
      avatarInitials: "خغ",
      color: "#A2B3C3",
    },
  ]);
  const members = await db.select().from(teamMembers);
  const byName = (name: string) => members.find(m => m.name === name)!.id;

  await db.insert(annualGoals).values([
    {
      title: "رفع جودة المحتوى",
      theme: "تجربة المستفيد",
      year: 2026,
      ownerMemberId: byName("نورة السالم"),
      progress: 70,
      status: "on_track",
    },
    {
      title: "تطوير الحلول الرقمية",
      theme: "التحول الرقمي",
      year: 2026,
      ownerMemberId: byName("عمر العتيبي"),
      progress: 60,
      status: "attention",
    },
    {
      title: "بناء القدرات",
      theme: "تمكين الفريق",
      year: 2026,
      ownerMemberId: byName("سارة الحربي"),
      progress: 80,
      status: "on_track",
    },
    {
      title: "تعزيز الشراكات",
      theme: "الأثر المؤسسي",
      year: 2026,
      ownerMemberId: byName("خالد الغامدي"),
      progress: 55,
      status: "at_risk",
    },
  ]);
  const goals = await db.select().from(annualGoals);
  const goal = (title: string) => goals.find(item => item.title === title)!.id;

  await db.insert(projects).values([
    {
      title: "بوابة الخدمات الرقمية",
      summary: "تطوير تجربة موحدة للخدمات ذات الأولوية.",
      annualGoalId: goal("تطوير الحلول الرقمية"),
      ownerMemberId: byName("عمر العتيبي"),
      startDate: d("2026-07-01"),
      endDate: d("2026-09-30"),
      progress: 61,
      status: "in_progress",
    },
    {
      title: "دليل المحتوى المؤسسي",
      summary: "دليل موحد لأسلوب المحتوى والنشر.",
      annualGoalId: goal("رفع جودة المحتوى"),
      ownerMemberId: byName("نورة السالم"),
      startDate: d("2026-07-15"),
      endDate: d("2026-09-15"),
      progress: 72,
      status: "in_review",
    },
    {
      title: "برنامج بناء القدرات",
      summary: "مسار تعلم داخلي للفريق.",
      annualGoalId: goal("بناء القدرات"),
      ownerMemberId: byName("سارة الحربي"),
      startDate: d("2026-06-01"),
      endDate: d("2026-11-30"),
      progress: 76,
      status: "in_progress",
    },
    {
      title: "منصة الشراكات",
      summary: "نموذج موحد لفرص وتقييم الشراكات.",
      annualGoalId: goal("تعزيز الشراكات"),
      ownerMemberId: byName("خالد الغامدي"),
      startDate: d("2026-08-01"),
      endDate: d("2026-10-31"),
      progress: 38,
      status: "blocked",
    },
    {
      title: "تحسين رحلة المستفيد",
      summary: "بحث وتحسين نقاط الاتصال الرئيسية.",
      annualGoalId: goal("رفع جودة المحتوى"),
      ownerMemberId: byName("ريم الدوسري"),
      startDate: d("2026-07-01"),
      endDate: d("2026-10-15"),
      progress: 52,
      status: "in_progress",
    },
    {
      title: "تقرير الأداء الربع سنوي",
      summary: "تجهيز تقرير موحد للإدارة.",
      annualGoalId: goal("تطوير الحلول الرقمية"),
      ownerMemberId: byName("فيصل القحطاني"),
      startDate: d("2026-08-01"),
      endDate: d("2026-09-20"),
      progress: 44,
      status: "in_progress",
    },
  ]);
  const allProjects = await db.select().from(projects);
  const project = (title: string) =>
    allProjects.find(item => item.title === title)!.id;

  await db
    .insert(projectMembers)
    .values(
      allProjects.flatMap(item =>
        members
          .slice(0, 3)
          .map(member => ({ projectId: item.id, memberId: member.id }))
      )
    );
  await db.insert(deliverables).values([
    {
      projectId: project("بوابة الخدمات الرقمية"),
      title: "النموذج الأولي",
      dueDate: d("2026-08-21"),
      progress: 100,
      status: "complete",
    },
    {
      projectId: project("بوابة الخدمات الرقمية"),
      title: "دليل الاستخدام",
      dueDate: d("2026-09-10"),
      progress: 65,
      status: "in_progress",
    },
    {
      projectId: project("بوابة الخدمات الرقمية"),
      title: "التقرير النهائي",
      dueDate: d("2026-09-30"),
      progress: 0,
      status: "not_started",
    },
    {
      projectId: project("دليل المحتوى المؤسسي"),
      title: "مسودة الدليل",
      dueDate: d("2026-08-28"),
      progress: 100,
      status: "complete",
    },
    {
      projectId: project("تقرير الأداء الربع سنوي"),
      title: "لوحة المؤشرات",
      dueDate: d("2026-09-20"),
      progress: 45,
      status: "in_progress",
    },
  ]);
  const outputs = await db.select().from(deliverables);
  const output = (title: string) =>
    outputs.find(item => item.title === title)!.id;

  await db.insert(tasks).values([
    {
      title: "اعتماد تقرير المشروع",
      projectId: project("تقرير الأداء الربع سنوي"),
      assigneeMemberId: byName("سارة الحربي"),
      startDate: d("2026-08-20"),
      dueDate: d("2026-08-24"),
      priority: "urgent",
      status: "overdue",
      isApprovalPending: true,
    },
    {
      title: "تحديث واجهات النموذج الأولي",
      projectId: project("بوابة الخدمات الرقمية"),
      deliverableId: output("النموذج الأولي"),
      assigneeMemberId: byName("ريم الدوسري"),
      startDate: d("2026-08-24"),
      dueDate: d("2026-08-27"),
      priority: "high",
      status: "in_progress",
    },
    {
      title: "مراجعة دليل الاستخدام",
      projectId: project("بوابة الخدمات الرقمية"),
      deliverableId: output("دليل الاستخدام"),
      assigneeMemberId: byName("نورة السالم"),
      startDate: d("2026-08-23"),
      dueDate: d("2026-08-28"),
      priority: "high",
      status: "in_review",
    },
    {
      title: "تنسيق ورشة الفريق",
      projectId: project("برنامج بناء القدرات"),
      assigneeMemberId: byName("خالد الغامدي"),
      startDate: d("2026-08-25"),
      dueDate: d("2026-08-26"),
      priority: "medium",
      status: "in_progress",
    },
    {
      title: "تحليل ملاحظات المستفيدين",
      projectId: project("تحسين رحلة المستفيد"),
      assigneeMemberId: byName("فيصل القحطاني"),
      startDate: d("2026-08-24"),
      dueDate: d("2026-08-29"),
      priority: "medium",
      status: "in_progress",
    },
    {
      title: "إعداد نموذج تقييم الشراكات",
      projectId: project("منصة الشراكات"),
      assigneeMemberId: byName("خالد الغامدي"),
      startDate: d("2026-08-18"),
      dueDate: d("2026-08-30"),
      priority: "high",
      status: "not_started",
    },
    {
      title: "صياغة مقدمة الدليل",
      projectId: project("دليل المحتوى المؤسسي"),
      deliverableId: output("مسودة الدليل"),
      assigneeMemberId: byName("نورة السالم"),
      startDate: d("2026-08-20"),
      dueDate: d("2026-08-25"),
      priority: "medium",
      status: "complete",
    },
    {
      title: "توثيق مؤشرات الأداء",
      projectId: project("تقرير الأداء الربع سنوي"),
      deliverableId: output("لوحة المؤشرات"),
      assigneeMemberId: byName("فيصل القحطاني"),
      startDate: d("2026-08-21"),
      dueDate: d("2026-08-31"),
      priority: "high",
      status: "in_progress",
    },
    {
      title: "اختبار رحلة التسجيل",
      projectId: project("بوابة الخدمات الرقمية"),
      assigneeMemberId: byName("عمر العتيبي"),
      startDate: d("2026-08-25"),
      dueDate: d("2026-08-28"),
      priority: "medium",
      status: "not_started",
    },
    {
      title: "تجهيز تقرير الورشة",
      projectId: project("برنامج بناء القدرات"),
      assigneeMemberId: byName("سارة الحربي"),
      startDate: d("2026-08-26"),
      dueDate: d("2026-09-02"),
      priority: "low",
      status: "not_started",
    },
    {
      title: "بحث مقارنة السوق",
      projectId: project("منصة الشراكات"),
      assigneeMemberId: byName("خالد الغامدي"),
      startDate: d("2026-08-19"),
      dueDate: d("2026-08-26"),
      priority: "high",
      status: "overdue",
    },
    {
      title: "عرض نتائج المقابلات",
      projectId: project("تحسين رحلة المستفيد"),
      assigneeMemberId: byName("ريم الدوسري"),
      startDate: d("2026-08-23"),
      dueDate: d("2026-08-27"),
      priority: "medium",
      status: "in_review",
    },
    {
      title: "توحيد مسميات الخدمات",
      projectId: project("بوابة الخدمات الرقمية"),
      assigneeMemberId: byName("نورة السالم"),
      startDate: d("2026-08-24"),
      dueDate: d("2026-08-28"),
      priority: "low",
      status: "not_started",
    },
    {
      title: "مراجعة خارطة القدرات",
      projectId: project("برنامج بناء القدرات"),
      assigneeMemberId: byName("سارة الحربي"),
      startDate: d("2026-08-22"),
      dueDate: d("2026-08-29"),
      priority: "high",
      status: "complete",
    },
    {
      title: "إعداد البيانات المصدرية",
      projectId: project("تقرير الأداء الربع سنوي"),
      assigneeMemberId: byName("فيصل القحطاني"),
      startDate: d("2026-08-20"),
      dueDate: d("2026-08-27"),
      priority: "high",
      status: "complete",
    },
    {
      title: "تنسيق اجتماع الإطلاق",
      projectId: project("بوابة الخدمات الرقمية"),
      assigneeMemberId: byName("خالد الغامدي"),
      startDate: d("2026-08-25"),
      dueDate: d("2026-08-26"),
      priority: "medium",
      status: "not_started",
    },
    {
      title: "جمع الاحتياجات",
      projectId: project("تحسين رحلة المستفيد"),
      assigneeMemberId: byName("ريم الدوسري"),
      startDate: d("2026-08-18"),
      dueDate: d("2026-08-24"),
      priority: "low",
      status: "complete",
    },
    {
      title: "تدقيق بيانات التقرير",
      projectId: project("تقرير الأداء الربع سنوي"),
      assigneeMemberId: byName("عمر العتيبي"),
      startDate: d("2026-08-23"),
      dueDate: d("2026-08-28"),
      priority: "medium",
      status: "in_progress",
    },
  ]);
  const seededTasks = await db.select().from(tasks);
  await db
    .insert(taskParticipants)
    .values(
      seededTasks
        .slice(0, 8)
        .map(item => ({ taskId: item.id, memberId: byName("عمر العتيبي") }))
    );
  await db.insert(calendarEvents).values([
    {
      title: "اجتماع متابعة القسم",
      eventDate: d("2026-08-26"),
      type: "meeting",
    },
    {
      title: "تسليم دليل المحتوى",
      projectId: project("دليل المحتوى المؤسسي"),
      eventDate: d("2026-08-28"),
      type: "delivery",
    },
    {
      title: "ورشة بناء القدرات",
      projectId: project("برنامج بناء القدرات"),
      eventDate: d("2026-09-03"),
      type: "workshop",
    },
    {
      title: "إطلاق النسخة التجريبية",
      projectId: project("بوابة الخدمات الرقمية"),
      eventDate: d("2026-09-10"),
      type: "launch",
    },
    {
      title: "تسليم تقرير الأداء",
      projectId: project("تقرير الأداء الربع سنوي"),
      eventDate: d("2026-09-20"),
      type: "delivery",
    },
  ]);
}

export async function getWorkspaceData(boardId: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const access = userId
    ? await getUserProjectAccess(userId, boardId)
    : { restricted: false, projectIds: [] as number[] };
  const [
    goals,
    members,
    projectRows,
    taskRows,
    eventRows,
    lessonRows,
    userRows,
  ] = await Promise.all([
    db.select().from(annualGoals).where(eq(annualGoals.boardId, boardId)),
    db
      .select()
      .from(teamMembers)
      .where(
        and(eq(teamMembers.boardId, boardId), eq(teamMembers.isActive, true))
      ),
    db.select().from(projects).where(eq(projects.boardId, boardId)),
    db.select().from(tasks).where(eq(tasks.boardId, boardId)),
    db.select().from(calendarEvents).where(eq(calendarEvents.boardId, boardId)),
    db.select().from(lessonsLearned).where(eq(lessonsLearned.boardId, boardId)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const allowedProjectIds = new Set(access.projectIds);
  const visibleProjects = access.restricted
    ? projectRows.filter(project => allowedProjectIds.has(project.id))
    : projectRows;
  const visibleTasks = access.restricted
    ? taskRows.filter(
        task => !task.projectId || allowedProjectIds.has(task.projectId)
      )
    : taskRows;
  const visibleEvents = access.restricted
    ? eventRows.filter(
        event => !event.projectId || allowedProjectIds.has(event.projectId)
      )
    : eventRows;
  const visibleLessons = access.restricted
    ? lessonRows.filter(item => allowedProjectIds.has(item.projectId))
    : lessonRows;
  const projectIds = visibleProjects.map(project => project.id);
  const taskIds = visibleTasks.map(task => task.id);
  const [deliverableRows, projectMemberRows] = projectIds.length
    ? await Promise.all([
        db
          .select()
          .from(deliverables)
          .where(inArray(deliverables.projectId, projectIds)),
        db
          .select()
          .from(projectMembers)
          .where(inArray(projectMembers.projectId, projectIds)),
      ])
    : [[], []];
  const [taskCommentRows, taskAssigneeRows, checklistRows] = taskIds.length
    ? await Promise.all([
        db
          .select()
          .from(taskComments)
          .where(inArray(taskComments.taskId, taskIds)),
        db
          .select()
          .from(taskAssignees)
          .where(inArray(taskAssignees.taskId, taskIds)),
        db
          .select()
          .from(taskChecklistItems)
          .where(inArray(taskChecklistItems.taskId, taskIds)),
      ])
    : [[], [], []];
  const deliverableIds = deliverableRows.map(deliverable => deliverable.id);
  const commentRows = deliverableIds.length
    ? await db
        .select()
        .from(deliverableComments)
        .where(inArray(deliverableComments.deliverableId, deliverableIds))
    : [];
  const enrichedTasks = visibleTasks.map(task => {
    const assignedIds = taskAssigneeRows
      .filter(item => item.taskId === task.id)
      .map(item => item.memberId);
    return {
      ...task,
      assigneeMemberIds:
        assignedIds.length > 0
          ? Array.from(new Set(assignedIds))
          : task.assigneeMemberId
            ? [task.assigneeMemberId]
            : [],
    };
  });
  const enrichedMembers = members.map(member => {
    return { ...member, ...calculateWorkload(enrichedTasks, member.id) };
  });
  const enrichedProjects = visibleProjects.map(project => {
    const responsibleMemberIds = Array.from(
      new Set(
        projectMemberRows
          .filter(item => item.projectId === project.id)
          .map(item => item.memberId)
      )
    );
    return {
      ...project,
      responsibleMemberIds: responsibleMemberIds.length
        ? responsibleMemberIds
        : [project.ownerMemberId],
    };
  });
  const enrichedGoals = goals.map(goal => {
    const linkedProjects = enrichedProjects.filter(
      project => project.annualGoalId === goal.id
    );
    return {
      ...goal,
      progress: linkedProjects.length
        ? calculateGoalProgress(linkedProjects)
        : goal.progress,
    };
  });
  const enrichedComments = commentRows.map(comment => ({
    ...comment,
    authorName:
      userRows.find(user => user.id === comment.authorUserId)?.name ??
      "عضو الفريق",
  }));
  const enrichedLessons = visibleLessons.map(item => ({
    ...item,
    projectTitle:
      visibleProjects.find(project => project.id === item.projectId)?.title ??
      "مشروع غير متاح",
    authorName:
      userRows.find(user => user.id === item.createdByUserId)?.name ??
      "عضو الفريق",
  }));
  const enrichedTaskComments = taskCommentRows.map(comment => ({
    ...comment,
    authorName:
      members.find(member => member.id === comment.authorMemberId)?.name ??
      "عضو الفريق",
    authorUserId:
      members.find(member => member.id === comment.authorMemberId)?.userId ??
      null,
  }));
  return {
    boardId,
    goals: enrichedGoals,
    members: enrichedMembers,
    projects: enrichedProjects,
    deliverables: deliverableRows,
    tasks: enrichedTasks,
    taskChecklistItems: checklistRows,
    events: visibleEvents,
    lessons: enrichedLessons,
    taskComments: enrichedTaskComments,
    deliverableComments: enrichedComments,
  };
}

export async function getTeamWorkload(boardId: number, userId?: number) {
  const workspace = await getWorkspaceData(boardId, userId);
  return workspace.members;
}

export async function getReportSummary(boardId: number, userId?: number) {
  const workspace = await getWorkspaceData(boardId, userId);
  return summarizeTasks(workspace.tasks);
}

export async function addTaskComment(input: {
  taskId: number;
  authorUserId: number;
  body: string;
  boardId: number;
  replyToCommentId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const [allowedTask, allowedAuthor] = await Promise.all([
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), eq(tasks.boardId, input.boardId)))
      .limit(1),
    db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, input.authorUserId),
          eq(teamMembers.boardId, input.boardId),
          eq(teamMembers.isActive, true)
        )
      )
      .limit(1),
  ]);
  if (!allowedTask[0] || !allowedAuthor[0])
    throw new Error("لا يمكن إضافة التعليق خارج اللوحة الحالية");
  if (input.replyToCommentId) {
    const parent = await db
      .select({ id: taskComments.id })
      .from(taskComments)
      .where(
        and(
          eq(taskComments.id, input.replyToCommentId),
          eq(taskComments.taskId, input.taskId)
        )
      )
      .limit(1);
    if (!parent[0]) throw new Error("التعليق الذي ترد عليه غير موجود");
  }
  const created = await db.insert(taskComments).values({
    taskId: input.taskId,
    authorMemberId: allowedAuthor[0].id,
    replyToCommentId: input.replyToCommentId ?? null,
    body: input.body,
  });
  return { id: Number(created[0].insertId) };
}

export async function updateTaskComment(input: {
  id: number;
  actingUserId: number;
  boardId: number;
  body: string;
  canModerate: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await db
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      body: taskComments.body,
      authorUserId: teamMembers.userId,
    })
    .from(taskComments)
    .innerJoin(tasks, eq(taskComments.taskId, tasks.id))
    .innerJoin(teamMembers, eq(taskComments.authorMemberId, teamMembers.id))
    .where(and(eq(taskComments.id, input.id), eq(tasks.boardId, input.boardId)))
    .limit(1);
  const comment = rows[0];
  if (!comment) throw new Error("التعليق غير موجود في اللوحة الحالية");
  if (comment.authorUserId !== input.actingUserId && !input.canModerate)
    throw new Error("يمكنك تعديل تعليقاتك فقط");
  await db
    .update(taskComments)
    .set({ body: input.body.trim() })
    .where(eq(taskComments.id, input.id));
  return {
    success: true as const,
    taskId: comment.taskId,
    previousBody: comment.body,
  };
}

export async function createAnnualGoal(input: {
  title: string;
  theme: string;
  year: number;
  ownerMemberId: number;
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const owner = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, input.ownerMemberId),
        eq(teamMembers.boardId, input.boardId),
        eq(teamMembers.isActive, true)
      )
    )
    .limit(1);
  if (!owner[0])
    throw new Error("مسؤول الهدف ليس عضوًا نشطًا في اللوحة الحالية");
  const result = await db.insert(annualGoals).values({
    boardId: input.boardId,
    title: input.title,
    theme: input.theme,
    year: input.year,
    ownerMemberId: input.ownerMemberId,
    progress: 0,
    status: "on_track",
  });
  return { id: Number(result[0].insertId) };
}

export async function updateAnnualGoal(input: {
  id: number;
  title: string;
  theme: string;
  year: number;
  ownerMemberId: number;
  status: "on_track" | "attention" | "at_risk" | "complete";
  boardId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const owner = await database
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, input.ownerMemberId),
        eq(teamMembers.boardId, input.boardId),
        eq(teamMembers.isActive, true)
      )
    )
    .limit(1);
  if (!owner[0])
    throw new Error("مسؤول الهدف ليس عضوًا نشطًا في اللوحة الحالية");
  const updated = await database
    .update(annualGoals)
    .set({
      title: input.title,
      theme: input.theme,
      year: input.year,
      ownerMemberId: input.ownerMemberId,
      status: input.status,
    })
    .where(
      and(eq(annualGoals.id, input.id), eq(annualGoals.boardId, input.boardId))
    );
  if (!updated[0].affectedRows)
    throw new Error("الهدف السنوي غير موجود في اللوحة الحالية");
  return { success: true as const };
}

export async function deleteAnnualGoal(id: number, boardId: number) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const goal = await database
    .select({ id: annualGoals.id })
    .from(annualGoals)
    .where(and(eq(annualGoals.id, id), eq(annualGoals.boardId, boardId)))
    .limit(1);
  if (!goal[0]) throw new Error("الهدف السنوي غير موجود في اللوحة الحالية");
  await database.transaction(async transaction => {
    await transaction
      .update(projects)
      .set({ annualGoalId: null })
      .where(and(eq(projects.annualGoalId, id), eq(projects.boardId, boardId)));
    await transaction
      .delete(annualGoals)
      .where(and(eq(annualGoals.id, id), eq(annualGoals.boardId, boardId)));
  });
  return { success: true as const };
}

export async function createProject(input: {
  title: string;
  summary?: string;
  annualGoalId?: number | null;
  ownerMemberId: number;
  responsibleMemberIds?: number[];
  startDate: Date;
  endDate?: Date | null;
  status: "planned" | "in_progress" | "in_review" | "complete" | "blocked";
  boardId: number;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const responsibleMemberIds = Array.from(
    new Set([input.ownerMemberId, ...(input.responsibleMemberIds ?? [])])
  );
  const responsibleMembers = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        inArray(teamMembers.id, responsibleMemberIds),
        eq(teamMembers.boardId, input.boardId),
        eq(teamMembers.isActive, true)
      )
    );
  if (responsibleMembers.length !== responsibleMemberIds.length)
    throw new Error("جميع مسؤولي المشروع يجب أن يكونوا أعضاء نشطين في اللوحة");
  if (input.annualGoalId) {
    const goal = await db
      .select({ id: annualGoals.id })
      .from(annualGoals)
      .where(
        and(
          eq(annualGoals.id, input.annualGoalId),
          eq(annualGoals.boardId, input.boardId)
        )
      )
      .limit(1);
    if (!goal[0]) throw new Error("الهدف السنوي غير موجود في اللوحة الحالية");
  }
  const creatorAccess = await getUserProjectAccess(
    input.createdByUserId,
    input.boardId
  );
  const creatorMember = creatorAccess.restricted
    ? await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, input.createdByUserId),
            eq(teamMembers.boardId, input.boardId),
            eq(teamMembers.isActive, true)
          )
        )
        .limit(1)
    : [];
  return db.transaction(async tx => {
    const result = await tx.insert(projects).values({
      boardId: input.boardId,
      title: input.title,
      summary: input.summary ?? null,
      annualGoalId: input.annualGoalId ?? null,
      ownerMemberId: input.ownerMemberId,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      progress: 0,
      status: input.status,
    });
    const projectId = Number(result[0].insertId);
    await tx
      .insert(projectMembers)
      .values(responsibleMemberIds.map(memberId => ({ projectId, memberId })));
    if (creatorAccess.restricted && creatorMember[0]) {
      await tx
        .update(teamMembers)
        .set({
          allowedProjectIds: Array.from(
            new Set([...creatorAccess.projectIds, projectId])
          ),
        })
        .where(eq(teamMembers.id, creatorMember[0].id));
    }
    return { id: projectId };
  });
}

export async function createLessonLearned(input: {
  title: string;
  projectId: number;
  category: "success" | "challenge" | "improvement" | "risk";
  lesson: string;
  recommendation?: string;
  lessonDate: Date;
  boardId: number;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, input.projectId), eq(projects.boardId, input.boardId))
    )
    .limit(1);
  if (!project[0]) throw new Error("المشروع غير موجود في اللوحة الحالية");
  const result = await db.insert(lessonsLearned).values({
    boardId: input.boardId,
    projectId: input.projectId,
    title: input.title,
    category: input.category,
    lesson: input.lesson,
    recommendation: input.recommendation?.trim() || null,
    lessonDate: input.lessonDate,
    createdByUserId: input.createdByUserId,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateLessonLearned(input: {
  id: number;
  title: string;
  projectId: number;
  category: "success" | "challenge" | "improvement" | "risk";
  lesson: string;
  recommendation?: string;
  lessonDate: Date;
  boardId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const project = await database
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, input.projectId), eq(projects.boardId, input.boardId))
    )
    .limit(1);
  if (!project[0]) throw new Error("المشروع غير موجود في اللوحة الحالية");
  const updated = await database
    .update(lessonsLearned)
    .set({
      title: input.title,
      projectId: input.projectId,
      category: input.category,
      lesson: input.lesson,
      recommendation: input.recommendation?.trim() || null,
      lessonDate: input.lessonDate,
    })
    .where(
      and(
        eq(lessonsLearned.id, input.id),
        eq(lessonsLearned.boardId, input.boardId)
      )
    );
  if (!updated[0].affectedRows)
    throw new Error("الدرس غير موجود في اللوحة الحالية");
  return { success: true as const };
}

export async function deleteLessonLearned(id: number, boardId: number) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const deleted = await database
    .delete(lessonsLearned)
    .where(and(eq(lessonsLearned.id, id), eq(lessonsLearned.boardId, boardId)));
  if (!deleted[0].affectedRows)
    throw new Error("الدرس غير موجود في اللوحة الحالية");
  return { success: true as const };
}

export async function createCalendarEvent(input: {
  title: string;
  projectId?: number | null;
  eventDate: Date;
  type: "meeting" | "delivery" | "launch" | "workshop" | "review";
  boardId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  if (input.projectId) {
    const project = await database
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.boardId, input.boardId)
        )
      )
      .limit(1);
    if (!project[0]) throw new Error("المشروع غير موجود في اللوحة الحالية");
  }
  const created = await database.insert(calendarEvents).values({
    boardId: input.boardId,
    title: input.title,
    projectId: input.projectId ?? null,
    eventDate: input.eventDate,
    type: input.type,
  });
  return { id: Number(created[0].insertId) };
}

export async function updateCalendarEvent(input: {
  id: number;
  title: string;
  projectId?: number | null;
  eventDate: Date;
  type: "meeting" | "delivery" | "launch" | "workshop" | "review";
  boardId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  if (input.projectId) {
    const project = await database
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.boardId, input.boardId)
        )
      )
      .limit(1);
    if (!project[0]) throw new Error("المشروع غير موجود في اللوحة الحالية");
  }
  const updated = await database
    .update(calendarEvents)
    .set({
      title: input.title,
      projectId: input.projectId ?? null,
      eventDate: input.eventDate,
      type: input.type,
    })
    .where(
      and(
        eq(calendarEvents.id, input.id),
        eq(calendarEvents.boardId, input.boardId)
      )
    );
  if (!updated[0].affectedRows)
    throw new Error("الموعد غير موجود في اللوحة الحالية");
  return { success: true as const };
}

export async function deleteCalendarEvent(id: number, boardId: number) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const deleted = await database
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.boardId, boardId)));
  if (!deleted[0].affectedRows)
    throw new Error("الموعد غير موجود في اللوحة الحالية");
  return { success: true as const };
}

export async function createTask(input: {
  title: string;
  description?: string;
  projectId?: number | null;
  assigneeMemberId?: number | null;
  assigneeMemberIds?: number[];
  startDate?: Date | null;
  dueDate?: Date | null;
  priority: "urgent" | "high" | "medium" | "low";
  status:
    | "not_started"
    | "in_progress"
    | "blocked"
    | "in_review"
    | "complete"
    | "overdue";
  parentTaskId?: number | null;
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  if (input.projectId) {
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.boardId, input.boardId)
        )
      )
      .limit(1);
    if (!project[0]) throw new Error("المشروع غير موجود في اللوحة الحالية");
  }
  const assigneeMemberIds = Array.from(
    new Set(
      input.assigneeMemberIds ??
        (input.assigneeMemberId ? [input.assigneeMemberId] : [])
    )
  );
  if (assigneeMemberIds.length) {
    const assignees = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          inArray(teamMembers.id, assigneeMemberIds),
          eq(teamMembers.boardId, input.boardId),
          eq(teamMembers.isActive, true)
        )
      );
    if (assignees.length !== assigneeMemberIds.length)
      throw new Error("جميع المسؤولين يجب أن يكونوا أعضاء نشطين في اللوحة");
  }
  if (input.parentTaskId) {
    const parent = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(eq(tasks.id, input.parentTaskId), eq(tasks.boardId, input.boardId))
      )
      .limit(1);
    if (!parent[0]) throw new Error("المهمة الرئيسية ليست في اللوحة الحالية");
  }
  const primaryAssigneeId = assigneeMemberIds[0] ?? null;
  const warningMember = primaryAssigneeId
    ? await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.assigneeMemberId, primaryAssigneeId),
            eq(tasks.boardId, input.boardId)
          )
        )
    : [];
  const created = await db.transaction(async tx => {
    const result = await tx.insert(tasks).values({
      boardId: input.boardId,
      title: input.title,
      description: input.description?.trim() || null,
      projectId: input.projectId ?? null,
      assigneeMemberId: primaryAssigneeId,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      priority: input.priority,
      status: input.status,
      parentTaskId: input.parentTaskId ?? null,
    });
    const taskId = Number(result[0].insertId);
    if (assigneeMemberIds.length)
      await tx
        .insert(taskAssignees)
        .values(assigneeMemberIds.map(memberId => ({ taskId, memberId })));
    return taskId;
  });
  await refreshProjectProgress(input.projectId);
  return {
    id: created,
    showLoadWarning: shouldWarnAssignee(
      warningMember.filter(task => task.status !== "complete").length
    ),
  };
}

export async function updateTask(input: {
  id: number;
  title: string;
  description?: string;
  projectId?: number | null;
  assigneeMemberId?: number | null;
  assigneeMemberIds?: number[];
  startDate?: Date | null;
  dueDate?: Date | null;
  priority: "urgent" | "high" | "medium" | "low";
  status:
    | "not_started"
    | "in_progress"
    | "blocked"
    | "in_review"
    | "complete"
    | "overdue";
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const existing = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, input.id), eq(tasks.boardId, input.boardId)))
    .limit(1);
  if (!existing[0]) throw new Error("المهمة غير موجودة في اللوحة الحالية");
  if (input.projectId) {
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.boardId, input.boardId)
        )
      )
      .limit(1);
    if (!project[0]) throw new Error("المشروع غير موجود في اللوحة الحالية");
  }
  const assigneeMemberIds = Array.from(
    new Set(
      input.assigneeMemberIds ??
        (input.assigneeMemberId ? [input.assigneeMemberId] : [])
    )
  );
  if (assigneeMemberIds.length) {
    const assignees = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          inArray(teamMembers.id, assigneeMemberIds),
          eq(teamMembers.boardId, input.boardId),
          eq(teamMembers.isActive, true)
        )
      );
    if (assignees.length !== assigneeMemberIds.length)
      throw new Error("جميع المسؤولين يجب أن يكونوا أعضاء نشطين في اللوحة");
  }
  await db.transaction(async tx => {
    await tx
      .update(tasks)
      .set({
        title: input.title,
        description: input.description?.trim() || null,
        projectId: input.projectId ?? null,
        assigneeMemberId: assigneeMemberIds[0] ?? null,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority,
        status: input.status,
      })
      .where(and(eq(tasks.id, input.id), eq(tasks.boardId, input.boardId)));
    await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, input.id));
    if (assigneeMemberIds.length)
      await tx.insert(taskAssignees).values(
        assigneeMemberIds.map(memberId => ({
          taskId: input.id,
          memberId,
        }))
      );
  });
  await Promise.all([
    refreshProjectProgress(existing[0].projectId),
    input.projectId !== existing[0].projectId
      ? refreshProjectProgress(input.projectId)
      : Promise.resolve(),
  ]);
  return { success: true as const };
}

export async function deleteTask(id: number, boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const existing = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.boardId, boardId)))
    .limit(1);
  if (!existing[0]) throw new Error("المهمة غير موجودة في اللوحة الحالية");
  await db.transaction(async tx => {
    await tx
      .update(tasks)
      .set({ parentTaskId: null })
      .where(and(eq(tasks.parentTaskId, id), eq(tasks.boardId, boardId)));
    await tx.delete(taskAttachments).where(eq(taskAttachments.taskId, id));
    await tx.delete(taskComments).where(eq(taskComments.taskId, id));
    await tx.delete(taskParticipants).where(eq(taskParticipants.taskId, id));
    await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, id));
    await tx
      .delete(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, id));
    await tx
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.boardId, boardId)));
  });
  await refreshProjectProgress(existing[0].projectId);
  return { success: true as const };
}

export async function updateTaskStatus(
  id: number,
  status:
    | "not_started"
    | "in_progress"
    | "blocked"
    | "in_review"
    | "complete"
    | "overdue",
  boardId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const task = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.boardId, boardId)))
    .limit(1);
  if (!task[0]) throw new Error("المهمة غير موجودة في اللوحة الحالية");
  await db
    .update(tasks)
    .set({ status })
    .where(and(eq(tasks.id, id), eq(tasks.boardId, boardId)));
  await refreshProjectProgress(task[0]?.projectId);
}

export async function updateTaskSupport(input: {
  id: number;
  needsSupport: boolean;
  supportRequest?: string;
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const task = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, input.id), eq(tasks.boardId, input.boardId)))
    .limit(1);
  if (!task[0]) throw new Error("المهمة غير موجودة في اللوحة الحالية");
  await db
    .update(tasks)
    .set({
      needsSupport: input.needsSupport,
      supportRequest: input.needsSupport
        ? input.supportRequest?.trim() || null
        : null,
    })
    .where(and(eq(tasks.id, input.id), eq(tasks.boardId, input.boardId)));
  return { success: true as const };
}

export async function assignTask(
  id: number,
  assigneeMemberId: number | null,
  boardId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const task = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.boardId, boardId)))
    .limit(1);
  if (!task[0]) throw new Error("المهمة غير موجودة في اللوحة الحالية");
  if (assigneeMemberId) {
    const assignee = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, assigneeMemberId),
          eq(teamMembers.boardId, boardId)
        )
      )
      .limit(1);
    if (!assignee[0]) throw new Error("المكلّف ليس عضوًا في اللوحة الحالية");
  }
  await db.transaction(async tx => {
    await tx
      .update(tasks)
      .set({ assigneeMemberId })
      .where(and(eq(tasks.id, id), eq(tasks.boardId, boardId)));
    await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, id));
    if (assigneeMemberId)
      await tx.insert(taskAssignees).values({
        taskId: id,
        memberId: assigneeMemberId,
      });
  });
}

export async function createTaskChecklistItem(input: {
  taskId: number;
  title: string;
  assigneeMemberId?: number | null;
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const task = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.boardId, input.boardId)))
    .limit(1);
  if (!task[0]) throw new Error("المهمة غير موجودة في اللوحة الحالية");
  if (input.assigneeMemberId) {
    const member = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, input.assigneeMemberId),
          eq(teamMembers.boardId, input.boardId),
          eq(teamMembers.isActive, true)
        )
      )
      .limit(1);
    if (!member[0]) throw new Error("مسؤول البند ليس عضوًا نشطًا في اللوحة");
  }
  const result = await db.insert(taskChecklistItems).values({
    taskId: input.taskId,
    title: input.title.trim(),
    assigneeMemberId: input.assigneeMemberId ?? null,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateTaskChecklistItem(input: {
  id: number;
  taskId: number;
  title: string;
  assigneeMemberId?: number | null;
  isComplete: boolean;
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const item = await db
    .select({ id: taskChecklistItems.id })
    .from(taskChecklistItems)
    .innerJoin(tasks, eq(taskChecklistItems.taskId, tasks.id))
    .where(
      and(
        eq(taskChecklistItems.id, input.id),
        eq(taskChecklistItems.taskId, input.taskId),
        eq(tasks.boardId, input.boardId)
      )
    )
    .limit(1);
  if (!item[0]) throw new Error("بند القائمة غير موجود في المهمة الحالية");
  if (input.assigneeMemberId) {
    const member = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, input.assigneeMemberId),
          eq(teamMembers.boardId, input.boardId),
          eq(teamMembers.isActive, true)
        )
      )
      .limit(1);
    if (!member[0]) throw new Error("مسؤول البند ليس عضوًا نشطًا في اللوحة");
  }
  await db
    .update(taskChecklistItems)
    .set({
      title: input.title.trim(),
      assigneeMemberId: input.assigneeMemberId ?? null,
      isComplete: input.isComplete,
    })
    .where(eq(taskChecklistItems.id, input.id));
  return { success: true as const };
}

export async function deleteTaskChecklistItem(input: {
  id: number;
  taskId: number;
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const item = await db
    .select({ id: taskChecklistItems.id })
    .from(taskChecklistItems)
    .innerJoin(tasks, eq(taskChecklistItems.taskId, tasks.id))
    .where(
      and(
        eq(taskChecklistItems.id, input.id),
        eq(taskChecklistItems.taskId, input.taskId),
        eq(tasks.boardId, input.boardId)
      )
    )
    .limit(1);
  if (!item[0]) throw new Error("بند القائمة غير موجود في المهمة الحالية");
  await db
    .delete(taskChecklistItems)
    .where(eq(taskChecklistItems.id, input.id));
  return { success: true as const };
}

export async function updateProjectStatus(
  id: number,
  status: "planned" | "in_progress" | "in_review" | "complete" | "blocked",
  boardId: number
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const result = await db
    .update(projects)
    .set({ status })
    .where(and(eq(projects.id, id), eq(projects.boardId, boardId)));
  if (!result[0].affectedRows)
    throw new Error("المشروع غير موجود في اللوحة الحالية");
}

export async function updateProject(input: {
  id: number;
  title: string;
  summary?: string;
  annualGoalId?: number | null;
  ownerMemberId: number;
  responsibleMemberIds: number[];
  startDate: Date;
  endDate?: Date | null;
  status: "planned" | "in_progress" | "in_review" | "complete" | "blocked";
  boardId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, input.id), eq(projects.boardId, input.boardId)))
    .limit(1);
  if (!existing[0]) throw new Error("المشروع غير موجود في اللوحة الحالية");
  const responsibleMemberIds = Array.from(
    new Set([input.ownerMemberId, ...input.responsibleMemberIds])
  );
  const responsibleMembers = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        inArray(teamMembers.id, responsibleMemberIds),
        eq(teamMembers.boardId, input.boardId),
        eq(teamMembers.isActive, true)
      )
    );
  if (responsibleMembers.length !== responsibleMemberIds.length)
    throw new Error("جميع مسؤولي المشروع يجب أن يكونوا أعضاء نشطين في اللوحة");
  if (input.annualGoalId) {
    const goal = await db
      .select({ id: annualGoals.id })
      .from(annualGoals)
      .where(
        and(
          eq(annualGoals.id, input.annualGoalId),
          eq(annualGoals.boardId, input.boardId)
        )
      )
      .limit(1);
    if (!goal[0]) throw new Error("الهدف السنوي غير موجود في اللوحة الحالية");
  }
  await db.transaction(async tx => {
    await tx
      .update(projects)
      .set({
        title: input.title,
        summary: input.summary?.trim() || null,
        annualGoalId: input.annualGoalId ?? null,
        ownerMemberId: input.ownerMemberId,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        status: input.status,
      })
      .where(
        and(eq(projects.id, input.id), eq(projects.boardId, input.boardId))
      );
    await tx
      .delete(projectMembers)
      .where(eq(projectMembers.projectId, input.id));
    await tx.insert(projectMembers).values(
      responsibleMemberIds.map(memberId => ({
        projectId: input.id,
        memberId,
      }))
    );
  });
  return { success: true as const };
}

export async function deleteProject(id: number, boardId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.boardId, boardId)))
    .limit(1);
  if (!existing[0]) throw new Error("المشروع غير موجود في اللوحة الحالية");
  const [taskRows, deliverableRows] = await Promise.all([
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.projectId, id), eq(tasks.boardId, boardId))),
    db
      .select({ id: deliverables.id })
      .from(deliverables)
      .where(eq(deliverables.projectId, id)),
  ]);
  const taskIds = taskRows.map(task => task.id);
  const deliverableIds = deliverableRows.map(item => item.id);
  await db.transaction(async tx => {
    if (taskIds.length) {
      await tx
        .update(tasks)
        .set({ parentTaskId: null })
        .where(inArray(tasks.parentTaskId, taskIds));
      await tx
        .delete(taskAttachments)
        .where(inArray(taskAttachments.taskId, taskIds));
      await tx
        .delete(taskComments)
        .where(inArray(taskComments.taskId, taskIds));
      await tx
        .delete(taskParticipants)
        .where(inArray(taskParticipants.taskId, taskIds));
      await tx
        .delete(taskAssignees)
        .where(inArray(taskAssignees.taskId, taskIds));
      await tx
        .delete(taskChecklistItems)
        .where(inArray(taskChecklistItems.taskId, taskIds));
      await tx
        .delete(tasks)
        .where(and(inArray(tasks.id, taskIds), eq(tasks.boardId, boardId)));
    }
    if (deliverableIds.length) {
      await tx
        .update(tasks)
        .set({ deliverableId: null })
        .where(inArray(tasks.deliverableId, deliverableIds));
      await tx
        .delete(deliverableComments)
        .where(inArray(deliverableComments.deliverableId, deliverableIds));
      await tx
        .delete(deliverables)
        .where(inArray(deliverables.id, deliverableIds));
    }
    await tx.delete(calendarEvents).where(eq(calendarEvents.projectId, id));
    await tx.delete(lessonsLearned).where(eq(lessonsLearned.projectId, id));
    await tx.delete(projectMembers).where(eq(projectMembers.projectId, id));
    await tx
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.boardId, boardId)));
  });
  return { success: true as const };
}
