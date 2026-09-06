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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: router({
    overview: publicProcedure.query(() => db.getWorkspaceData()),
    invitationByToken: publicProcedure.input(z.object({ token: z.string().min(12).max(64) })).query(({ input }) => db.getInvitationByToken(input.token)),
    invitations: managerProcedure.query(() => db.listTeamInvitations()),
    inviteMember: managerProcedure.input(z.object({ name: z.string().min(2).max(160), teamRole: z.string().min(2).max(160), email: z.string().email() })).mutation(({ input, ctx }) => db.createTeamInvitation(input, ctx.user.id)),
    teamWorkload: publicProcedure.query(() => db.getTeamWorkload()),
    reportSummary: publicProcedure.query(() => db.getReportSummary()),
    createProject: managerProcedure.input(z.object({
      title: z.string().min(2).max(240), summary: z.string().max(1500).optional(), annualGoalId: z.number().int().nullable().optional(),
      ownerMemberId: z.number().int(), startDate: z.date(), endDate: z.date(), status: projectStatus,
    })).mutation(({ input }) => db.createProject(input)),
    createTask: managerProcedure.input(z.object({
      title: z.string().min(2).max(240), projectId: z.number().int().nullable().optional(), assigneeMemberId: z.number().int().nullable().optional(),
      startDate: z.date().nullable().optional(), dueDate: z.date().nullable().optional(), priority: z.enum(["urgent", "high", "medium", "low"]), status: taskStatus, parentTaskId: z.number().int().nullable().optional(),
    })).mutation(({ input }) => db.createTask(input)),
    updateTaskStatus: protectedProcedure.input(z.object({ id: z.number().int(), status: taskStatus })).mutation(({ input }) => db.updateTaskStatus(input.id, input.status)),
    addTaskComment: protectedProcedure.input(z.object({ taskId: z.number().int(), authorMemberId: z.number().int(), body: z.string().min(1).max(3000) })).mutation(({ input }) => db.addTaskComment(input)),
    addDeliverableComment: managerProcedure.input(z.object({ deliverableId: z.number().int(), body: z.string().min(1).max(3000) })).mutation(({ input, ctx }) => db.addDeliverableComment({ ...input, authorUserId: ctx.user.id })),
    updateProjectStatus: managerProcedure.input(z.object({ id: z.number().int(), status: projectStatus })).mutation(({ input }) => db.updateProjectStatus(input.id, input.status)),
  }),
});

export type AppRouter = typeof appRouter;
