import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import webpush from "web-push";
import {
  applicationSettings,
  boardMemberships,
  browserPushSubscriptions,
  calendarEvents,
  notifications,
  projectMembers,
  projects,
  taskComments,
  taskAssignees,
  tasks,
  teamMembers,
  users,
} from "../drizzle/schema";
import {
  defaultBrowserNotificationTypes,
  type NotificationType,
} from "../shared/notificationTypes";
import { getDb, getUserProjectAccess } from "./db";

type NotificationInput = {
  userId: number;
  boardId: number;
  type: NotificationType;
  title: string;
  message: string;
  actorUserId?: number | null;
  taskId?: number | null;
  taskCommentId?: number | null;
  calendarEventId?: number | null;
  projectId?: number | null;
  link: string;
  dedupeKey: string;
  aggregate?: boolean;
};

const VAPID_PUBLIC_KEY = "notifications.vapid.public";
const VAPID_PRIVATE_KEY = "notifications.vapid.private";
const RIYADH_TIME_ZONE = "Asia/Riyadh";

function actorPrefix(name?: string | null) {
  return name?.trim() || "أحد أعضاء الفريق";
}

function sameMoment(left?: Date | null, right?: Date | null) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

function arabicDate(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: RIYADH_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

async function getVapidKeys() {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await database
    .select()
    .from(applicationSettings)
    .where(
      inArray(applicationSettings.settingKey, [
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
      ])
    );
  let publicKey = rows.find(
    row => row.settingKey === VAPID_PUBLIC_KEY
  )?.settingValue;
  let privateKey = rows.find(
    row => row.settingKey === VAPID_PRIVATE_KEY
  )?.settingValue;
  if (!publicKey || !privateKey) {
    const generated = webpush.generateVAPIDKeys();
    await database
      .insert(applicationSettings)
      .values([
        { settingKey: VAPID_PUBLIC_KEY, settingValue: generated.publicKey },
        { settingKey: VAPID_PRIVATE_KEY, settingValue: generated.privateKey },
      ])
      .onDuplicateKeyUpdate({
        set: { settingValue: sql`${applicationSettings.settingValue}` },
      });
    const stored = await database
      .select()
      .from(applicationSettings)
      .where(
        inArray(applicationSettings.settingKey, [
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY,
        ])
      );
    publicKey = stored.find(
      row => row.settingKey === VAPID_PUBLIC_KEY
    )?.settingValue;
    privateKey = stored.find(
      row => row.settingKey === VAPID_PRIVATE_KEY
    )?.settingValue;
  }
  if (!publicKey || !privateKey)
    throw new Error("تعذر تجهيز مفاتيح إشعارات المتصفح");
  return { publicKey, privateKey };
}

async function sendBrowserPush(
  input: NotificationInput,
  notificationId: number
) {
  const database = await getDb();
  if (!database) return;
  const subscriptions = await database
    .select()
    .from(browserPushSubscriptions)
    .where(eq(browserPushSubscriptions.userId, input.userId));
  const eligible = subscriptions.filter(subscription =>
    (subscription.enabledTypes ?? []).includes(input.type)
  );
  if (!eligible.length) return;
  const keys = await getVapidKeys();
  webpush.setVapidDetails(
    "mailto:notifications@aidept.io",
    keys.publicKey,
    keys.privateKey
  );
  await Promise.all(
    eligible.map(async subscription => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime?.getTime() ?? null,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            id: notificationId,
            title: input.title,
            body: input.message,
            url: `${input.link}${input.link.includes("?") ? "&" : "?"}notificationId=${notificationId}`,
          })
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : null;
        if (statusCode === 404 || statusCode === 410)
          await database
            .delete(browserPushSubscriptions)
            .where(eq(browserPushSubscriptions.id, subscription.id));
        else console.warn("[Notifications] Browser push failed", error);
      }
    })
  );
}

export async function createNotification(input: NotificationInput) {
  if (input.actorUserId && input.actorUserId === input.userId) return null;
  const database = await getDb();
  if (!database) return null;
  const membership = await database
    .select({ id: boardMemberships.id })
    .from(boardMemberships)
    .where(
      and(
        eq(boardMemberships.userId, input.userId),
        eq(boardMemberships.boardId, input.boardId)
      )
    )
    .limit(1);
  if (!membership[0]) return null;
  if (input.projectId) {
    const access = await getUserProjectAccess(input.userId, input.boardId);
    if (access.restricted && !access.projectIds.includes(input.projectId))
      return null;
  }
  const existing = await database
    .select({ id: notifications.id, readAt: notifications.readAt })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, input.userId),
        eq(notifications.dedupeKey, input.dedupeKey)
      )
    )
    .limit(1);
  if (existing[0] && !input.aggregate) return existing[0];
  if (existing[0]) {
    await database
      .update(notifications)
      .set({
        title: input.title,
        message: input.message,
        actorUserId: input.actorUserId ?? null,
        taskCommentId: input.taskCommentId ?? null,
        occurrenceCount: sql`${notifications.occurrenceCount} + 1`,
        readAt: null,
      })
      .where(eq(notifications.id, existing[0].id));
    await sendBrowserPush(input, existing[0].id);
    return { id: existing[0].id };
  }
  const inserted = await database.insert(notifications).values({
    userId: input.userId,
    boardId: input.boardId,
    type: input.type,
    title: input.title,
    message: input.message,
    actorUserId: input.actorUserId ?? null,
    taskId: input.taskId ?? null,
    taskCommentId: input.taskCommentId ?? null,
    calendarEventId: input.calendarEventId ?? null,
    projectId: input.projectId ?? null,
    link: input.link,
    dedupeKey: input.dedupeKey,
  });
  const id = Number(inserted[0].insertId);
  await sendBrowserPush(input, id);
  return { id };
}

async function actorName(actorUserId: number) {
  const database = await getDb();
  if (!database) return null;
  const rows = await database
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, actorUserId))
    .limit(1);
  return rows[0]?.name ?? null;
}

export async function getTaskNotificationSnapshot(
  taskId: number,
  boardId: number
) {
  const database = await getDb();
  if (!database) return null;
  const rows = await database
    .select({
      id: tasks.id,
      title: tasks.title,
      projectId: tasks.projectId,
      assigneeMemberId: tasks.assigneeMemberId,
      assigneeUserId: teamMembers.userId,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      status: tasks.status,
    })
    .from(tasks)
    .leftJoin(teamMembers, eq(tasks.assigneeMemberId, teamMembers.id))
    .where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
    .limit(1);
  if (!rows[0]) return null;
  const assigneeRows = await database
    .select({ memberId: taskAssignees.memberId, userId: teamMembers.userId })
    .from(taskAssignees)
    .innerJoin(teamMembers, eq(taskAssignees.memberId, teamMembers.id))
    .where(eq(taskAssignees.taskId, taskId));
  return {
    ...rows[0],
    assigneeMemberIds: assigneeRows.length
      ? assigneeRows.map(row => row.memberId)
      : rows[0].assigneeMemberId
        ? [rows[0].assigneeMemberId]
        : [],
    assigneeUserIds: assigneeRows.length
      ? assigneeRows
          .map(row => row.userId)
          .filter((id): id is number => Boolean(id))
      : rows[0].assigneeUserId
        ? [rows[0].assigneeUserId]
        : [],
    assigneeRecipients: assigneeRows.length
      ? assigneeRows.filter(
          (row): row is { memberId: number; userId: number } =>
            Boolean(row.userId)
        )
      : rows[0].assigneeMemberId && rows[0].assigneeUserId
        ? [
            {
              memberId: rows[0].assigneeMemberId,
              userId: rows[0].assigneeUserId,
            },
          ]
        : [],
  };
}

export async function notifyTaskCreated(
  taskId: number,
  boardId: number,
  actorUserId: number
) {
  const task = await getTaskNotificationSnapshot(taskId, boardId);
  if (!task?.assigneeUserIds.length) return;
  const actor = actorPrefix(await actorName(actorUserId));
  await Promise.all(
    task.assigneeUserIds.map(userId =>
      createNotification({
        userId,
        boardId,
        type: "task_assigned",
        title: "مهمة جديدة مسندة لك",
        message: `${actor} أسند لك مهمة: ${task.title}`,
        actorUserId,
        taskId,
        projectId: task.projectId,
        link: `/?view=task&taskId=${taskId}`,
        dedupeKey: `task-assigned:${taskId}`,
        aggregate: true,
      })
    )
  );
}

export async function notifyTaskUpdated(
  before: NonNullable<Awaited<ReturnType<typeof getTaskNotificationSnapshot>>>,
  boardId: number,
  actorUserId: number
) {
  const after = await getTaskNotificationSnapshot(before.id, boardId);
  if (!after) return;
  const actor = actorPrefix(await actorName(actorUserId));
  if (!sameMoment(before.dueDate, after.dueDate) || after.status === "complete")
    await clearTaskReminderNotifications(after.id, boardId);
  const previousMemberIds = new Set(before.assigneeMemberIds);
  const newlyAssignedUserIds = after.assigneeRecipients
    .filter(recipient => !previousMemberIds.has(recipient.memberId))
    .map(recipient => recipient.userId);
  if (newlyAssignedUserIds.length) {
    await Promise.all(
      newlyAssignedUserIds.map(userId =>
        createNotification({
          userId,
          boardId,
          type: "task_assigned",
          title: "مهمة جديدة مسندة لك",
          message: `${actor} أسند لك مهمة: ${after.title}`,
          actorUserId,
          taskId: after.id,
          projectId: after.projectId,
          link: `/?view=task&taskId=${after.id}`,
          dedupeKey: `task-assigned:${after.id}`,
          aggregate: true,
        })
      )
    );
  }
  if (!after.assigneeUserIds.length) return;
  if (!sameMoment(before.dueDate, after.dueDate))
    await Promise.all(
      after.assigneeUserIds.map(userId =>
        createNotification({
          userId,
          boardId,
          type: "task_due_changed",
          title: "تغيّر موعد مهمتك",
          message: after.dueDate
            ? `${actor} غيّر موعد «${after.title}» إلى ${arabicDate(after.dueDate)}`
            : `${actor} أزال الموعد النهائي من «${after.title}»`,
          actorUserId,
          taskId: after.id,
          projectId: after.projectId,
          link: `/?view=task&taskId=${after.id}`,
          dedupeKey: `task-due-changed:${after.id}`,
          aggregate: true,
        })
      )
    );
  if (before.priority !== after.priority)
    await Promise.all(
      after.assigneeUserIds.map(userId =>
        createNotification({
          userId,
          boardId,
          type: "task_priority_changed",
          title: "تغيّرت أولوية مهمتك",
          message: `${actor} غيّر أولوية «${after.title}»`,
          actorUserId,
          taskId: after.id,
          projectId: after.projectId,
          link: `/?view=task&taskId=${after.id}`,
          dedupeKey: `task-priority-changed:${after.id}`,
          aggregate: true,
        })
      )
    );
}

export async function clearTaskReminderNotifications(
  taskId: number,
  boardId: number
) {
  const database = await getDb();
  if (!database) return;
  await database
    .delete(notifications)
    .where(
      and(
        eq(notifications.boardId, boardId),
        eq(notifications.taskId, taskId),
        inArray(notifications.type, ["task_due_soon", "task_overdue"])
      )
    );
}

export async function clearLaunchReminderNotifications(
  calendarEventId: number,
  boardId: number
) {
  const database = await getDb();
  if (!database) return;
  await database
    .delete(notifications)
    .where(
      and(
        eq(notifications.boardId, boardId),
        eq(notifications.calendarEventId, calendarEventId),
        eq(notifications.type, "launch_due_soon")
      )
    );
}

async function projectParticipantUserIds(projectId: number, boardId: number) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .leftJoin(
      projectMembers,
      and(
        eq(projectMembers.memberId, teamMembers.id),
        eq(projectMembers.projectId, projectId)
      )
    )
    .leftJoin(projects, eq(projects.id, projectId))
    .where(
      and(
        eq(teamMembers.boardId, boardId),
        eq(teamMembers.isActive, true),
        sql`(${projectMembers.id} is not null or ${projects.ownerMemberId} = ${teamMembers.id})`
      )
    );
  return Array.from(
    new Set(
      rows.map(row => row.userId).filter((id): id is number => Boolean(id))
    )
  );
}

export async function notifySupportRequested(
  taskId: number,
  boardId: number,
  actorUserId: number
) {
  const task = await getTaskNotificationSnapshot(taskId, boardId);
  if (!task) return;
  const database = await getDb();
  if (!database) return;
  const managerRows = await database
    .select({ userId: boardMemberships.userId })
    .from(boardMemberships)
    .where(
      and(
        eq(boardMemberships.boardId, boardId),
        eq(boardMemberships.role, "manager")
      )
    );
  const recipients = new Set<number>(managerRows.map(row => row.userId));
  task.assigneeUserIds.forEach(userId => recipients.add(userId));
  if (task.projectId)
    (await projectParticipantUserIds(task.projectId, boardId)).forEach(id =>
      recipients.add(id)
    );
  const actor = actorPrefix(await actorName(actorUserId));
  await Promise.all(
    Array.from(recipients).map(userId =>
      createNotification({
        userId,
        boardId,
        type: "support_requested",
        title: "طلب دعم جديد",
        message: `${actor} طلب دعمًا في مهمة: ${task.title}`,
        actorUserId,
        taskId,
        projectId: task.projectId,
        link: `/?view=task&taskId=${taskId}`,
        dedupeKey: `support-requested:${taskId}`,
        aggregate: true,
      })
    )
  );
}

export function includesMemberMention(content: string, identity: string) {
  const normalizedContent = content.toLocaleLowerCase("ar");
  const normalizedIdentity = identity.trim().toLocaleLowerCase("ar");
  if (!normalizedIdentity) return false;
  const escapedIdentity = normalizedIdentity.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
  const trailingBoundary = normalizedIdentity.includes("@")
    ? "[\\s،,؛;.!?]"
    : "[،,؛;.!?]";
  return (
    normalizedContent.includes(`@[${normalizedIdentity}]`) ||
    new RegExp(`@${escapedIdentity}(?=$|${trailingBoundary})`).test(
      normalizedContent
    )
  );
}

export async function notifyTaskComment(
  commentId: number,
  taskId: number,
  boardId: number,
  actorUserId: number,
  body: string,
  replyToCommentId?: number | null,
  previousBody?: string | null
) {
  const database = await getDb();
  if (!database) return;
  const task = await getTaskNotificationSnapshot(taskId, boardId);
  if (!task) return;
  const members = await database
    .select({
      userId: teamMembers.userId,
      name: teamMembers.name,
      email: teamMembers.email,
    })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.boardId, boardId), eq(teamMembers.isActive, true))
    );
  const actor = actorPrefix(await actorName(actorUserId));
  const mentioned = members.filter(member => {
    if (!member.userId || member.userId === actorUserId) return false;
    const identities = [member.name, member.email]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(value => value.trim());
    return (
      identities.some(identity => includesMemberMention(body, identity)) &&
      !identities.some(identity =>
        includesMemberMention(previousBody ?? "", identity)
      )
    );
  });
  await Promise.all(
    mentioned.map(member =>
      createNotification({
        userId: member.userId!,
        boardId,
        type: "comment_mention",
        title: "تمت الإشارة إليك في تعليق",
        message: `${actor} أشار إليك في «${task.title}»`,
        actorUserId,
        taskId,
        taskCommentId: commentId,
        projectId: task.projectId,
        link: `/?view=task&taskId=${taskId}&commentId=${commentId}`,
        dedupeKey: `comment-mention:${commentId}:${member.userId}`,
      })
    )
  );
  if (!replyToCommentId) return;
  const parent = await database
    .select({ userId: teamMembers.userId })
    .from(taskComments)
    .innerJoin(teamMembers, eq(taskComments.authorMemberId, teamMembers.id))
    .where(
      and(
        eq(taskComments.id, replyToCommentId),
        eq(taskComments.taskId, taskId)
      )
    )
    .limit(1);
  const replyUserId = parent[0]?.userId;
  if (!replyUserId || replyUserId === actorUserId) return;
  await createNotification({
    userId: replyUserId,
    boardId,
    type: "comment_reply",
    title: "رد جديد على تعليقك",
    message: `${actor} رد على تعليقك في «${task.title}»`,
    actorUserId,
    taskId,
    taskCommentId: commentId,
    projectId: task.projectId,
    link: `/?view=task&taskId=${taskId}&commentId=${commentId}`,
    dedupeKey: `comment-reply:${commentId}:${replyUserId}`,
  });
}

export async function listNotifications(
  userId: number,
  boardId: number,
  unreadOnly: boolean
) {
  const database = await getDb();
  if (!database) return { items: [], unreadCount: 0 };
  const access = await getUserProjectAccess(userId, boardId);
  const visibility = access.restricted
    ? access.projectIds.length
      ? sql`(${notifications.projectId} is null or ${notifications.projectId} in (${sql.join(
          access.projectIds.map(id => sql`${id}`),
          sql`, `
        )}))`
      : isNull(notifications.projectId)
    : undefined;
  const base = [
    eq(notifications.userId, userId),
    eq(notifications.boardId, boardId),
    ...(visibility ? [visibility] : []),
  ];
  const items = await database
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      link: notifications.link,
      occurrenceCount: notifications.occurrenceCount,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      updatedAt: notifications.updatedAt,
      actorName: users.name,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorUserId, users.id))
    .where(and(...base, ...(unreadOnly ? [isNull(notifications.readAt)] : [])))
    .orderBy(desc(notifications.updatedAt))
    .limit(80);
  const unreadRows = await database
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(...base, isNull(notifications.readAt)));
  return { items, unreadCount: Number(unreadRows[0]?.count ?? 0) };
}

export async function markNotificationRead(
  id: number,
  userId: number,
  boardId: number
) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await database
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        eq(notifications.boardId, boardId)
      )
    );
  return { success: true as const };
}

export async function markAllNotificationsRead(
  userId: number,
  boardId: number
) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await database
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.boardId, boardId),
        isNull(notifications.readAt)
      )
    );
  return { success: true as const };
}

export async function getBrowserPushConfig(userId: number) {
  const keys = await getVapidKeys();
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const subscriptions = await database
    .select({
      endpoint: browserPushSubscriptions.endpoint,
      enabledTypes: browserPushSubscriptions.enabledTypes,
    })
    .from(browserPushSubscriptions)
    .where(eq(browserPushSubscriptions.userId, userId));
  return {
    publicKey: keys.publicKey,
    subscriptions,
    defaultEnabledTypes: defaultBrowserNotificationTypes,
  };
}

export async function saveBrowserPushSubscription(input: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: number | null;
  enabledTypes: NotificationType[];
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await database
    .insert(browserPushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      expirationTime: input.expirationTime
        ? new Date(input.expirationTime)
        : null,
      enabledTypes: input.enabledTypes,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        expirationTime: input.expirationTime
          ? new Date(input.expirationTime)
          : null,
        enabledTypes: input.enabledTypes,
      },
    });
  return { success: true as const };
}

export async function updateBrowserPushTypes(
  userId: number,
  endpoint: string,
  enabledTypes: NotificationType[]
) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await database
    .update(browserPushSubscriptions)
    .set({ enabledTypes })
    .where(
      and(
        eq(browserPushSubscriptions.userId, userId),
        eq(browserPushSubscriptions.endpoint, endpoint)
      )
    );
  return { success: true as const };
}

export async function removeBrowserPushSubscription(
  userId: number,
  endpoint: string
) {
  const database = await getDb();
  if (!database) return { success: true as const };
  await database
    .delete(browserPushSubscriptions)
    .where(
      and(
        eq(browserPushSubscriptions.userId, userId),
        eq(browserPushSubscriptions.endpoint, endpoint)
      )
    );
  return { success: true as const };
}

export async function runNotificationReminderJob(now = new Date()) {
  const database = await getDb();
  if (!database) return;
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const dueSoon = await database
    .select({
      id: tasks.id,
      title: tasks.title,
      boardId: tasks.boardId,
      projectId: tasks.projectId,
      dueDate: tasks.dueDate,
      userId: teamMembers.userId,
    })
    .from(tasks)
    .innerJoin(taskAssignees, eq(tasks.id, taskAssignees.taskId))
    .innerJoin(teamMembers, eq(taskAssignees.memberId, teamMembers.id))
    .where(
      and(
        ne(tasks.status, "complete"),
        gt(tasks.dueDate, now),
        lte(tasks.dueDate, in24Hours)
      )
    );
  const overdue = await database
    .select({
      id: tasks.id,
      title: tasks.title,
      boardId: tasks.boardId,
      projectId: tasks.projectId,
      dueDate: tasks.dueDate,
      userId: teamMembers.userId,
    })
    .from(tasks)
    .innerJoin(taskAssignees, eq(tasks.id, taskAssignees.taskId))
    .innerJoin(teamMembers, eq(taskAssignees.memberId, teamMembers.id))
    .where(and(ne(tasks.status, "complete"), lt(tasks.dueDate, now)));
  await Promise.all([
    ...dueSoon
      .filter(item => item.userId && item.boardId && item.dueDate)
      .map(item =>
        createNotification({
          userId: item.userId!,
          boardId: item.boardId!,
          type: "task_due_soon",
          title: "موعد مهمة غدًا",
          message: `موعد تسليم مهمة «${item.title}» خلال 24 ساعة`,
          taskId: item.id,
          projectId: item.projectId,
          link: `/?view=task&taskId=${item.id}`,
          dedupeKey: `task-due-soon:${item.id}:${item.dueDate!.toISOString()}`,
        })
      ),
    ...overdue
      .filter(item => item.userId && item.boardId && item.dueDate)
      .map(item =>
        createNotification({
          userId: item.userId!,
          boardId: item.boardId!,
          type: "task_overdue",
          title: "مهمة متأخرة",
          message: `تجاوزت مهمة «${item.title}» موعدها دون اكتمال`,
          taskId: item.id,
          projectId: item.projectId,
          link: `/?view=task&taskId=${item.id}`,
          dedupeKey: `task-overdue:${item.id}:${item.dueDate!.toISOString()}`,
        })
      ),
  ]);
  const launches = await database
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.type, "launch"),
        gt(calendarEvents.eventDate, now),
        lte(calendarEvents.eventDate, in3Days)
      )
    );
  for (const launch of launches) {
    if (!launch.boardId || !launch.projectId) continue;
    const recipients = await projectParticipantUserIds(
      launch.projectId,
      launch.boardId
    );
    await Promise.all(
      recipients.map(userId =>
        createNotification({
          userId,
          boardId: launch.boardId!,
          type: "launch_due_soon",
          title: "إطلاق قريب",
          message: `إطلاق «${launch.title}» خلال 3 أيام`,
          calendarEventId: launch.id,
          projectId: launch.projectId,
          link: `/?view=launches&eventId=${launch.id}`,
          dedupeKey: `launch-due-soon:${launch.id}:${launch.eventDate.toISOString()}`,
        })
      )
    );
  }
}
