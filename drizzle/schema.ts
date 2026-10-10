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
import type { ConsultationQuestion } from "../shared/consultations";

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
  template: varchar("template", { length: 24 }).default("work").notNull(),
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

/**
 * Idea Lab is intentionally stored in its own tables.  It does not reuse the
 * project/task tables so this product can evolve without coupling its workflow
 * to the work-management template.
 */
export const ideaLabProblems = mysqlTable(
  "ideaLabProblems",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 160 }),
    audience: varchar("audience", { length: 240 }),
    stage: mysqlEnum("stage", ["raw", "understanding", "validated"])
      .default("raw")
      .notNull(),
    evidenceStrength: mysqlEnum("evidenceStrength", [
      "none",
      "low",
      "medium",
      "high",
    ])
      .default("none")
      .notNull(),
    ownerUserId: int("ownerUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideaLabProblems_board_stage_idx").on(table.boardId, table.stage),
    index("ideaLabProblems_owner_idx").on(table.ownerUserId),
  ]
);

export const ideaLabIdeas = mysqlTable(
  "ideaLabIdeas",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    problemId: int("problemId").references(() => ideaLabProblems.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 160 }),
    audience: varchar("audience", { length: 240 }),
    stage: mysqlEnum("stage", [
      "seed",
      "exploration",
      "interviews",
      "experiment",
      "promising",
      "archived",
    ])
      .default("seed")
      .notNull(),
    confidence: mysqlEnum("confidence", ["low", "medium", "high"])
      .default("low")
      .notNull(),
    valueProposition: text("valueProposition"),
    proposedSolution: text("proposedSolution"),
    differentiator: text("differentiator"),
    mvpScope: text("mvpScope"),
    assumptions: json("assumptions").$type<string[]>(),
    decision: mysqlEnum("decision", [
      "undecided",
      "continue",
      "pivot",
      "test_more",
      "stop",
      "approved",
    ])
      .default("undecided")
      .notNull(),
    decisionRationale: text("decisionRationale"),
    decisionAt: timestamp("decisionAt"),
    ownerUserId: int("ownerUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideaLabIdeas_board_stage_idx").on(table.boardId, table.stage),
    index("ideaLabIdeas_problem_idx").on(table.problemId),
    index("ideaLabIdeas_owner_idx").on(table.ownerUserId),
  ]
);

export const ideaLabCaptures = mysqlTable(
  "ideaLabCaptures",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    ideaId: int("ideaId").references(() => ideaLabIdeas.id, {
      onDelete: "set null",
    }),
    captureType: mysqlEnum("captureType", [
      "problem",
      "idea",
      "link",
      "note",
      "feedback",
      "statistic",
      "competitor",
    ])
      .default("note")
      .notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content"),
    url: varchar("url", { length: 2048 }),
    status: mysqlEnum("status", ["inbox", "attached", "archived"])
      .default("inbox")
      .notNull(),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideaLabCaptures_board_status_idx").on(table.boardId, table.status),
    index("ideaLabCaptures_idea_idx").on(table.ideaId),
  ]
);

export const ideaLabSources = mysqlTable(
  "ideaLabSources",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    problemId: int("problemId").references(() => ideaLabProblems.id, {
      onDelete: "cascade",
    }),
    ideaId: int("ideaId").references(() => ideaLabIdeas.id, {
      onDelete: "cascade",
    }),
    url: varchar("url", { length: 2048 }).notNull(),
    sourceType: varchar("sourceType", { length: 32 })
      .default("website")
      .notNull(),
    title: varchar("title", { length: 500 }),
    publisher: varchar("publisher", { length: 240 }),
    notes: text("notes"),
    extractedText: text("extractedText"),
    aiSummary: text("aiSummary"),
    aiStatus: mysqlEnum("aiStatus", [
      "not_requested",
      "draft",
      "approved",
      "failed",
    ])
      .default("not_requested")
      .notNull(),
    analyzedByUserId: int("analyzedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideaLabSources_board_idx").on(table.boardId),
    index("ideaLabSources_problem_idx").on(table.problemId),
    index("ideaLabSources_idea_idx").on(table.ideaId),
  ]
);

export const ideaLabInterviews = mysqlTable(
  "ideaLabInterviews",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    problemId: int("problemId").references(() => ideaLabProblems.id, {
      onDelete: "set null",
    }),
    ideaId: int("ideaId").references(() => ideaLabIdeas.id, {
      onDelete: "set null",
    }),
    participantLabel: varchar("participantLabel", { length: 180 }).notNull(),
    interviewDate: timestamp("interviewDate"),
    status: mysqlEnum("status", [
      "planned",
      "completed",
      "transcribed",
      "analyzed",
    ])
      .default("planned")
      .notNull(),
    transcript: text("transcript"),
    summary: text("summary"),
    insights: text("insights"),
    themes: json("themes").$type<string[]>(),
    ownerUserId: int("ownerUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideaLabInterviews_board_status_idx").on(table.boardId, table.status),
    index("ideaLabInterviews_idea_idx").on(table.ideaId),
  ]
);

export const ideaLabExperiments = mysqlTable(
  "ideaLabExperiments",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    ideaId: int("ideaId")
      .references(() => ideaLabIdeas.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    hypothesis: text("hypothesis").notNull(),
    successMetric: varchar("successMetric", { length: 280 }),
    targetValue: int("targetValue"),
    currentValue: int("currentValue").default(0),
    status: mysqlEnum("status", ["planned", "running", "review", "complete"])
      .default("planned")
      .notNull(),
    result: text("result"),
    ownerUserId: int("ownerUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideaLabExperiments_board_status_idx").on(
      table.boardId,
      table.status
    ),
    index("ideaLabExperiments_idea_idx").on(table.ideaId),
  ]
);

export const commerceSections = mysqlTable(
  "commerceSections",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    position: int("position").default(0).notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("commerceSections_board_idx").on(table.boardId)]
);

export const commerceTasks = mysqlTable(
  "commerceTasks",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    sectionId: int("sectionId")
      .references(() => commerceSections.id, { onDelete: "restrict" })
      .notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["todo", "in_progress", "blocked", "done"])
      .default("todo")
      .notNull(),
    priority: mysqlEnum("priority", ["normal", "urgent"])
      .default("normal")
      .notNull(),
    assigneeUserId: int("assigneeUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: varchar("dueDate", { length: 10 }),
    waitingReason: text("waitingReason"),
    checklist:
      json("checklist").$type<import("../shared/commerce").CommerceChecklist>(),
    archived: boolean("archived").default(false).notNull(),
    version: int("version").default(1).notNull(),
    createdByUserId: int("createdByUserId")
      .references(() => users.id)
      .notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("commerceTasks_board_idx").on(table.boardId, table.sectionId),
    index("commerceTasks_assignee_idx").on(table.assigneeUserId),
  ]
);

export const commerceResources = mysqlTable("commerceResources", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId")
    .references(() => managementBoards.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 280 }).notNull(),
  url: text("url").notNull(),
  notes: text("notes"),
  archived: boolean("archived").default(false).notNull(),
  createdByUserId: int("createdByUserId")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ideaLabTasks = mysqlTable(
  "ideaLabTasks",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    problemId: int("problemId").references(() => ideaLabProblems.id, {
      onDelete: "set null",
    }),
    ideaId: int("ideaId").references(() => ideaLabIdeas.id, {
      onDelete: "set null",
    }),
    interviewId: int("interviewId").references(() => ideaLabInterviews.id, {
      onDelete: "set null",
    }),
    experimentId: int("experimentId").references(() => ideaLabExperiments.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["todo", "in_progress", "blocked", "done"])
      .default("todo")
      .notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"])
      .default("medium")
      .notNull(),
    dueDate: timestamp("dueDate"),
    assigneeUserId: int("assigneeUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideaLabTasks_board_status_idx").on(table.boardId, table.status),
    index("ideaLabTasks_assignee_idx").on(table.assigneeUserId),
    index("ideaLabTasks_due_date_idx").on(table.boardId, table.dueDate),
    index("ideaLabTasks_problem_idx").on(table.problemId),
    index("ideaLabTasks_idea_idx").on(table.ideaId),
  ]
);

export const ideaLabSubtasks = mysqlTable(
  "ideaLabSubtasks",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    taskId: int("taskId")
      .references(() => ideaLabTasks.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["todo", "in_progress", "blocked", "done"])
      .default("todo")
      .notNull(),
    assigneeUserId: int("assigneeUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: timestamp("dueDate"),
    completedAt: timestamp("completedAt"),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("ideaLabSubtasks_task_idx").on(table.boardId, table.taskId)]
);

export const ideaLabConsultations = mysqlTable(
  "ideaLabConsultations",
  {
    id: int("id").autoincrement().primaryKey(),
    boardId: int("boardId")
      .references(() => managementBoards.id, { onDelete: "cascade" })
      .notNull(),
    ideaId: int("ideaId")
      .references(() => ideaLabIdeas.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    consultant: varchar("consultant", { length: 280 }).notNull(),
    goal: text("goal").notNull(),
    status: mysqlEnum("status", ["preparing", "ready", "completed"])
      .default("preparing")
      .notNull(),
    questions: json("questions").$type<ConsultationQuestion[]>().notNull(),
    summary: text("summary").notNull(),
    recommendations: text("recommendations").notNull(),
    taskId: int("taskId").references(() => ideaLabTasks.id, {
      onDelete: "set null",
    }),
    version: int("version").default(1).notNull(),
    createdByUserId: int("createdByUserId")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideaLabConsultations_idea_idx").on(table.boardId, table.ideaId),
  ]
);

export const userAiSettings = mysqlTable("userAiSettings", {
  userId: int("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: mysqlEnum("provider", ["openai"]).default("openai").notNull(),
  model: varchar("model", { length: 120 }).default("gpt-4.1-mini").notNull(),
  encryptedApiKey: text("encryptedApiKey").notNull(),
  apiKeyLastFour: varchar("apiKeyLastFour", { length: 4 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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

export const taskInterviews = mysqlTable(
  "taskInterviews",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId")
      .references(() => tasks.id, { onDelete: "cascade" })
      .notNull(),
    participantLabel: varchar("participantLabel", { length: 180 }).notNull(),
    interviewDate: timestamp("interviewDate"),
    status: mysqlEnum("status", [
      "planned",
      "completed",
      "transcribed",
      "analyzed",
    ])
      .default("planned")
      .notNull(),
    recordingUrl: varchar("recordingUrl", { length: 1024 }),
    recordingConsent: boolean("recordingConsent").default(false).notNull(),
    transcript: text("transcript"),
    summary: text("summary"),
    insights: text("insights"),
    themes: json("themes").$type<string[]>(),
    createdByUserId: int("createdByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("taskInterviews_task_idx").on(table.taskId),
    index("taskInterviews_status_idx").on(table.status),
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
  location: varchar("location", { length: 320 }),
  notes: text("notes"),
  type: mysqlEnum("type", [
    "meeting",
    "delivery",
    "launch",
    "workshop",
    "review",
    "activity",
    "flight",
    "stay",
    "transport",
    "meal",
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
