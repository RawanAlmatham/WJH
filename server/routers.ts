import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import * as db from "./db";
import { createSessionToken } from "./_core/auth";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./_core/password";
import { boardModules } from "@shared/boardModules";
import { presentationSections } from "@shared/presentationSections";
import { notificationTypes } from "@shared/notificationTypes";
import * as notificationService from "./notifications";
import {
  listOAuthConnections,
  revokeAllOAuthTokensForUser,
} from "./mcp/oauthStore";

const taskStatus = z.enum([
  "not_started",
  "in_progress",
  "blocked",
  "in_review",
  "complete",
  "overdue",
]);
const projectStatus = z.enum([
  "planned",
  "in_progress",
  "in_review",
  "complete",
  "blocked",
]);

async function bestEffortNotification<T>(
  operation: string,
  action: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    console.error(`[Notifications] ${operation} failed`, error);
    return undefined;
  }
}

const platformManagerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "manager" && ctx.user.role !== "admin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "إنشاء اللوحات متاح لمدير المنصة أو مدير لوحة فقط",
    });
  return next();
});
const boardProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const activeBoardId = await db.getActiveBoardId(ctx.user.id);
  if (!activeBoardId)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "اختر لوحة عمل أو أنشئ لوحة جديدة أولًا",
    });
  return next({ ctx: { ...ctx, activeBoardId } });
});
const managerProcedure = boardProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role === "admin") return next();
  if (!(await db.hasBoardRole(ctx.user.id, ["manager"], ctx.activeBoardId)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذه العملية متاحة لمدير اللوحة فقط",
    });
  return next();
});
const teamMemberProcedure = boardProcedure.use(async ({ ctx, next }) => {
  if (
    await db.hasBoardRole(ctx.user.id, ["manager", "member"], ctx.activeBoardId)
  )
    return next();
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "يلزم أن تكون عضوًا في فريق اللوحة لتنفيذ هذه العملية",
  });
});

async function requireProjectAccess(
  userId: number,
  boardId: number,
  projectId: number | null | undefined
) {
  if (!projectId) return;
  if (!(await db.canUserAccessProject(userId, boardId, projectId)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذا المشروع غير متاح لحسابك",
    });
}

async function requireTaskAccess(
  userId: number,
  boardId: number,
  taskId: number
) {
  if (!(await db.canUserAccessTask(userId, boardId, taskId)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذه المهمة غير متاحة لحسابك",
    });
}

async function requireDeliverableAccess(
  userId: number,
  boardId: number,
  deliverableId: number
) {
  if (!(await db.canUserAccessDeliverable(userId, boardId, deliverableId)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذا المخرج غير متاح لحسابك",
    });
}

async function requireResearchFeedItemAccess(
  userId: number,
  boardId: number,
  feedItemId: number
) {
  if (!(await db.canUserAccessResearchFeedItem(userId, boardId, feedItemId)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذه الخلاصة مرتبطة بمشروع غير متاح لحسابك",
    });
}

async function requireLessonAccess(
  userId: number,
  boardId: number,
  lessonId: number
) {
  if (!(await db.canUserAccessLesson(userId, boardId, lessonId)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذا الدرس مرتبط بمشروع غير متاح لحسابك",
    });
}

async function requireCalendarEventAccess(
  userId: number,
  boardId: number,
  eventId: number
) {
  if (!(await db.canUserAccessCalendarEvent(userId, boardId, eventId)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذا الموعد مرتبط بمشروع غير متاح لحسابك",
    });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    signup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(160),
          email: z.string().trim().email().max(320),
          password: z.string().min(8).max(200),
          invitationToken: z.string().min(12).max(64),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase();
        const [teamInvitation, managerInvitation] = await Promise.all([
          db.getPendingInvitationForSignup(input.invitationToken, email),
          db.getPendingManagerInvitationForSignup(input.invitationToken, email),
        ]);
        if (!teamInvitation && !managerInvitation)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "إنشاء الحساب متاح من خلال دعوة صالحة فقط",
          });
        const openId = db.localUserId(email);
        const existing = await db.getUserByOpenId(openId);
        if (existing?.passwordHash)
          throw new TRPCError({
            code: "CONFLICT",
            message: "يوجد حساب مسجل بهذا البريد",
          });
        await db.upsertUser({
          openId,
          name: input.name,
          email,
          passwordHash: await hashPassword(input.password),
          loginMethod: "local",
          role: managerInvitation ? "manager" : undefined,
          lastSignedIn: new Date(),
        });
        const user = await db.getUserByOpenId(openId);
        if (!user)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "تعذر إنشاء المستخدم. تحقق من قاعدة البيانات",
          });
        const token = await createSessionToken(user.id);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 1000 * 60 * 60 * 24 * 365,
        });
        return user;
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(320),
          password: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let user = await db.getUserByOpenId(db.localUserId(input.email));
        if (
          !user?.passwordHash ||
          !(await verifyPassword(input.password, user.passwordHash))
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
          });
        }
        user = await db.ensureConfiguredAdmin(user);
        const token = await createSessionToken(user.id);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 1000 * 60 * 60 * 24 * 365,
        });
        return user;
      }),
    logout: publicProcedure
      .input(
        z
          .object({ pushEndpoint: z.string().url().max(512).optional() })
          .optional()
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user && input?.pushEndpoint)
          await bestEffortNotification(
            "unlink push subscription on logout",
            () =>
              notificationService.removeBrowserPushSubscription(
                ctx.user!.id,
                input.pushEndpoint!
              )
          );
        ctx.res.clearCookie(COOKIE_NAME, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: -1,
        });
        return { success: true } as const;
      }),
    mcpConnections: protectedProcedure.query(({ ctx }) =>
      listOAuthConnections(ctx.user.id)
    ),
    revokeMcpConnections: protectedProcedure.mutation(({ ctx }) =>
      revokeAllOAuthTokensForUser(ctx.user.id)
    ),
  }),
  managerInvitations: router({
    byToken: publicProcedure
      .input(z.object({ token: z.string().min(12).max(64) }))
      .query(({ input }) => db.getManagerInvitationByToken(input.token)),
    accept: protectedProcedure
      .input(z.object({ token: z.string().min(12).max(64) }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.acceptManagerInvitation(input.token, ctx.user);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "تعذر قبول دعوة مدير اللوحة",
          });
        }
      }),
  }),
  admin: router({
    overview: adminProcedure.query(() => db.getAdminOverview()),
    inviteManager: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(160),
          email: z.string().trim().email().max(320),
        })
      )
      .mutation(({ input, ctx }) =>
        db.createManagerInvitation(input, ctx.user.id)
      ),
    cancelManagerInvitation: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => db.cancelManagerInvitation(input.id)),
    reissueManagerInvitation: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        db.reissueManagerInvitation(input.id, ctx.user.id)
      ),
    updateBoardMemberAccess: adminProcedure
      .input(
        z.object({
          memberId: z.number().int().positive(),
          accessRole: z.enum(["manager", "member", "viewer"]),
        })
      )
      .mutation(({ input, ctx }) =>
        db.updateBoardMemberAccess({ ...input, actingUserId: ctx.user.id })
      ),
    setBoardMemberActive: adminProcedure
      .input(
        z.object({
          memberId: z.number().int().positive(),
          active: z.boolean(),
        })
      )
      .mutation(({ input, ctx }) =>
        db.setBoardMemberActive({ ...input, actingUserId: ctx.user.id })
      ),
  }),
  boards: router({
    mine: protectedProcedure.query(({ ctx }) => db.listUserBoards(ctx.user.id)),
    create: platformManagerProcedure
      .input(z.object({ name: z.string().trim().min(2).max(180) }))
      .mutation(({ input, ctx }) =>
        db.createManagementBoard(input.name, ctx.user.id)
      ),
    select: protectedProcedure
      .input(z.object({ boardId: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        db.selectManagementBoard(ctx.user.id, input.boardId)
      ),
    joinByCode: protectedProcedure
      .input(z.object({ joinCode: z.string().trim().min(6).max(12) }))
      .mutation(async ({ input, ctx }) => {
        const board = await db.getBoardByJoinCode(input.joinCode);
        if (!board)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "لم نعثر على لوحة بهذا الرمز",
          });
        return db.joinManagementBoard(board.id, ctx.user.id);
      }),
    joinByLink: protectedProcedure
      .input(z.object({ inviteToken: z.string().min(20).max(64) }))
      .mutation(async ({ input, ctx }) => {
        const board = await db.getBoardByInviteToken(input.inviteToken);
        if (!board)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "رابط الانضمام غير صالح أو انتهت صلاحيته",
          });
        return db.joinManagementBoard(board.id, ctx.user.id);
      }),
  }),
  workspace: router({
    overview: boardProcedure.query(({ ctx }) =>
      db.getWorkspaceData(ctx.activeBoardId, ctx.user.id)
    ),
    notifications: boardProcedure
      .input(z.object({ unreadOnly: z.boolean().default(false) }))
      .query(({ input, ctx }) =>
        notificationService.listNotifications(
          ctx.user.id,
          ctx.activeBoardId,
          input.unreadOnly
        )
      ),
    markNotificationRead: boardProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        notificationService.markNotificationRead(
          input.id,
          ctx.user.id,
          ctx.activeBoardId
        )
      ),
    markAllNotificationsRead: boardProcedure.mutation(({ ctx }) =>
      notificationService.markAllNotificationsRead(
        ctx.user.id,
        ctx.activeBoardId
      )
    ),
    browserPushConfig: protectedProcedure.query(({ ctx }) =>
      notificationService.getBrowserPushConfig(ctx.user.id)
    ),
    saveBrowserPushSubscription: protectedProcedure
      .input(
        z.object({
          endpoint: z.string().url().max(512),
          p256dh: z.string().min(20).max(255),
          auth: z.string().min(8).max(255),
          expirationTime: z.number().nullable().optional(),
          enabledTypes: z
            .array(z.enum(notificationTypes))
            .max(notificationTypes.length),
        })
      )
      .mutation(({ input, ctx }) =>
        notificationService.saveBrowserPushSubscription({
          ...input,
          userId: ctx.user.id,
        })
      ),
    updateBrowserPushTypes: protectedProcedure
      .input(
        z.object({
          endpoint: z.string().url().max(512),
          enabledTypes: z
            .array(z.enum(notificationTypes))
            .max(notificationTypes.length),
        })
      )
      .mutation(({ input, ctx }) =>
        notificationService.updateBrowserPushTypes(
          ctx.user.id,
          input.endpoint,
          input.enabledTypes
        )
      ),
    removeBrowserPushSubscription: protectedProcedure
      .input(z.object({ endpoint: z.string().url().max(512) }))
      .mutation(({ input, ctx }) =>
        notificationService.removeBrowserPushSubscription(
          ctx.user.id,
          input.endpoint
        )
      ),
    invitationByToken: publicProcedure
      .input(z.object({ token: z.string().min(12).max(64) }))
      .query(({ input }) => db.getInvitationByToken(input.token)),
    acceptInvitation: protectedProcedure
      .input(z.object({ token: z.string().min(12).max(64) }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.acceptTeamInvitation(input.token, ctx.user);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error ? error.message : "تعذر قبول الدعوة",
          });
        }
      }),
    invitations: managerProcedure.query(({ ctx }) =>
      db.listTeamInvitations(ctx.user.id)
    ),
    teamAdministration: managerProcedure.query(({ ctx }) =>
      db.getBoardTeamAdministration(ctx.activeBoardId)
    ),
    updateTeamMemberAccess: managerProcedure
      .input(
        z.object({
          memberId: z.number().int().positive(),
          accessRole: z.enum(["manager", "member", "viewer"]),
        })
      )
      .mutation(({ input, ctx }) =>
        db.updateBoardMemberAccess({
          ...input,
          boardId: ctx.activeBoardId,
          actingUserId: ctx.user.id,
        })
      ),
    updateTeamMemberProjectAccess: managerProcedure
      .input(
        z.object({
          memberId: z.number().int().positive(),
          projectAccess: z.enum(["all", "selected"]),
          allowedProjectIds: z
            .array(z.number().int().positive())
            .max(500)
            .refine(ids => new Set(ids).size === ids.length, {
              message: "لا يمكن تكرار المشروع نفسه",
            }),
        })
      )
      .mutation(({ input, ctx }) =>
        db.updateTeamMemberProjectAccess({
          ...input,
          boardId: ctx.activeBoardId,
        })
      ),
    setTeamMemberActive: managerProcedure
      .input(
        z.object({
          memberId: z.number().int().positive(),
          active: z.boolean(),
        })
      )
      .mutation(({ input, ctx }) =>
        db.setBoardMemberActive({
          ...input,
          boardId: ctx.activeBoardId,
          actingUserId: ctx.user.id,
        })
      ),
    reissueTeamInvitation: managerProcedure
      .input(z.object({ memberId: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        db.reissueTeamInvitation({
          memberId: input.memberId,
          boardId: ctx.activeBoardId,
          invitedByUserId: ctx.user.id,
        })
      ),
    deleteTeamMember: managerProcedure
      .input(z.object({ memberId: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        db.deleteTeamMember({
          memberId: input.memberId,
          boardId: ctx.activeBoardId,
          actingUserId: ctx.user.id,
        })
      ),
    inviteMember: managerProcedure
      .input(
        z.object({
          name: z.string().min(2).max(160),
          teamRole: z.string().min(2).max(160),
          email: z.string().email(),
          accessRole: z.enum(["manager", "member", "viewer"]).default("member"),
          projectAccess: z.enum(["all", "selected"]).default("all"),
          allowedProjectIds: z
            .array(z.number().int().positive())
            .max(500)
            .default([]),
        })
      )
      .mutation(({ input, ctx }) =>
        db.createTeamInvitation(input, ctx.user.id)
      ),
    teamWorkload: boardProcedure.query(({ ctx }) =>
      db.getTeamWorkload(ctx.activeBoardId, ctx.user.id)
    ),
    reportSummary: boardProcedure.query(({ ctx }) =>
      db.getReportSummary(ctx.activeBoardId, ctx.user.id)
    ),
    updateBoardModules: managerProcedure
      .input(
        z.object({
          enabledModules: z
            .array(z.enum(boardModules))
            .max(boardModules.length)
            .refine(items => new Set(items).size === items.length),
        })
      )
      .mutation(({ input, ctx }) =>
        db.updateBoardModules(ctx.activeBoardId, input.enabledModules)
      ),
    updateBoardPresentationSections: managerProcedure
      .input(
        z.object({
          presentationSections: z
            .array(z.enum(presentationSections))
            .min(1)
            .max(presentationSections.length)
            .refine(items => new Set(items).size === items.length),
        })
      )
      .mutation(({ input, ctx }) =>
        db.updateBoardPresentationSections(
          ctx.activeBoardId,
          input.presentationSections
        )
      ),
    researchFeed: boardProcedure.query(({ ctx }) =>
      db.getResearchFeed(ctx.activeBoardId, ctx.user.id)
    ),
    createResearchInterest: teamMemberProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(180),
          keywords: z.array(z.string().trim().min(2).max(100)).min(1).max(40),
        })
      )
      .mutation(({ input, ctx }) =>
        db.createResearchInterest({
          ...input,
          boardId: ctx.activeBoardId,
          createdByUserId: ctx.user.id,
        })
      ),
    updateResearchInterest: managerProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(2).max(180),
          keywords: z.array(z.string().trim().min(2).max(100)).min(1).max(40),
        })
      )
      .mutation(({ input, ctx }) =>
        db.updateResearchInterest({ ...input, boardId: ctx.activeBoardId })
      ),
    setResearchInterestActive: managerProcedure
      .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
      .mutation(({ input, ctx }) =>
        db.setResearchInterestActive({
          ...input,
          boardId: ctx.activeBoardId,
        })
      ),
    deleteResearchInterest: managerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        db.deleteResearchInterest(input.id, ctx.activeBoardId)
      ),
    refreshResearchInterest: teamMemberProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        db.refreshResearchInterest(input.id, ctx.activeBoardId)
      ),
    refreshResearchFeed: managerProcedure.mutation(({ ctx }) =>
      db.refreshBoardResearchFeed(ctx.activeBoardId)
    ),
    linkResearchFeedItem: teamMemberProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          projectId: z.number().int().positive().nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireResearchFeedItemAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.id
        );
        await requireProjectAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.projectId
        );
        return db.linkResearchFeedItemToProject({
          ...input,
          boardId: ctx.activeBoardId,
        });
      }),
    saveResearchFeedTranslations: teamMemberProcedure
      .input(
        z.object({
          translations: z
            .array(
              z.object({
                id: z.number().int().positive(),
                abstractArabic: z.string().trim().min(20).max(20_000),
              })
            )
            .min(1)
            .max(20)
            .refine(
              items =>
                new Set(items.map(item => item.id)).size === items.length,
              { message: "لا يمكن تكرار الخلاصة نفسها" }
            ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await Promise.all(
          input.translations.map(translation =>
            requireResearchFeedItemAccess(
              ctx.user.id,
              ctx.activeBoardId,
              translation.id
            )
          )
        );
        return db.saveResearchFeedArabicTranslations({
          translations: input.translations,
          boardId: ctx.activeBoardId,
          translatedByUserId: ctx.user.id,
        });
      }),
    createAnnualGoal: managerProcedure
      .input(
        z.object({
          title: z.string().trim().min(2).max(240),
          theme: z.string().trim().min(2).max(160),
          year: z.number().int().min(2000).max(2100),
          ownerMemberId: z.number().int().positive(),
        })
      )
      .mutation(({ input, ctx }) =>
        db.createAnnualGoal({ ...input, boardId: ctx.activeBoardId })
      ),
    updateAnnualGoal: managerProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().trim().min(2).max(240),
          theme: z.string().trim().min(2).max(160),
          year: z.number().int().min(2000).max(2100),
          ownerMemberId: z.number().int().positive(),
          status: z.enum(["on_track", "attention", "at_risk", "complete"]),
        })
      )
      .mutation(({ input, ctx }) =>
        db.updateAnnualGoal({ ...input, boardId: ctx.activeBoardId })
      ),
    deleteAnnualGoal: managerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        db.deleteAnnualGoal(input.id, ctx.activeBoardId)
      ),
    createProject: teamMemberProcedure
      .input(
        z
          .object({
            title: z.string().min(2).max(240),
            summary: z.string().max(1500).optional(),
            annualGoalId: z.number().int().nullable().optional(),
            ownerMemberId: z.number().int(),
            responsibleMemberIds: z
              .array(z.number().int().positive())
              .min(1)
              .max(100)
              .refine(ids => new Set(ids).size === ids.length, {
                message: "لا يمكن تكرار المسؤول نفسه",
              })
              .optional(),
            startDate: z.date(),
            endDate: z.date().nullable().optional(),
            status: projectStatus,
          })
          .refine(input => !input.endDate || input.endDate >= input.startDate, {
            message: "تاريخ نهاية المشروع يجب أن يكون بعد تاريخ البداية",
            path: ["endDate"],
          })
      )
      .mutation(({ input, ctx }) =>
        db.createProject({
          ...input,
          boardId: ctx.activeBoardId,
          createdByUserId: ctx.user.id,
        })
      ),
    createLessonLearned: teamMemberProcedure
      .input(
        z.object({
          title: z.string().trim().min(2).max(240),
          projectId: z.number().int().positive(),
          category: z.enum(["success", "challenge", "improvement", "risk"]),
          lesson: z.string().trim().min(2).max(5000),
          recommendation: z.string().trim().max(5000).optional(),
          lessonDate: z.date(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProjectAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.projectId
        );
        return db.createLessonLearned({
          ...input,
          boardId: ctx.activeBoardId,
          createdByUserId: ctx.user.id,
        });
      }),
    updateLessonLearned: teamMemberProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().trim().min(2).max(240),
          projectId: z.number().int().positive(),
          category: z.enum(["success", "challenge", "improvement", "risk"]),
          lesson: z.string().trim().min(2).max(5000),
          recommendation: z.string().trim().max(5000).optional(),
          lessonDate: z.date(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireLessonAccess(ctx.user.id, ctx.activeBoardId, input.id);
        await requireProjectAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.projectId
        );
        return db.updateLessonLearned({
          ...input,
          boardId: ctx.activeBoardId,
        });
      }),
    deleteLessonLearned: teamMemberProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await requireLessonAccess(ctx.user.id, ctx.activeBoardId, input.id);
        return db.deleteLessonLearned(input.id, ctx.activeBoardId);
      }),
    createCalendarEvent: teamMemberProcedure
      .input(
        z.object({
          title: z.string().trim().min(2).max(240),
          projectId: z.number().int().positive().nullable().optional(),
          eventDate: z.date(),
          type: z.enum(["meeting", "delivery", "launch", "workshop", "review"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProjectAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.projectId
        );
        return db.createCalendarEvent({
          ...input,
          boardId: ctx.activeBoardId,
        });
      }),
    updateCalendarEvent: teamMemberProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().trim().min(2).max(240),
          projectId: z.number().int().positive().nullable().optional(),
          eventDate: z.date(),
          type: z.enum(["meeting", "delivery", "launch", "workshop", "review"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireCalendarEventAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.id
        );
        await requireProjectAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.projectId
        );
        const result = await db.updateCalendarEvent({
          ...input,
          boardId: ctx.activeBoardId,
        });
        await bestEffortNotification("reschedule launch reminder", () =>
          notificationService.clearLaunchReminderNotifications(
            input.id,
            ctx.activeBoardId
          )
        );
        return result;
      }),
    deleteCalendarEvent: teamMemberProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await requireCalendarEventAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.id
        );
        return db.deleteCalendarEvent(input.id, ctx.activeBoardId);
      }),
    createTask: teamMemberProcedure
      .input(
        z
          .object({
            title: z.string().min(2).max(240),
            description: z.string().max(5000).optional(),
            projectId: z.number().int().nullable().optional(),
            assigneeMemberId: z.number().int().nullable().optional(),
            assigneeMemberIds: z
              .array(z.number().int().positive())
              .max(20)
              .optional(),
            startDate: z.date().nullable().optional(),
            dueDate: z.date().nullable().optional(),
            priority: z.enum(["urgent", "high", "medium", "low"]),
            status: taskStatus,
            parentTaskId: z.number().int().nullable().optional(),
          })
          .refine(
            input =>
              !input.startDate ||
              !input.dueDate ||
              input.dueDate >= input.startDate,
            {
              message: "الموعد النهائي يجب أن يكون بعد تاريخ البداية",
              path: ["dueDate"],
            }
          )
      )
      .mutation(async ({ input, ctx }) => {
        await requireProjectAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.projectId
        );
        if (input.parentTaskId)
          await requireTaskAccess(
            ctx.user.id,
            ctx.activeBoardId,
            input.parentTaskId
          );
        const result = await db.createTask({
          ...input,
          boardId: ctx.activeBoardId,
        });
        await bestEffortNotification("notify task assignment", () =>
          notificationService.notifyTaskCreated(
            result.id,
            ctx.activeBoardId,
            ctx.user.id
          )
        );
        return result;
      }),
    updateTask: teamMemberProcedure
      .input(
        z
          .object({
            id: z.number().int().positive(),
            title: z.string().trim().min(2).max(240),
            description: z.string().max(5000).optional(),
            projectId: z.number().int().nullable().optional(),
            assigneeMemberId: z.number().int().nullable().optional(),
            assigneeMemberIds: z
              .array(z.number().int().positive())
              .max(20)
              .optional(),
            startDate: z.date().nullable().optional(),
            dueDate: z.date().nullable().optional(),
            priority: z.enum(["urgent", "high", "medium", "low"]),
            status: taskStatus,
          })
          .refine(
            input =>
              !input.startDate ||
              !input.dueDate ||
              input.dueDate >= input.startDate,
            {
              message: "الموعد النهائي يجب أن يكون بعد تاريخ البداية",
              path: ["dueDate"],
            }
          )
      )
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.id);
        await requireProjectAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.projectId
        );
        const before = await bestEffortNotification(
          "read task notification snapshot",
          () =>
            notificationService.getTaskNotificationSnapshot(
              input.id,
              ctx.activeBoardId
            )
        );
        const result = await db.updateTask({
          ...input,
          boardId: ctx.activeBoardId,
        });
        if (before)
          await bestEffortNotification("notify task update", () =>
            notificationService.notifyTaskUpdated(
              before,
              ctx.activeBoardId,
              ctx.user.id
            )
          );
        return result;
      }),
    deleteTask: teamMemberProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.id);
        return db.deleteTask(input.id, ctx.activeBoardId);
      }),
    assignTask: teamMemberProcedure
      .input(
        z.object({
          id: z.number().int(),
          assigneeMemberId: z.number().int().nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.id);
        const before = await bestEffortNotification(
          "read assignment notification snapshot",
          () =>
            notificationService.getTaskNotificationSnapshot(
              input.id,
              ctx.activeBoardId
            )
        );
        const result = await db.assignTask(
          input.id,
          input.assigneeMemberId,
          ctx.activeBoardId
        );
        if (before)
          await bestEffortNotification("notify task assignment update", () =>
            notificationService.notifyTaskUpdated(
              before,
              ctx.activeBoardId,
              ctx.user.id
            )
          );
        return result;
      }),
    createTaskChecklistItem: teamMemberProcedure
      .input(
        z.object({
          taskId: z.number().int().positive(),
          title: z.string().trim().min(1).max(240),
          assigneeMemberId: z.number().int().positive().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.taskId);
        return db.createTaskChecklistItem({
          ...input,
          boardId: ctx.activeBoardId,
        });
      }),
    updateTaskChecklistItem: teamMemberProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          taskId: z.number().int().positive(),
          title: z.string().trim().min(1).max(240),
          assigneeMemberId: z.number().int().positive().nullable().optional(),
          isComplete: z.boolean(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.taskId);
        return db.updateTaskChecklistItem({
          ...input,
          boardId: ctx.activeBoardId,
        });
      }),
    deleteTaskChecklistItem: teamMemberProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          taskId: z.number().int().positive(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.taskId);
        return db.deleteTaskChecklistItem({
          ...input,
          boardId: ctx.activeBoardId,
        });
      }),
    updateTaskStatus: teamMemberProcedure
      .input(z.object({ id: z.number().int(), status: taskStatus }))
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.id);
        const result = await db.updateTaskStatus(
          input.id,
          input.status,
          ctx.activeBoardId
        );
        if (input.status === "complete")
          await bestEffortNotification("clear completed task reminders", () =>
            notificationService.clearTaskReminderNotifications(
              input.id,
              ctx.activeBoardId
            )
          );
        return result;
      }),
    updateTaskSupport: teamMemberProcedure
      .input(
        z
          .object({
            id: z.number().int().positive(),
            needsSupport: z.boolean(),
            supportRequest: z.string().trim().max(2000).optional(),
          })
          .refine(
            input =>
              !input.needsSupport || Boolean(input.supportRequest?.trim()),
            {
              message: "اكتب نوع الدعم المطلوب",
              path: ["supportRequest"],
            }
          )
      )
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.id);
        const result = await db.updateTaskSupport({
          ...input,
          boardId: ctx.activeBoardId,
        });
        if (input.needsSupport)
          await bestEffortNotification("notify support request", () =>
            notificationService.notifySupportRequested(
              input.id,
              ctx.activeBoardId,
              ctx.user.id
            )
          );
        return result;
      }),
    addTaskComment: teamMemberProcedure
      .input(
        z.object({
          taskId: z.number().int(),
          body: z.string().trim().min(1).max(3000),
          replyToCommentId: z.number().int().positive().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireTaskAccess(ctx.user.id, ctx.activeBoardId, input.taskId);
        const result = await db.addTaskComment({
          ...input,
          authorUserId: ctx.user.id,
          boardId: ctx.activeBoardId,
        });
        await bestEffortNotification("notify task comment", () =>
          notificationService.notifyTaskComment(
            result.id,
            input.taskId,
            ctx.activeBoardId,
            ctx.user.id,
            input.body,
            input.replyToCommentId
          )
        );
        return result;
      }),
    updateTaskComment: boardProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          body: z.string().trim().min(1).max(3000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const canModerate =
          ctx.user.role === "admin" ||
          ctx.user.role === "manager" ||
          (await db.hasBoardRole(ctx.user.id, ["manager"], ctx.activeBoardId));
        const result = await db.updateTaskComment({
          ...input,
          boardId: ctx.activeBoardId,
          actingUserId: ctx.user.id,
          canModerate,
        });
        await bestEffortNotification(
          "notify edited task comment mentions",
          () =>
            notificationService.notifyTaskComment(
              input.id,
              result.taskId,
              ctx.activeBoardId,
              ctx.user.id,
              input.body,
              null,
              result.previousBody
            )
        );
        return { success: true as const };
      }),
    addDeliverableComment: teamMemberProcedure
      .input(
        z.object({
          deliverableId: z.number().int(),
          body: z.string().min(1).max(3000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireDeliverableAccess(
          ctx.user.id,
          ctx.activeBoardId,
          input.deliverableId
        );
        return db.addDeliverableComment({
          ...input,
          authorUserId: ctx.user.id,
          boardId: ctx.activeBoardId,
        });
      }),
    updateProjectStatus: teamMemberProcedure
      .input(z.object({ id: z.number().int(), status: projectStatus }))
      .mutation(async ({ input, ctx }) => {
        await requireProjectAccess(ctx.user.id, ctx.activeBoardId, input.id);
        return db.updateProjectStatus(
          input.id,
          input.status,
          ctx.activeBoardId
        );
      }),
    updateProject: teamMemberProcedure
      .input(
        z
          .object({
            id: z.number().int().positive(),
            title: z.string().trim().min(2).max(240),
            summary: z.string().max(1500).optional(),
            annualGoalId: z.number().int().nullable().optional(),
            ownerMemberId: z.number().int().positive(),
            responsibleMemberIds: z
              .array(z.number().int().positive())
              .min(1)
              .max(100)
              .refine(ids => new Set(ids).size === ids.length, {
                message: "لا يمكن تكرار المسؤول نفسه",
              }),
            startDate: z.date(),
            endDate: z.date().nullable().optional(),
            status: projectStatus,
          })
          .refine(input => !input.endDate || input.endDate >= input.startDate, {
            message: "تاريخ نهاية المشروع يجب أن يكون بعد تاريخ البداية",
            path: ["endDate"],
          })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProjectAccess(ctx.user.id, ctx.activeBoardId, input.id);
        return db.updateProject({ ...input, boardId: ctx.activeBoardId });
      }),
    deleteProject: teamMemberProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await requireProjectAccess(ctx.user.id, ctx.activeBoardId, input.id);
        return db.deleteProject(input.id, ctx.activeBoardId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
