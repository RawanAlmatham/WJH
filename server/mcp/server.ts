import type { NextFunction, Request, Response } from "express";
import {
  createMcpHandler,
  McpServer,
  type AuthInfo,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";
import type { User } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";
import {
  MCP_PROTECTED_RESOURCE_METADATA_URL,
  MCP_RESOURCE_URL,
} from "./oauthRoutes";
import {
  MCP_READ_SCOPE,
  MCP_WRITE_SCOPE,
  verifyOAuthAccessToken,
} from "./oauthStore";

type AuthenticatedMcpRequest = Request & { auth?: AuthInfo };

export const MCP_DEFAULT_AUTHORIZATION_SCOPES = [
  MCP_READ_SCOPE,
  MCP_WRITE_SCOPE,
].join(" ");

export const WIJHA_MCP_TOOL_NAMES = [
  "wijha_get_context",
  "wijha_select_lab",
  "wijha_get_lab_summary",
  "wijha_list_team",
  "wijha_list_problems",
  "wijha_create_problem",
  "wijha_update_problem",
  "wijha_list_ideas",
  "wijha_create_idea",
  "wijha_update_idea",
  "wijha_list_captures",
  "wijha_create_capture",
  "wijha_update_capture",
  "wijha_list_sources",
  "wijha_add_source",
  "wijha_analyze_source",
  "wijha_approve_source_analysis",
  "wijha_list_interviews",
  "wijha_create_interview",
  "wijha_update_interview",
  "wijha_list_experiments",
  "wijha_create_experiment",
  "wijha_update_experiment",
  "wijha_list_tasks",
  "wijha_create_task",
  "wijha_update_task",
  "wijha_list_subtasks",
  "wijha_create_subtask",
  "wijha_update_subtask",
  "wijha_delete_subtask",
  "wijha_delete_problem",
  "wijha_delete_idea",
  "wijha_delete_source",
  "wijha_delete_interview",
  "wijha_delete_experiment",
  "wijha_delete_task",
  "wijha_delete_capture",
] as const;

const readSecurity = [{ type: "oauth2", scopes: [MCP_READ_SCOPE] }];
const writeSecurity = [
  { type: "oauth2", scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] },
];
const problemStage = z.enum(["raw", "understanding", "validated"]);
const evidenceStrength = z.enum(["none", "low", "medium", "high"]);
const ideaStage = z.enum([
  "seed",
  "exploration",
  "interviews",
  "experiment",
  "promising",
  "archived",
]);
const confidence = z.enum(["low", "medium", "high"]);
const ideaDecision = z.enum([
  "undecided",
  "continue",
  "pivot",
  "test_more",
  "stop",
  "approved",
]);
const captureType = z.enum([
  "problem",
  "idea",
  "link",
  "note",
  "feedback",
  "statistic",
  "competitor",
]);
const captureStatus = z.enum(["inbox", "attached", "archived"]);
const interviewStatus = z.enum([
  "planned",
  "completed",
  "transcribed",
  "analyzed",
]);
const experimentStatus = z.enum(["planned", "running", "review", "complete"]);
const taskStatus = z.enum(["todo", "in_progress", "blocked", "done"]);
const taskPriority = z.enum(["low", "medium", "high", "urgent"]);
const sourceAiStatus = z.enum(["not_requested", "draft", "approved", "failed"]);
const dateInput = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/, "استخدم تاريخًا بصيغة YYYY-MM-DD");
const resultLimit = z.number().int().min(1).max(100).default(50);

export function shouldShowMcpBrowserInfo(
  method: string,
  acceptHeader = "",
  authorizationHeader = ""
) {
  return (
    method.toUpperCase() === "GET" &&
    acceptHeader.toLowerCase().includes("text/html") &&
    !authorizationHeader.trim()
  );
}

export function showMcpBrowserInfo(
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (
    !shouldShowMcpBrowserInfo(
      request.method,
      request.header("accept") ?? "",
      request.header("authorization") ?? ""
    )
  ) {
    next();
    return;
  }
  response.status(200).set({
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "X-Robots-Tag": "noindex, nofollow",
  }).send(`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>وجهة — MCP مختبر الأفكار</title>
    <style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f5f2ee;color:#1f2328;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}.card{width:min(780px,100%);margin:auto;background:#fff;border:1px solid #dfe3ec;border-radius:24px;padding:30px;box-shadow:0 20px 60px rgba(20,40,95,.1)}.brand{display:flex;align-items:center;gap:10px;color:#14285f;font-weight:900}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:#14285f;color:#f6b801;font-size:22px}h1{font-size:28px;margin:22px 0 10px}.lead{color:#62635f;line-height:1.9}.status{display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:7px 12px;border-radius:99px;background:#edf8f1;color:#24734b;font-size:13px;font-weight:800}.dot{width:8px;height:8px;border-radius:50%;background:#2ca56c}.endpoint{direction:ltr;text-align:left;overflow-wrap:anywhere;margin:22px 0;padding:14px;border:1px solid #d8deea;border-radius:12px;background:#f7f8fb;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.item{padding:16px;border:1px solid #e2e5eb;border-radius:14px}.item strong{display:block;color:#14285f;margin-bottom:5px}.item span{color:#62635f;font-size:13px;line-height:1.7}.note{margin-top:20px;padding:14px;border-radius:12px;background:#fff6d9;color:#6f5600;font-size:13px;line-height:1.8}@media(max-width:620px){body{padding:12px}.card{padding:22px}.grid{grid-template-columns:1fr}h1{font-size:24px}}
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand"><span class="mark">و</span><span>وجهة</span></div>
      <h1>MCP مختبر الأفكار</h1>
      <p class="lead">اربط وجهة بالمساعد الذكي ليقرأ مشكلات المختبر وأفكاره ومصادره ومقابلاته وتجاربِه ومهامه، ويضيف أو يحدّث السجلات ضمن صلاحيات حسابك.</p>
      <div class="status"><span class="dot"></span>الخادم جاهز للربط عبر OAuth</div>
      <div class="endpoint">${MCP_RESOURCE_URL}</div>
      <section class="grid" aria-label="قدرات MCP">
        <div class="item"><strong>استكشاف الفرص</strong><span>قراءة ملخص المختبر والبحث في المشكلات والأفكار.</span></div>
        <div class="item"><strong>جمع الأدلة</strong><span>إضافة الروابط والمقابلات وربطها بالمشكلة أو الفكرة.</span></div>
        <div class="item"><strong>التجارب والمهام</strong><span>إنشاء التجارب وتحديث نتائجها، وترتيب خطوات الفريق وإسنادها.</span></div>
        <div class="item"><strong>تحليل اختياري</strong><span>تحليل المصادر بمفتاح API الخاص بالعضو وبعد طلبه الصريح.</span></div>
      </section>
      <p class="note">أضف الرابط كخادم Remote MCP في ChatGPT أو Claude أو أي عميل متوافق، ثم سجّل الدخول بحساب Google المستخدم في وجهة ووافق على صلاحيات القراءة والتعديل.</p>
    </main>
  </body>
</html>`);
}

function asDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.valueOf())) throw new Error("التاريخ غير صالح");
  return parsed;
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function successResult(message: string, result: unknown): CallToolResult {
  const normalized = jsonValue(result);
  return {
    content: [
      {
        type: "text",
        text: `${message}\n${JSON.stringify(normalized, null, 2)}`,
      },
    ],
    structuredContent: { result: normalized },
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "تعذر تنفيذ الطلب في وجهة";
}

async function runTool(
  operation: () => Promise<{ message: string; result: unknown }>
): Promise<CallToolResult> {
  try {
    const output = await operation();
    return successResult(output.message, output.result);
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: errorMessage(error) }],
    };
  }
}

function requireWriteScope(authInfo: AuthInfo) {
  if (!authInfo.scopes.includes(MCP_WRITE_SCOPE))
    throw new Error("هذا الربط لا يملك صلاحية التعديل في وجهة");
}

function createCaller(user: User) {
  return appRouter.createCaller({
    user,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

function normalizedSearch(value?: string) {
  return value?.trim().toLocaleLowerCase("ar") ?? "";
}

function includesSearch(search: string, ...values: unknown[]) {
  return (
    !search ||
    values.some(value =>
      String(value ?? "")
        .toLocaleLowerCase("ar")
        .includes(search)
    )
  );
}

function countBy<T>(items: T[], value: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = value(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

async function createWijhaMcpServer(user: User, authInfo: AuthInfo) {
  const server = new McpServer(
    { name: "وجهة — مختبر الأفكار", version: "2.0.0" },
    {
      instructions:
        "هذه الأدوات تخص مختبر الأفكار في وجهة فقط. ابدأ بـ wijha_get_context لمعرفة المختبر الحالي. استخدم المعرفات التي تعيدها أدوات القوائم ولا تخمنها. لا تنفذ أي إضافة أو تعديل إلا بطلب المستخدم. لا تحذف أي سجل إلا بعد طلب صريح من المستخدم وتوضيح أثر الحذف له. لا تشغّل تحليل المصادر إلا بطلب صريح لأنه يستخدم مفتاح API الخاص بالعضو وتكلفته. مخرجات التحليل مسودات حتى يعتمدها المستخدم.",
    }
  );
  const caller = createCaller(user);

  server.registerTool(
    "wijha_get_context",
    {
      title: "عرض سياق حساب وجهة",
      description:
        "يعرض الحساب ومختبرات الأفكار المتاحة والمختبر الحالي ودور المستخدم. ابدأ به قبل أي عملية.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    () =>
      runTool(async () => {
        const boards = await caller.boards.mine();
        const labs = boards
          .filter(board => board.template === "idea_lab")
          .map(board => ({
            id: board.id,
            name: board.name,
            role: board.membershipRole,
            is_active: board.isActive,
          }));
        return {
          message: "سياق حساب وجهة:",
          result: {
            user: { id: user.id, name: user.name, email: user.email },
            labs,
          },
        };
      })
  );

  server.registerTool(
    "wijha_select_lab",
    {
      title: "اختيار مختبر أفكار",
      description:
        "يغيّر المختبر الحالي الذي تعمل عليه بقية أدوات وجهة. استخدم معرفًا من wijha_get_context.",
      inputSchema: { lab_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ lab_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const boards = await caller.boards.mine();
        const lab = boards.find(
          board => board.id === lab_id && board.template === "idea_lab"
        );
        if (!lab) throw new Error("مختبر الأفكار غير موجود أو غير متاح لحسابك");
        await caller.boards.select({ boardId: lab_id });
        return {
          message: "تم اختيار مختبر الأفكار.",
          result: { id: lab.id, name: lab.name, role: lab.membershipRole },
        };
      })
  );

  server.registerTool(
    "wijha_get_lab_summary",
    {
      title: "ملخص مختبر الأفكار",
      description:
        "يعرض أعداد المشكلات والأفكار والمصادر والمقابلات والتجارب والمهام وتوزيع المراحل في المختبر الحالي.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    () =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        return {
          message: `ملخص مختبر ${data.board.name}:`,
          result: {
            lab: { id: data.board.id, name: data.board.name },
            totals: {
              problems: data.problems.length,
              ideas: data.ideas.length,
              sources: data.sources.length,
              interviews: data.interviews.length,
              experiments: data.experiments.length,
              tasks: data.tasks.length,
              members: data.members.length,
            },
            problem_stages: countBy(data.problems, item => item.stage),
            idea_stages: countBy(data.ideas, item => item.stage),
            interview_statuses: countBy(data.interviews, item => item.status),
            experiment_statuses: countBy(data.experiments, item => item.status),
            task_statuses: countBy(data.tasks, item => item.status),
          },
        };
      })
  );

  server.registerTool(
    "wijha_list_team",
    {
      title: "عرض فريق المختبر",
      description:
        "يعرض أعضاء المختبر ومعرفات حساباتهم لاستخدامها عند إسناد مشكلة أو فكرة أو مهمة.",
      inputSchema: { search: z.string().trim().max(160).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    ({ search }) =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        const query = normalizedSearch(search);
        const members = data.members
          .filter(member =>
            includesSearch(query, member.name, member.email, member.role)
          )
          .map(member => ({
            member_id: member.id,
            user_id: member.userId,
            name: member.name,
            email: member.email,
            role: member.role,
          }));
        return {
          message: `أعضاء المختبر (${members.length}):`,
          result: members,
        };
      })
  );

  server.registerTool(
    "wijha_list_problems",
    {
      title: "عرض مشكلات المختبر",
      description: "يعرض المشكلات مع البحث والتصفية بحسب المرحلة وقوة الأدلة.",
      inputSchema: {
        search: z.string().trim().max(240).optional(),
        stage: problemStage.optional(),
        evidence_strength: evidenceStrength.optional(),
        limit: resultLimit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        const query = normalizedSearch(input.search);
        const rows = data.problems
          .filter(
            item =>
              includesSearch(
                query,
                item.title,
                item.description,
                item.category,
                item.audience
              ) &&
              (!input.stage || item.stage === input.stage) &&
              (!input.evidence_strength ||
                item.evidenceStrength === input.evidence_strength)
          )
          .slice(0, input.limit);
        return { message: `المشكلات (${rows.length}):`, result: rows };
      })
  );

  server.registerTool(
    "wijha_create_problem",
    {
      title: "إضافة مشكلة",
      description:
        "يضيف مشكلة أو ملاحظة خام إلى المختبر الحالي. يمكن إدخال المشكلة مباشرة دون وجود إشارة سابقة.",
      inputSchema: {
        title: z.string().trim().min(3).max(280),
        description: z.string().trim().max(20_000).optional(),
        category: z.string().trim().max(160).optional(),
        audience: z.string().trim().max(240).optional(),
        owner_user_id: z.number().int().positive().nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.createProblem({
          title: input.title,
          description: input.description,
          category: input.category,
          audience: input.audience,
          ownerUserId: input.owner_user_id,
        });
        return { message: "تمت إضافة المشكلة.", result };
      })
  );

  server.registerTool(
    "wijha_update_problem",
    {
      title: "تحديث مشكلة",
      description:
        "يحدّث الحقول المحددة في مشكلة موجودة ويُبقي بقية بياناتها كما هي.",
      inputSchema: {
        problem_id: z.number().int().positive(),
        title: z.string().trim().min(3).max(280).optional(),
        description: z.string().trim().max(20_000).nullable().optional(),
        category: z.string().trim().max(160).nullable().optional(),
        audience: z.string().trim().max(240).nullable().optional(),
        owner_user_id: z.number().int().positive().nullable().optional(),
        stage: problemStage.optional(),
        evidence_strength: evidenceStrength.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.updateProblem({
          id: input.problem_id,
          title: input.title,
          description: input.description,
          category: input.category,
          audience: input.audience,
          ownerUserId: input.owner_user_id,
          stage: input.stage,
          evidenceStrength: input.evidence_strength,
        });
        return { message: "تم تحديث المشكلة.", result };
      })
  );

  server.registerTool(
    "wijha_list_ideas",
    {
      title: "عرض أفكار المختبر",
      description:
        "يعرض الأفكار مع البحث والتصفية بحسب المشكلة والمرحلة ومستوى الثقة.",
      inputSchema: {
        search: z.string().trim().max(240).optional(),
        problem_id: z.number().int().positive().optional(),
        stage: ideaStage.optional(),
        confidence: confidence.optional(),
        limit: resultLimit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        const query = normalizedSearch(input.search);
        const rows = data.ideas
          .filter(
            item =>
              includesSearch(
                query,
                item.title,
                item.description,
                item.category,
                item.audience
              ) &&
              (!input.problem_id || item.problemId === input.problem_id) &&
              (!input.stage || item.stage === input.stage) &&
              (!input.confidence || item.confidence === input.confidence)
          )
          .slice(0, input.limit);
        return { message: `الأفكار (${rows.length}):`, result: rows };
      })
  );

  server.registerTool(
    "wijha_create_idea",
    {
      title: "إضافة فكرة",
      description:
        "يضيف فكرة جديدة، ويمكن ربطها بمشكلة موجودة باستخدام معرف المشكلة.",
      inputSchema: {
        problem_id: z.number().int().positive().nullable().optional(),
        title: z.string().trim().min(3).max(280),
        description: z.string().trim().max(20_000).optional(),
        category: z.string().trim().max(160).optional(),
        audience: z.string().trim().max(240).optional(),
        owner_user_id: z.number().int().positive().nullable().optional(),
        value_proposition: z.string().trim().max(20_000).optional(),
        proposed_solution: z.string().trim().max(20_000).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.createIdea({
          problemId: input.problem_id,
          title: input.title,
          description: input.description,
          category: input.category,
          audience: input.audience,
          ownerUserId: input.owner_user_id,
          valueProposition: input.value_proposition,
          proposedSolution: input.proposed_solution,
        });
        return { message: "تمت إضافة الفكرة.", result };
      })
  );

  server.registerTool(
    "wijha_update_idea",
    {
      title: "تحديث فكرة",
      description:
        "يحدّث الفكرة أو ينقلها بين مراحل الاستكشاف مع الإبقاء على الحقول غير المحددة.",
      inputSchema: {
        idea_id: z.number().int().positive(),
        problem_id: z.number().int().positive().nullable().optional(),
        title: z.string().trim().min(3).max(280).optional(),
        description: z.string().trim().max(20_000).nullable().optional(),
        category: z.string().trim().max(160).nullable().optional(),
        audience: z.string().trim().max(240).nullable().optional(),
        owner_user_id: z.number().int().positive().nullable().optional(),
        stage: ideaStage.optional(),
        confidence: confidence.optional(),
        value_proposition: z.string().trim().max(20_000).nullable().optional(),
        proposed_solution: z.string().trim().max(20_000).nullable().optional(),
        differentiator: z.string().trim().max(20_000).nullable().optional(),
        mvp_scope: z.string().trim().max(20_000).nullable().optional(),
        assumptions: z
          .array(z.string().trim().min(1).max(500))
          .max(100)
          .optional(),
        decision: ideaDecision.optional(),
        decision_rationale: z.string().trim().max(20_000).nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.updateIdea({
          id: input.idea_id,
          problemId: input.problem_id,
          title: input.title,
          description: input.description,
          category: input.category,
          audience: input.audience,
          ownerUserId: input.owner_user_id,
          stage: input.stage,
          confidence: input.confidence,
          valueProposition: input.value_proposition,
          proposedSolution: input.proposed_solution,
          differentiator: input.differentiator,
          mvpScope: input.mvp_scope,
          assumptions: input.assumptions,
          decision: input.decision,
          decisionRationale: input.decision_rationale,
        });
        return { message: "تم تحديث الفكرة.", result };
      })
  );

  server.registerTool(
    "wijha_list_captures",
    {
      title: "عرض صندوق الالتقاط",
      description:
        "يعرض الملاحظات والروابط والمشكلات الأولية الملتقطة، سواء كانت في الصندوق أو مرتبطة بفكرة.",
      inputSchema: {
        idea_id: z.number().int().positive().optional(),
        type: captureType.optional(),
        status: captureStatus.optional(),
        limit: resultLimit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        const rows = data.captures
          .filter(
            item =>
              (!input.idea_id || item.ideaId === input.idea_id) &&
              (!input.type || item.captureType === input.type) &&
              (!input.status || item.status === input.status)
          )
          .slice(0, input.limit);
        return { message: `عناصر الالتقاط (${rows.length}):`, result: rows };
      })
  );

  server.registerTool(
    "wijha_create_capture",
    {
      title: "التقاط معلومة",
      description:
        "يحفظ مشكلة أو فكرة أولية أو رابطًا أو ملاحظة بسرعة، ويمكن ربطها مباشرة بفكرة.",
      inputSchema: {
        idea_id: z.number().int().positive().nullable().optional(),
        type: captureType.optional(),
        title: z.string().trim().min(2).max(500),
        content: z.string().trim().max(50_000).optional(),
        url: z.string().trim().url().max(2048).nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.createCapture({
          ideaId: input.idea_id,
          captureType: input.type,
          title: input.title,
          content: input.content,
          url: input.url,
        });
        return { message: "تم حفظ العنصر.", result };
      })
  );

  server.registerTool(
    "wijha_update_capture",
    {
      title: "تحديث أو ربط عنصر ملتقط",
      description:
        "يحدّث عنصرًا في صندوق الالتقاط أو يربطه بمساحة فكرة موجودة.",
      inputSchema: {
        capture_id: z.number().int().positive(),
        idea_id: z.number().int().positive().nullable().optional(),
        type: captureType.optional(),
        title: z.string().trim().min(2).max(500).optional(),
        content: z.string().trim().max(50_000).nullable().optional(),
        url: z.string().trim().url().max(2048).nullable().optional(),
        status: captureStatus.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.updateCapture({
          id: input.capture_id,
          ideaId: input.idea_id,
          captureType: input.type,
          title: input.title,
          content: input.content,
          url: input.url,
          status: input.status,
        });
        return { message: "تم تحديث العنصر.", result };
      })
  );

  server.registerTool(
    "wijha_list_sources",
    {
      title: "عرض المصادر الداعمة",
      description:
        "يعرض الروابط والمصادر المرتبطة بالمشكلات أو الأفكار وحالة ملخص الذكاء الاصطناعي.",
      inputSchema: {
        problem_id: z.number().int().positive().optional(),
        idea_id: z.number().int().positive().optional(),
        ai_status: sourceAiStatus.optional(),
        include_content: z.boolean().default(false),
        limit: resultLimit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        const rows = data.sources
          .filter(
            item =>
              (!input.problem_id || item.problemId === input.problem_id) &&
              (!input.idea_id || item.ideaId === input.idea_id) &&
              (!input.ai_status || item.aiStatus === input.ai_status)
          )
          .slice(0, input.limit)
          .map(item => ({
            id: item.id,
            problemId: item.problemId,
            ideaId: item.ideaId,
            url: item.url,
            sourceType: item.sourceType,
            title: item.title,
            publisher: item.publisher,
            notes: input.include_content ? item.notes : undefined,
            extractedText: input.include_content
              ? item.extractedText
              : undefined,
            aiSummary: item.aiSummary,
            aiStatus: item.aiStatus,
            createdAt: item.createdAt,
          }));
        return { message: `المصادر (${rows.length}):`, result: rows };
      })
  );

  server.registerTool(
    "wijha_add_source",
    {
      title: "إضافة مصدر داعم",
      description:
        "يضيف رابطًا داعمًا مثل موقع أو TikTok أو YouTube ويربطه بمشكلة أو فكرة. يجب تحديد أحدهما على الأقل.",
      inputSchema: {
        problem_id: z.number().int().positive().nullable().optional(),
        idea_id: z.number().int().positive().nullable().optional(),
        url: z.string().trim().url().max(2048),
        source_type: z.string().trim().min(1).max(32).default("website"),
        title: z.string().trim().max(500).optional(),
        publisher: z.string().trim().max(240).optional(),
        notes: z.string().trim().max(50_000).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.createSource({
          problemId: input.problem_id,
          ideaId: input.idea_id,
          url: input.url,
          sourceType: input.source_type,
          title: input.title,
          publisher: input.publisher,
          notes: input.notes,
        });
        return { message: "تمت إضافة المصدر الداعم.", result };
      })
  );

  server.registerTool(
    "wijha_analyze_source",
    {
      title: "تحليل مصدر بمفتاح العضو",
      description:
        "يجلب المصدر عند الإمكان ويلخصه باستخدام مفتاح OpenAI المحفوظ في حساب العضو. شغّله فقط بعد طلب صريح لأن التكلفة تقع على العضو، والنتيجة تُحفظ كمسودة.",
      inputSchema: { source_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ source_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.analyzeSource({
          sourceId: source_id,
        });
        return {
          message: "اكتمل التحليل وحُفظ الملخص كمسودة للمراجعة.",
          result,
        };
      })
  );

  server.registerTool(
    "wijha_approve_source_analysis",
    {
      title: "اعتماد ملخص مصدر",
      description: "يعتمد مسودة ملخص المصدر بعد أن يراجعها المستخدم أو الفريق.",
      inputSchema: { source_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ source_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.approveSourceAnalysis({
          sourceId: source_id,
        });
        return { message: "تم اعتماد ملخص المصدر.", result };
      })
  );

  server.registerTool(
    "wijha_list_interviews",
    {
      title: "عرض مقابلات العملاء",
      description:
        "يعرض المقابلات المرتبطة بالمشكلات أو الأفكار. يمكن تضمين النص الكامل عند الحاجة.",
      inputSchema: {
        problem_id: z.number().int().positive().optional(),
        idea_id: z.number().int().positive().optional(),
        status: interviewStatus.optional(),
        include_transcript: z.boolean().default(false),
        limit: resultLimit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        const rows = data.interviews
          .filter(
            item =>
              (!input.problem_id || item.problemId === input.problem_id) &&
              (!input.idea_id || item.ideaId === input.idea_id) &&
              (!input.status || item.status === input.status)
          )
          .slice(0, input.limit)
          .map(item => ({
            ...item,
            transcript: input.include_transcript ? item.transcript : undefined,
          }));
        return { message: `المقابلات (${rows.length}):`, result: rows };
      })
  );

  server.registerTool(
    "wijha_create_interview",
    {
      title: "إضافة مقابلة",
      description:
        "يسجل مقابلة مخططة أو منجزة ويربطها بمشكلة أو فكرة، مع نص التفريغ والملخص والاستنتاجات عند توفرها.",
      inputSchema: {
        problem_id: z.number().int().positive().nullable().optional(),
        idea_id: z.number().int().positive().nullable().optional(),
        participant_label: z.string().trim().min(2).max(180),
        interview_date: dateInput.nullable().optional(),
        transcript: z.string().max(100_000).optional(),
        summary: z.string().max(20_000).optional(),
        insights: z.string().max(20_000).optional(),
        themes: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.createInterview({
          problemId: input.problem_id,
          ideaId: input.idea_id,
          participantLabel: input.participant_label,
          interviewDate: asDate(input.interview_date),
          transcript: input.transcript,
          summary: input.summary,
          insights: input.insights,
          themes: input.themes,
        });
        return { message: "تمت إضافة المقابلة.", result };
      })
  );

  server.registerTool(
    "wijha_update_interview",
    {
      title: "تحديث مقابلة",
      description:
        "يحدّث حالة المقابلة أو تفريغها أو ملخصها أو استنتاجاتها وموضوعاتها.",
      inputSchema: {
        interview_id: z.number().int().positive(),
        problem_id: z.number().int().positive().nullable().optional(),
        idea_id: z.number().int().positive().nullable().optional(),
        participant_label: z.string().trim().min(2).max(180).optional(),
        interview_date: dateInput.nullable().optional(),
        status: interviewStatus.optional(),
        transcript: z.string().max(100_000).nullable().optional(),
        summary: z.string().max(20_000).nullable().optional(),
        insights: z.string().max(20_000).nullable().optional(),
        themes: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.updateInterview({
          id: input.interview_id,
          problemId: input.problem_id,
          ideaId: input.idea_id,
          participantLabel: input.participant_label,
          interviewDate:
            input.interview_date === undefined
              ? undefined
              : asDate(input.interview_date),
          status: input.status,
          transcript: input.transcript,
          summary: input.summary,
          insights: input.insights,
          themes: input.themes,
        });
        return { message: "تم تحديث المقابلة.", result };
      })
  );

  server.registerTool(
    "wijha_list_experiments",
    {
      title: "عرض التجارب",
      description:
        "يعرض تجارب التحقق المرتبطة بالأفكار مع التصفية بحسب الفكرة أو الحالة.",
      inputSchema: {
        idea_id: z.number().int().positive().optional(),
        status: experimentStatus.optional(),
        limit: resultLimit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        const rows = data.experiments
          .filter(
            item =>
              (!input.idea_id || item.ideaId === input.idea_id) &&
              (!input.status || item.status === input.status)
          )
          .slice(0, input.limit);
        return { message: `التجارب (${rows.length}):`, result: rows };
      })
  );

  server.registerTool(
    "wijha_create_experiment",
    {
      title: "إنشاء تجربة",
      description: "ينشئ تجربة صغيرة لاختبار افتراض مرتبط بفكرة موجودة.",
      inputSchema: {
        idea_id: z.number().int().positive(),
        title: z.string().trim().min(3).max(280),
        hypothesis: z.string().trim().min(3).max(20_000),
        success_metric: z.string().trim().max(280).optional(),
        target_value: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.createExperiment({
          ideaId: input.idea_id,
          title: input.title,
          hypothesis: input.hypothesis,
          successMetric: input.success_metric,
          targetValue: input.target_value,
        });
        return { message: "تم إنشاء التجربة.", result };
      })
  );

  server.registerTool(
    "wijha_update_experiment",
    {
      title: "تحديث تجربة",
      description:
        "يحدّث فرضية التجربة أو مقياسها أو تقدمها أو حالتها أو نتيجتها.",
      inputSchema: {
        experiment_id: z.number().int().positive(),
        title: z.string().trim().min(3).max(280).optional(),
        hypothesis: z.string().trim().min(3).max(20_000).optional(),
        success_metric: z.string().trim().max(280).nullable().optional(),
        target_value: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
        current_value: z.number().int().min(0).max(1_000_000_000).optional(),
        status: experimentStatus.optional(),
        result: z.string().trim().max(20_000).nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.updateExperiment({
          id: input.experiment_id,
          title: input.title,
          hypothesis: input.hypothesis,
          successMetric: input.success_metric,
          targetValue: input.target_value,
          currentValue: input.current_value,
          status: input.status,
          result: input.result,
        });
        return { message: "تم تحديث التجربة.", result };
      })
  );

  server.registerTool(
    "wijha_list_tasks",
    {
      title: "عرض مهام المختبر",
      description:
        "يعرض مهام مختبر الأفكار مع التصفية بحسب الحالة أو الأولوية أو العضو المسند إليه أو السجل المرتبط.",
      inputSchema: {
        search: z.string().trim().max(200).optional(),
        status: taskStatus.optional(),
        priority: taskPriority.optional(),
        assignee_user_id: z.number().int().positive().optional(),
        problem_id: z.number().int().positive().optional(),
        idea_id: z.number().int().positive().optional(),
        interview_id: z.number().int().positive().optional(),
        experiment_id: z.number().int().positive().optional(),
        limit: resultLimit,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        const search = normalizedSearch(input.search);
        const rows = data.tasks
          .filter(
            item =>
              includesSearch(search, item.title, item.description) &&
              (!input.status || item.status === input.status) &&
              (!input.priority || item.priority === input.priority) &&
              (!input.assignee_user_id ||
                item.assigneeUserId === input.assignee_user_id) &&
              (!input.problem_id || item.problemId === input.problem_id) &&
              (!input.idea_id || item.ideaId === input.idea_id) &&
              (!input.interview_id ||
                item.interviewId === input.interview_id) &&
              (!input.experiment_id ||
                item.experimentId === input.experiment_id)
          )
          .slice(0, input.limit)
          .map(item => ({
            ...item,
            subtasks: data.subtasks.filter(
              subtask => subtask.taskId === item.id
            ),
          }));
        return { message: `المهام (${rows.length}):`, result: rows };
      })
  );

  server.registerTool(
    "wijha_create_task",
    {
      title: "إضافة مهمة",
      description:
        "ينشئ مهمة في المختبر، ويمكن ربطها بسجل واحد: مشكلة أو فكرة أو مقابلة أو تجربة.",
      inputSchema: {
        title: z.string().trim().min(3).max(280),
        description: z.string().trim().max(20_000).optional(),
        status: taskStatus.default("todo"),
        priority: taskPriority.default("medium"),
        due_date: dateInput.nullable().optional(),
        assignee_user_id: z.number().int().positive().nullable().optional(),
        problem_id: z.number().int().positive().nullable().optional(),
        idea_id: z.number().int().positive().nullable().optional(),
        interview_id: z.number().int().positive().nullable().optional(),
        experiment_id: z.number().int().positive().nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.createTask({
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          dueDate: asDate(input.due_date),
          assigneeUserId: input.assignee_user_id,
          problemId: input.problem_id,
          ideaId: input.idea_id,
          interviewId: input.interview_id,
          experimentId: input.experiment_id,
        });
        return { message: "تمت إضافة المهمة.", result };
      })
  );

  server.registerTool(
    "wijha_update_task",
    {
      title: "تحديث مهمة",
      description:
        "يحدّث تفاصيل المهمة أو حالتها أو أولويتها أو موعدها أو إسنادها أو السجل المرتبط بها.",
      inputSchema: {
        task_id: z.number().int().positive(),
        title: z.string().trim().min(3).max(280).optional(),
        description: z.string().trim().max(20_000).nullable().optional(),
        status: taskStatus.optional(),
        priority: taskPriority.optional(),
        due_date: dateInput.nullable().optional(),
        assignee_user_id: z.number().int().positive().nullable().optional(),
        problem_id: z.number().int().positive().nullable().optional(),
        idea_id: z.number().int().positive().nullable().optional(),
        interview_id: z.number().int().positive().nullable().optional(),
        experiment_id: z.number().int().positive().nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.updateTask({
          id: input.task_id,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          dueDate:
            input.due_date === undefined ? undefined : asDate(input.due_date),
          assigneeUserId: input.assignee_user_id,
          problemId: input.problem_id,
          ideaId: input.idea_id,
          interviewId: input.interview_id,
          experimentId: input.experiment_id,
        });
        return { message: "تم تحديث المهمة.", result };
      })
  );

  server.registerTool(
    "wijha_list_subtasks",
    {
      title: "عرض المهام الفرعية",
      description:
        "يعرض خطوات مهمة في المختبر الحالي مع تفاصيلها ومسؤوليها وحالاتها.",
      inputSchema: { task_id: z.number().int().positive() },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.ideaLab.overview();
        return {
          result: data.subtasks.filter(item => item.taskId === input.task_id),
          message: "المهام الفرعية",
        };
      })
  );
  server.registerTool(
    "wijha_create_subtask",
    {
      title: "إضافة مهمة فرعية",
      description: "يضيف خطوة لمهمة موجودة مع تفاصيل ومسؤول وموعد اختياريين.",
      inputSchema: {
        task_id: z.number().int().positive(),
        title: z.string().trim().min(1).max(280),
        description: z.string().max(20000).optional(),
        status: taskStatus.optional(),
        assignee_user_id: z.number().int().positive().nullable().optional(),
        due_date: dateInput.nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        return {
          result: await caller.ideaLab.createSubtask({
            taskId: input.task_id,
            title: input.title,
            description: input.description,
            status: input.status,
            assigneeUserId: input.assignee_user_id,
            dueDate:
              input.due_date === undefined ? undefined : asDate(input.due_date),
          }),
          message: "تمت إضافة المهمة الفرعية",
        };
      })
  );
  server.registerTool(
    "wijha_update_subtask",
    {
      title: "تحديث مهمة فرعية",
      description: "يحدّث تفاصيل خطوة وحالتها ومسؤولها وموعدها.",
      inputSchema: {
        subtask_id: z.number().int().positive(),
        title: z.string().trim().min(1).max(280).optional(),
        description: z.string().max(20000).nullable().optional(),
        status: taskStatus.optional(),
        assignee_user_id: z.number().int().positive().nullable().optional(),
        due_date: dateInput.nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        return {
          result: await caller.ideaLab.updateSubtask({
            id: input.subtask_id,
            title: input.title,
            description: input.description,
            status: input.status,
            assigneeUserId: input.assignee_user_id,
            dueDate:
              input.due_date === undefined ? undefined : asDate(input.due_date),
          }),
          message: "تم تحديث المهمة الفرعية",
        };
      })
  );
  server.registerTool(
    "wijha_delete_subtask",
    {
      title: "حذف مهمة فرعية",
      description: "يحذف خطوة نهائيًا بعد طلب صريح.",
      inputSchema: { subtask_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        return {
          result: await caller.ideaLab.deleteSubtask({ id: input.subtask_id }),
          message: "تم حذف المهمة الفرعية",
        };
      })
  );
  server.registerTool(
    "wijha_delete_problem",
    {
      title: "حذف مشكلة",
      description:
        "يحذف مشكلة نهائيًا. تُحذف مصادرها، وتبقى الأفكار والمقابلات والمهام من دون ارتباط بها. استخدمه فقط بعد طلب صريح.",
      inputSchema: { problem_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ problem_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.deleteProblem({ id: problem_id });
        return { message: "تم حذف المشكلة.", result };
      })
  );

  server.registerTool(
    "wijha_delete_idea",
    {
      title: "حذف فكرة",
      description:
        "يحذف فكرة نهائيًا مع مصادرها وتجاربها. تبقى المقابلات والمهام من دون ارتباط بها. استخدمه فقط بعد طلب صريح.",
      inputSchema: { idea_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ idea_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.deleteIdea({ id: idea_id });
        return { message: "تم حذف الفكرة.", result };
      })
  );

  server.registerTool(
    "wijha_delete_source",
    {
      title: "حذف مصدر",
      description: "يحذف رابطًا داعمًا وملخصه نهائيًا بعد طلب صريح.",
      inputSchema: { source_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ source_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.deleteSource({ id: source_id });
        return { message: "تم حذف المصدر.", result };
      })
  );

  server.registerTool(
    "wijha_delete_interview",
    {
      title: "حذف مقابلة",
      description:
        "يحذف المقابلة وتفريغها وملخصها نهائيًا. تبقى المهام من دون ارتباط بها. استخدمه فقط بعد طلب صريح.",
      inputSchema: { interview_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ interview_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.deleteInterview({
          id: interview_id,
        });
        return { message: "تم حذف المقابلة.", result };
      })
  );

  server.registerTool(
    "wijha_delete_experiment",
    {
      title: "حذف تجربة",
      description:
        "يحذف التجربة ونتائجها نهائيًا. تبقى المهام من دون ارتباط بها. استخدمه فقط بعد طلب صريح.",
      inputSchema: { experiment_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ experiment_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.deleteExperiment({
          id: experiment_id,
        });
        return { message: "تم حذف التجربة.", result };
      })
  );

  server.registerTool(
    "wijha_delete_task",
    {
      title: "حذف مهمة",
      description: "يحذف المهمة وخطواتها الفرعية نهائيًا بعد طلب صريح.",
      inputSchema: { task_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ task_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.deleteTask({ id: task_id });
        return { message: "تم حذف المهمة.", result };
      })
  );

  server.registerTool(
    "wijha_delete_capture",
    {
      title: "حذف عنصر ملتقط",
      description: "يحذف عنصرًا من صندوق الالتقاط نهائيًا بعد طلب صريح.",
      inputSchema: { capture_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ capture_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.ideaLab.deleteCapture({ id: capture_id });
        return { message: "تم حذف العنصر.", result };
      })
  );

  return server;
}

function challenge(response: Response, status: 401 | 403, error: string) {
  response
    .status(status)
    .set({
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "WWW-Authenticate",
      "WWW-Authenticate": `Bearer resource_metadata="${MCP_PROTECTED_RESOURCE_METADATA_URL}", scope="${MCP_DEFAULT_AUTHORIZATION_SCOPES}"`,
    })
    .json({ error });
}

export async function authenticateMcpRequest(
  request: AuthenticatedMcpRequest,
  response: Response,
  next: NextFunction
) {
  if (request.method === "OPTIONS") {
    response
      .status(204)
      .set({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      })
      .end();
    return;
  }
  const authorization = request.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return challenge(response, 401, "invalid_token");
  try {
    const token = await verifyOAuthAccessToken(match[1]);
    if (!token || token.resource !== MCP_RESOURCE_URL)
      return challenge(response, 401, "invalid_token");
    if (!token.scopes.includes(MCP_READ_SCOPE))
      return challenge(response, 403, "insufficient_scope");
    const user = await db.getUserById(token.userId);
    if (!user) return challenge(response, 401, "invalid_token");
    request.auth = {
      token: match[1],
      clientId: token.clientId,
      scopes: token.scopes,
      expiresAt: Math.floor(token.expiresAt.getTime() / 1000),
      resource: new URL(token.resource),
      extra: { userId: user.id },
    };
    response.set("Access-Control-Allow-Origin", "*");
    next();
  } catch (error) {
    console.warn("[MCP] Access token verification failed:", error);
    return challenge(response, 401, "invalid_token");
  }
}

const mcpHandler = createMcpHandler(
  async ({ authInfo }) => {
    const userId = Number(authInfo?.extra?.userId);
    if (!authInfo || !Number.isInteger(userId) || userId <= 0)
      throw new Error("يلزم تسجيل الدخول إلى وجهة");
    const user = await db.getUserById(userId);
    if (!user) throw new Error("حساب وجهة غير موجود");
    return createWijhaMcpServer(user, authInfo);
  },
  {
    responseMode: "json",
    onerror: error => console.warn("[MCP] Request failed:", error),
  }
);

const nodeMcpHandler = toNodeHandler(mcpHandler, {
  onerror: error => console.warn("[MCP] Adapter failed:", error),
});

export function handleMcpRequest(
  request: AuthenticatedMcpRequest,
  response: Response
) {
  return nodeMcpHandler(request, response, request.body);
}
