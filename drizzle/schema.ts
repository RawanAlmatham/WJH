import { boolean, foreignKey, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const teamMembers = mysqlTable("teamMembers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  role: varchar("role", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  color: varchar("color", { length: 16 }).default("#6C8FB8").notNull(),
  avatarInitials: varchar("avatarInitials", { length: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const annualGoals = mysqlTable("annualGoals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 240 }).notNull(),
  theme: varchar("theme", { length: 160 }).notNull(),
  year: int("year").notNull(),
  ownerMemberId: int("ownerMemberId").references(() => teamMembers.id),
  progress: int("progress").default(0).notNull(),
  status: mysqlEnum("status", ["on_track", "attention", "at_risk", "complete"]).default("on_track").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 240 }).notNull(),
  summary: text("summary"),
  annualGoalId: int("annualGoalId").references(() => annualGoals.id),
  ownerMemberId: int("ownerMemberId").references(() => teamMembers.id).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  progress: int("progress").default(0).notNull(),
  isManualProgress: boolean("isManualProgress").default(false).notNull(),
  status: mysqlEnum("status", ["planned", "in_progress", "in_review", "complete", "blocked"]).default("planned").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectMembers = mysqlTable("projectMembers", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").references(() => projects.id).notNull(),
  memberId: int("memberId").references(() => teamMembers.id).notNull(),
});

export const deliverables = mysqlTable("deliverables", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").references(() => projects.id).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  dueDate: timestamp("dueDate"),
  progress: int("progress").default(0).notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "in_review", "complete"]).default("not_started").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  projectId: int("projectId").references(() => projects.id),
  deliverableId: int("deliverableId").references(() => deliverables.id),
  parentTaskId: int("parentTaskId"),
  assigneeMemberId: int("assigneeMemberId").references(() => teamMembers.id),
  startDate: timestamp("startDate"),
  dueDate: timestamp("dueDate"),
  priority: mysqlEnum("priority", ["urgent", "high", "medium", "low"]).default("medium").notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "in_review", "complete", "overdue"]).default("not_started").notNull(),
  isApprovalPending: boolean("isApprovalPending").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.parentTaskId], foreignColumns: [table.id], name: "tasks_parentTaskId_tasks_id_fk" }),
]);

export const taskParticipants = mysqlTable("taskParticipants", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").references(() => tasks.id).notNull(),
  memberId: int("memberId").references(() => teamMembers.id).notNull(),
});

export const taskComments = mysqlTable("taskComments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").references(() => tasks.id).notNull(),
  authorMemberId: int("authorMemberId").references(() => teamMembers.id).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const taskAttachments = mysqlTable("taskAttachments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").references(() => tasks.id).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  uploadedByMemberId: int("uploadedByMemberId").references(() => teamMembers.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const calendarEvents = mysqlTable("calendarEvents", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 240 }).notNull(),
  projectId: int("projectId").references(() => projects.id),
  eventDate: timestamp("eventDate").notNull(),
  type: mysqlEnum("type", ["meeting", "delivery", "launch", "workshop", "review"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
