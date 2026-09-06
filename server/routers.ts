import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

const taskStatus = z.enum(["not_started", "in_progress", "in_review", "complete", "overdue"]);
const projectStatus = z.enum(["planned", "in_progress", "in_review", "complete", "blocked"]);
const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "هذه العملية متاحة لمدير القسم فقط" });
  return next();
});
const teamMemberProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role === "admin" || await db.isUserTeamMember(ctx.user.id)) return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "يلزم أن تكون عضوًا في فريق القسم لإضافة مهمة" });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  boards: router({
    mine: protectedProcedure.query(({ ctx }) => db.listUserBoards(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(180) })).mutation(({ input, ctx }) => db.createManagementBoard(input.name, ctx.user.id)),
    joinByCode: protectedProcedure.input(z.object({ joinCode: z.string().trim().min(6).max(12) })).mutation(async ({ input, ctx }) => {
      const board = await db.getBoardByJoinCode(input.joinCode);
      if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "لم نعثر على لوحة بهذا الرمز" });
      return db.joinManagementBoard(board.id, ctx.user.id);
    }),
    joinByLink: protectedProcedure.input(z.object({ inviteToken: z.string().min(20).max(64) })).mutation(async ({ input, ctx }) => {
      const board = await db.getBoardByInviteToken(input.inviteToken);
      if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "رابط الانضمام غير صالح أو انتهت صلاحيته" });
      return db.joinManagementBoard(board.id, ctx.user.id);
    }),
  }),
  workspace: router({
    overview: publicProcedure.query(() => db.getWorkspaceData()),
    invitationByToken: publicProcedure.input(z.object({ token: z.string().min(12).max(64) })).query(({ input }) => db.getInvitationByToken(input.token)),
    invitations: managerProcedure.query(() => db.listTeamInvitations()),
    inviteMember: managerProcedure.input(z.object({ name: z.string().min(2).max(160), teamRole: z.string().min(2).max(160), email: z.string().email() })).mutation(({ input, ctx }) => db.createTeamInvitation(input, ctx.user.id)),
    teamWorkload: publicProcedure.query(() => db.getTeamWorkload()),
    reportSummary: publicProcedure.query(() => db.getReportSummary()),
    createProject: teamMemberProcedure.input(z.object({
      title: z.string().min(2).max(240), summary: z.string().max(1500).optional(), annualGoalId: z.number().int().nullable().optional(),
      ownerMemberId: z.number().int(), startDate: z.date(), endDate: z.date(), status: projectStatus,
    })).mutation(({ input }) => db.createProject(input)),
    createTask: teamMemberProcedure.input(z.object({
      title: z.string().min(2).max(240), projectId: z.number().int().nullable().optional(), assigneeMemberId: z.number().int().nullable().optional(),
      startDate: z.date().nullable().optional(), dueDate: z.date().nullable().optional(), priority: z.enum(["urgent", "high", "medium", "low"]), status: taskStatus, parentTaskId: z.number().int().nullable().optional(),
    })).mutation(({ input }) => db.createTask(input)),
    assignTask: teamMemberProcedure.input(z.object({ id: z.number().int(), assigneeMemberId: z.number().int().nullable() })).mutation(({ input }) => db.assignTask(input.id, input.assigneeMemberId)),
    updateTaskStatus: protectedProcedure.input(z.object({ id: z.number().int(), status: taskStatus })).mutation(({ input }) => db.updateTaskStatus(input.id, input.status)),
    addTaskComment: protectedProcedure.input(z.object({ taskId: z.number().int(), authorMemberId: z.number().int(), body: z.string().min(1).max(3000) })).mutation(({ input }) => db.addTaskComment(input)),
    addDeliverableComment: teamMemberProcedure.input(z.object({ deliverableId: z.number().int(), body: z.string().min(1).max(3000) })).mutation(({ input, ctx }) => db.addDeliverableComment({ ...input, authorUserId: ctx.user.id })),
    updateProjectStatus: teamMemberProcedure.input(z.object({ id: z.number().int(), status: projectStatus })).mutation(({ input }) => db.updateProjectStatus(input.id, input.status)),
  }),
});

export type AppRouter = typeof appRouter;
