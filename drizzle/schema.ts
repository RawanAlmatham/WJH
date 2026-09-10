import {
  boolean,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { BoardModule } from "../shared/boardModules";
import type { PresentationSection } from "../shared/presentationSections";
import type { NotificationType } from "../shared/notificationTypes";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "manager", "admin"])
    .default("user")
    .notNull(),
  activeBoardId: int("activeBoardId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const oauthClients = mysqlTable("oauthClients", {
  id: int("id").autoincrement().primaryKey(),
  clientId: varchar("clientId", { length: 255 }).notNull().unique(),
  clientName: varchar("clientName", { length: 180 }).notNull(),
  redirectUris: json("redirectUris").$type<string[]>().notNull(),
  tokenEndpointAuthMethod: varchar("tokenEndpointAuthMethod", { length: 32 })
    .default("none")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oauthAuthorizationCodes = mysqlTable("oauthAuthorizationCodes", {
  id: int("id").autoincrement().primaryKey(),
  codeHash: varchar("codeHash", { length: 64 }).notNull().unique(),
  userId: int("userId")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  clientId: varchar("clientId", { length: 255 }).notNull(),
  redirectUri: varchar("redirectUri", { length: 1024 }).notNull(),
  codeChallenge: varchar("codeChallenge", { length: 128 }).notNull(),
  scopes: json("scopes").$type<string[]>().notNull(),
  resource: varchar("resource", { length: 1024 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const oauthTokens = mysqlTable("oauthTokens", {
  id: int("id").autoincrement().primaryKey(),
  accessTokenHash: varchar("accessTokenHash", { length: 64 })
    .notNull()
    .unique(),
  refreshTokenHash: varchar("refreshTokenHash", { length: 64 })
    .notNull()
    .unique(),
  userId: int("userId")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  clientId: varchar("clientId", { length: 255 }).notNull(),
  scopes: json("scopes").$type<string[]>().notNull(),
  resource: varchar("resource", { length: 1024 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  refreshExpiresAt: timestamp("refreshExpiresAt").notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const managementBoards = mysqlTable("managementBoards", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  ownerUserId: int("ownerUserId")
    .references(() => users.id)
    .notNull(),
  joinCode: varchar("joinCode", { length: 12 }).notNull().unique(),
  inviteToken: varchar("inviteToken", { length: 64 }).notNull().unique(),
  enabledModules: json("enabledModules").$type<BoardModule[]>(),
  presentationSections: json("presentationSections").$type<
    PresentationSection[]
  >(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const boardMemberships = mysqlTable(
  "boardMemberships",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id)
      .notNull(),
    userId: int("userId")
      .references(() => users.id)
      .notNull(),
    role: mysqlEnum("role", ["manager", "member", "viewer"])
      .default("member")
      .notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("boardMemberships_board_user_unique").on(
      table.boardId,
      table.userId
    ),
  ]
);

export const teamMembers = mysqlTable(
  "teamMembers",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId").references(() => managementBoards.id),
    userId: int("userId").references(() => users.id),
    name: varchar("name", { length: 160 }).notNull(),
    role: varchar("role", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }),
    projectAccess: mysqlEnum("projectAccess", ["all", "selected"])
      .default("all")
      .notNull(),
    allowedProjectIds: json("allowedProjectIds").$type<number[]>(),
    isActive: boolean("isActive").default(true).notNull(),
    color: varchar("color", { length: 16 }).default("#6C8FB8").notNull(),
    avatarInitials: varchar("avatarInitials", { length: 8 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("teamMembers_board_user_unique").on(
      table.boardId,
      table.userId
    ),
  ]
);

export const teamInvitations = mysqlTable("teamInvitations", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId")
    .references(() => teamMembers.id)
    .notNull(),
  invitedByUserId: int("invitedByUserId")
    .references(() => users.id)
    .notNull(),
  boardId: int("boardId").references(() => managementBoards.id),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  accessRole: mysqlEnum("accessRole", ["manager", "member", "viewer"])
    .default("member")
    .notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "cancelled"])
    .default("pending")
    .notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const managerInvitations = mysqlTable("managerInvitations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  invitedByUserId: int("invitedByUserId")
    .references(() => users.id)
    .notNull(),
  acceptedByUserId: int("acceptedByUserId").references(() => users.id),
  status: mysqlEnum("status", ["pending", "accepted", "cancelled"])
    .default("pending")
    .notNull(),
  acceptedAt: timestamp("acceptedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const annualGoals = mysqlTable("annualGoals", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").references(() => managementBoards.id),
  title: varchar("title", { length: 240 }).notNull(),
  theme: varchar("theme", { length: 160 }).notNull(),
  year: int("year").notNull(),
  ownerMemberId: int("ownerMemberId").references(() => teamMembers.id),
  progress: int("progress").default(0).notNull(),
  status: mysqlEnum("status", ["on_track", "attention", "at_risk", "complete"])
    .default("on_track")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").references(() => managementBoards.id),
  title: varchar("title", { length: 240 }).notNull(),
  summary: text("summary"),
  annualGoalId: int("annualGoalId").references(() => annualGoals.id),
  ownerMemberId: int("ownerMemberId")
    .references(() => teamMembers.id)
    .notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  progress: int("progress").default(0).notNull(),
  isManualProgress: boolean("isManualProgress").default(false).notNull(),
  status: mysqlEnum("status", [
    "planned",
    "in_progress",
    "in_review",
    "complete",
    "blocked",
  ])
    .default("planned")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectMembers = mysqlTable("projectMembers", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId")
    .references(() => projects.id)
    .notNull(),
  memberId: int("memberId")
    .references(() => teamMembers.id)
    .notNull(),
});

export const lessonsLearned = mysqlTable("lessonsLearned", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId")
    .references(() => managementBoards.id)
    .notNull(),
  projectId: int("projectId")
    .references(() => projects.id)
    .notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  category: mysqlEnum("category", [
    "success",
    "challenge",
    "improvement",
    "risk",
  ]).notNull(),
  lesson: text("lesson").notNull(),
  recommendation: text("recommendation"),
  lessonDate: timestamp("lessonDate").notNull(),
  createdByUserId: int("createdByUserId")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const researchInterests = mysqlTable(
  "researchInterests",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    keywords: json("keywords").$type<string[]>().notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdByUserId: int("createdByUserId")
      .references(() => users.id)
      .notNull(),
    lastFetchedAt: timestamp("lastFetchedAt"),
    lastFetchStatus: mysqlEnum("lastFetchStatus", ["idle", "success", "error"])
      .default("idle")
      .notNull(),
    lastFetchMessage: text("lastFetchMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("researchInterests_board_name_unique").on(
      table.boardId,
      table.name
    ),
  ]
);

export const researchFeedItems = mysqlTable(
  "researchFeedItems",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    externalId: varchar("externalId", { length: 191 }).notNull(),
    title: varchar("title", { length: 600 }).notNull(),
    abstract: text("abstract"),
    abstractArabic: text("abstractArabic"),
    abstractArabicSourceHash: varchar("abstractArabicSourceHash", {
      length: 64,
    }),
    abstractArabicUpdatedAt: timestamp("abstractArabicUpdatedAt"),
    abstractArabicUpdatedByUserId: int(
      "abstractArabicUpdatedByUserId"
    ).references(() => users.id, { onDelete: "set null" }),
    url: varchar("url", { length: 1024 }).notNull(),
    authors: json("authors").$type<string[]>().notNull(),
    publishedAt: timestamp("publishedAt").notNull(),
    projectId: int("projectId").references(() => projects.id, {
      onDelete: "set null",
    }),
    discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("researchFeedItems_board_source_external_unique").on(
      table.boardId,
      table.source,
      table.externalId
    ),
  ]
);

export const researchFeedMatches = mysqlTable(
  "researchFeedMatches",
  {
    id: int("id").autoincrement().primaryKey(),
    interestId: int("interestId")
      .references(() => researchInterests.id, { onDelete: "cascade" })
      .notNull(),
    feedItemId: int("feedItemId")
      .references(() => researchFeedItems.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("researchFeedMatches_interest_item_unique").on(
      table.interestId,
      table.feedItemId
    ),
  ]
);

export const deliverables = mysqlTable("deliverables", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId")
    .references(() => projects.id)
    .notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  dueDate: timestamp("dueDate"),
  progress: int("progress").default(0).notNull(),
  status: mysqlEnum("status", [
    "not_started",
    "in_progress",
    "in_review",
    "complete",
  ])
    .default("not_started")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deliverableComments = mysqlTable("deliverableComments", {
  id: int("id").autoincrement().primaryKey(),
  deliverableId: int("deliverableId")
    .references(() => deliverables.id)
    .notNull(),
  authorUserId: int("authorUserId")
    .references(() => users.id)
    .notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId").references(() => managementBoards.id),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    projectId: int("projectId").references(() => projects.id),
    deliverableId: int("deliverableId").references(() => deliverables.id),
    parentTaskId: int("parentTaskId"),
    assigneeMemberId: int("assigneeMemberId").references(() => teamMembers.id),
    startDate: timestamp("startDate"),
    dueDate: timestamp("dueDate"),
    priority: mysqlEnum("priority", ["urgent", "high", "medium", "low"])
      .default("medium")
      .notNull(),
    status: mysqlEnum("status", [
      "not_started",
      "in_progress",
      "blocked",
      "in_review",
      "complete",
      "overdue",
    ])
      .default("not_started")
      .notNull(),
    isApprovalPending: boolean("isApprovalPending").default(false).notNull(),
    needsSupport: boolean("needsSupport").default(false).notNull(),
    supportRequest: text("supportRequest"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.parentTaskId],
      foreignColumns: [table.id],
      name: "tasks_parentTaskId_tasks_id_fk",
    }),
  ]
);

export const taskParticipants = mysqlTable("taskParticipants", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId")
    .references(() => tasks.id)
    .notNull(),
  memberId: int("memberId")
    .references(() => teamMembers.id)
    .notNull(),
});

export const taskAssignees = mysqlTable(
  "taskAssignees",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),
    memberId: int("memberId")
      .references(() => teamMembers.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("taskAssignees_task_member_unique").on(
      table.taskId,
      table.memberId
    ),
    index("taskAssignees_member_idx").on(table.memberId),
  ]
);

export const taskChecklistItems = mysqlTable(
  "taskChecklistItems",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    assigneeMemberId: int("assigneeMemberId").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    isComplete: boolean("isComplete").default(false).notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("taskChecklistItems_task_idx").on(table.taskId),
    index("taskChecklistItems_assignee_idx").on(table.assigneeMemberId),
  ]
);

export const taskComments = mysqlTable(
  "taskComments",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId")
      .references(() => tasks.id)
      .notNull(),
    authorMemberId: int("authorMemberId")
      .references(() => teamMembers.id)
      .notNull(),
    replyToCommentId: int("replyToCommentId"),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.replyToCommentId],
      foreignColumns: [table.id],
      name: "taskComments_replyToCommentId_taskComments_id_fk",
    }).onDelete("cascade"),
  ]
);

export const taskAttachments = mysqlTable("taskAttachments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId")
    .references(() => tasks.id)
    .notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  uploadedByMemberId: int("uploadedByMemberId").references(
    () => teamMembers.id
  ),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const calendarEvents = mysqlTable("calendarEvents", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").references(() => managementBoards.id),
  title: varchar("title", { length: 240 }).notNull(),
  projectId: int("projectId").references(() => projects.id),
  eventDate: timestamp("eventDate").notNull(),
  type: mysqlEnum("type", [
    "meeting",
    "delivery",
    "launch",
    "workshop",
    "review",
  ]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 48 }).$type<NotificationType>().notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    message: text("message").notNull(),
    actorUserId: int("actorUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    taskId: int("taskId").references(() => tasks.id, { onDelete: "cascade" }),
    taskCommentId: int("taskCommentId").references(() => taskComments.id, {
      onDelete: "set null",
    }),
    calendarEventId: int("calendarEventId").references(
      () => calendarEvents.id,
      { onDelete: "cascade" }
    ),
    projectId: int("projectId").references(() => projects.id, {
      onDelete: "cascade",
    }),
    link: varchar("link", { length: 512 }).notNull(),
    dedupeKey: varchar("dedupeKey", { length: 191 }).notNull(),
    occurrenceCount: int("occurrenceCount").default(1).notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("notifications_user_dedupe_unique").on(
      table.userId,
      table.dedupeKey
    ),
    index("notifications_user_board_read_idx").on(
      table.userId,
      table.boardId,
      table.readAt
    ),
  ]
);

export const browserPushSubscriptions = mysqlTable(
  "browserPushSubscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: varchar("endpoint", { length: 512 }).notNull(),
    p256dh: varchar("p256dh", { length: 255 }).notNull(),
    auth: varchar("auth", { length: 255 }).notNull(),
    enabledTypes: json("enabledTypes").$type<NotificationType[]>().notNull(),
    expirationTime: timestamp("expirationTime"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("browserPushSubscriptions_endpoint_unique").on(table.endpoint),
    index("browserPushSubscriptions_user_idx").on(table.userId),
  ]
);

export const applicationSettings = mysqlTable("applicationSettings", {
  settingKey: varchar("settingKey", { length: 96 }).primaryKey(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type OAuthClient = typeof oauthClients.$inferSelect;
export type OAuthToken = typeof oauthTokens.$inferSelect;
