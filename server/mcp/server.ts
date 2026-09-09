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
    <title>أثر — ربط المساعدات الذكية</title>
    <style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f5f8fc;color:#26364a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:32px 20px}.card{width:min(920px,100%);margin:auto;background:#fff;border:1px solid #dfe8f2;border-radius:20px;padding:30px;box-shadow:0 16px 50px rgba(38,54,74,.09)}.brand{color:#52769f;font-weight:800}h1{font-size:28px;margin:10px 0}.status{display:inline-flex;align-items:center;gap:8px;margin:8px 0 18px;padding:7px 12px;border-radius:999px;background:#edf9f2;color:#24734b;font-weight:700;font-size:14px}.dot{width:9px;height:9px;border-radius:50%;background:#2ca56c}.muted{color:#687b90;line-height:1.8}.endpoint{display:flex;gap:10px;align-items:stretch;margin:18px 0 24px}.url{direction:ltr;text-align:left;overflow-wrap:anywhere;flex:1;background:#f6f8fb;border:1px solid #e3eaf2;border-radius:10px;padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}.copy{border:0;border-radius:10px;background:#52769f;color:#fff;padding:0 17px;font:inherit;font-weight:700;cursor:pointer}.platforms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.platform{display:flex;flex-direction:column;align-items:flex-start;border:1px solid #dfe8f2;border-radius:14px;padding:18px}.platform h2{font-size:19px;margin:0 0 6px}.platform p{margin:0;color:#687b90;line-height:1.7;font-size:14px}.platform ol{margin:12px 0 0;padding-right:20px;color:#52657a;font-size:13px;line-height:1.8}.platform pre{direction:ltr;text-align:left;width:100%;overflow:auto;margin:12px 0 0;padding:10px;border-radius:8px;background:#172033;color:#eef4fa;font-size:11px;line-height:1.6}.action{display:inline-flex;margin-top:auto;padding-top:16px;color:#3e678f;text-decoration:none;font-weight:800}.generic{grid-column:1/-1;background:#f8fafc}.notice{margin:0 0 18px;padding:11px 13px;border:1px solid #f0d48a;border-radius:10px;background:#fff9e8;color:#7a5810;font-size:13px;line-height:1.7}.note{margin:22px 0 0;padding-top:18px;border-top:1px solid #e5ebf2;color:#687b90;font-size:13px;line-height:1.7}@media(max-width:620px){body{padding:16px 12px}.card{padding:22px;border-radius:16px}h1{font-size:24px}.endpoint{flex-direction:column}.copy{min-height:44px}.platforms{grid-template-columns:1fr}.generic{grid-column:auto}}
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand">أثر</div>
      <h1>ربط أثر بالمساعدات الذكية</h1>
      <div class="status"><span class="dot"></span>خادم MCP متصل ويستجيب</div>
      <p class="muted">هذا رابط موحّد يعمل مع Claude وChatGPT وGemini CLI وManus وLovable وKimi Code وأي عميل يدعم Remote MCP وOAuth. أضفه داخل إعدادات الموصلات في المنصة التي تستخدمها، ثم سجّل الدخول إلى أثر لمنح الصلاحيات.</p>
      <div class="endpoint">
        <div class="url" id="mcp-url">${MCP_RESOURCE_URL}</div>
        <button class="copy" id="copy-url" type="button">نسخ الرابط</button>
      </div>
      <p class="notice"><strong>تنبيه:</strong> في Gemini استخدم Gemini CLI أو Antigravity، وفي Kimi استخدم Kimi Code. صفحات المحادثة العادية قد لا تعرض خيار إضافة خادم MCP مخصص.</p>
      <section class="platforms" aria-label="خيارات الربط">
        <article class="platform">
          <h2>Claude</h2>
          <p>من Settings ← Connectors اختر Add custom connector، ثم أضف الاسم «أثر» والصق رابط MCP أعلاه.</p>
          <ol><li>افتح Settings ثم Connectors.</li><li>اختر Add custom connector واكتب «أثر».</li><li>الصق الرابط وأكمل تسجيل الدخول والموافقة.</li></ol>
          <a class="action" href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer">فتح موصلات Claude ←</a>
        </article>
        <article class="platform">
          <h2>ChatGPT</h2>
          <p>من صفحة الإضافات أنشئ تطبيقًا مخصصًا باسم «أثر»، واختر OAuth ثم الصق رابط MCP أعلاه.</p>
          <ol><li>افتح إعدادات التطبيقات والموصلات.</li><li>أنشئ تطبيقًا مخصصًا باسم «أثر».</li><li>أضف الرابط واختر OAuth ثم أكمل الموافقة.</li></ol>
          <a class="action" href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">فتح إضافات ChatGPT ←</a>
        </article>
        <article class="platform">
          <h2>Gemini</h2>
          <p>استخدم Gemini CLI أو Antigravity الداعم لـRemote MCP.</p>
          <ol><li>افتح ~/.gemini/settings.json.</li><li>أضف الإعداد التالي وأعد تشغيل Gemini CLI.</li><li>نفّذ /mcp auth athr وأكمل الموافقة.</li></ol>
          <pre>{"mcpServers":{"athr":{"httpUrl":"${MCP_RESOURCE_URL}"}}}</pre>
          <a class="action" href="https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md" target="_blank" rel="noreferrer">فتح دليل Gemini MCP ←</a>
        </article>
        <article class="platform">
          <h2>Manus</h2>
          <p>من Settings ← Connectors اضغط + Connect، ثم أنشئ Custom MCP connector باسم «أثر» والصق الرابط وأكمل الموافقة.</p>
          <a class="action" href="https://manus.im/docs/integrations/mcp-connectors" target="_blank" rel="noreferrer">فتح دليل Manus ←</a>
        </article>
        <article class="platform">
          <h2>Lovable</h2>
          <p>من Connectors ← Personal connectors اختر Add custom MCP server، ثم أضف الاسم «أثر» والصق الرابط وأكمل الموافقة.</p>
          <a class="action" href="https://docs.lovable.dev/integrations/lovable-mcp-server" target="_blank" rel="noreferrer">فتح دليل Lovable MCP ←</a>
        </article>
        <article class="platform">
          <h2>Kimi</h2>
          <p>استخدم Kimi Code CLI الذي يدعم خوادم MCP البعيدة وOAuth.</p>
          <ol><li>افتح ~/.kimi-code/mcp.json.</li><li>أضف الإعداد التالي وابدأ جلسة جديدة.</li><li>نفّذ /mcp-config login athr وأكمل الموافقة.</li></ol>
          <pre>{"mcpServers":{"athr":{"url":"${MCP_RESOURCE_URL}"}}}</pre>
          <a class="action" href="https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html" target="_blank" rel="noreferrer">فتح دليل Kimi MCP ←</a>
        </article>
        <article class="platform generic">
          <h2>أي عميل MCP متوافق</h2>
          <p>استخدم الرابط نفسه كعنوان خادم Streamable HTTP. سيكتشف العميل إعدادات OAuth تلقائيًا، وتبقى العمليات المتاحة محدودة بصلاحيات حسابك في أثر.</p>
        </article>
      </section>
      <p class="note">فتح الرابط مباشرة في المتصفح يعرض هذه التعليمات فقط؛ يبدأ تسجيل الدخول والربط من داخل المساعد أو عميل MCP الذي تختاره.</p>
    </main>
    <script>
      document.getElementById("copy-url").addEventListener("click",async function(){
        await navigator.clipboard.writeText(document.getElementById("mcp-url").textContent.trim());
        this.textContent="تم النسخ";
        setTimeout(()=>{this.textContent="نسخ الرابط"},1600);
      });
    </script>
  </body>
</html>`);
}

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
const lessonCategory = z.enum(["success", "challenge", "improvement", "risk"]);
const goalStatus = z.enum(["on_track", "attention", "at_risk", "complete"]);
const eventType = z.enum([
  "meeting",
  "delivery",
  "launch",
  "workshop",
  "review",
]);
const dateInput = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/, "استخدم تاريخًا بصيغة YYYY-MM-DD");

const readSecurity = [{ type: "oauth2", scopes: [MCP_READ_SCOPE] }];
const writeSecurity = [
  { type: "oauth2", scopes: [MCP_READ_SCOPE, MCP_WRITE_SCOPE] },
];

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
  return "تعذر تنفيذ الطلب في أثر";
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
    throw new Error("هذا الربط لا يملك صلاحية التعديل في أثر");
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

function includesSearch(value: unknown, search: string) {
  return (
    !search ||
    String(value ?? "")
      .toLocaleLowerCase("ar")
      .includes(search)
  );
}

async function createAthrMcpServer(user: User, authInfo: AuthInfo) {
  const server = new McpServer(
    { name: "أثر لإدارة الأعمال", version: "1.0.0" },
    {
      instructions:
        "استخدم أدوات أثر لقراءة وإدارة لوحة المستخدم الحالية. نفّذ الإضافة والتعديل والحذف فقط عندما يطلب المستخدم ذلك بوضوح. قبل الحذف اذكر العنصر الذي سيُحذف. معرفات الأعضاء والمشاريع والمهام تُقرأ من أدوات القوائم ولا تُخمن. جميع الصلاحيات وحدود المشاريع يفرضها خادم أثر.",
    }
  );
  const caller = createCaller(user);

  server.registerTool(
    "athr_get_context",
    {
      title: "عرض سياق حساب أثر",
      description:
        "يعرض المستخدم واللوحات المتاحة واللوحة الحالية ودور المستخدم. ابدأ بهذه الأداة عند غموض اللوحة المقصودة.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    () =>
      runTool(async () => {
        const boards = await caller.boards.mine();
        return {
          message: "سياق حساب أثر الحالي:",
          result: {
            user: { id: user.id, name: user.name, email: user.email },
            boards: boards.map(board => ({
              id: board.id,
              name: board.name,
              role: board.membershipRole,
              isActive: board.isActive,
              enabledModules: board.enabledModules,
            })),
          },
        };
      })
  );

  server.registerTool(
    "athr_select_board",
    {
      title: "اختيار لوحة أثر",
      description:
        "يغيّر اللوحة الحالية التي ستُنفذ عليها بقية أوامر أثر. استخدم معرفًا من athr_get_context.",
      inputSchema: { board_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ board_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        await caller.boards.select({ boardId: board_id });
        const boards = await caller.boards.mine();
        const board = boards.find(item => item.id === board_id);
        return { message: "تم اختيار اللوحة.", result: board };
      })
  );

  server.registerTool(
    "athr_list_team",
    {
      title: "عرض فريق اللوحة",
      description:
        "يعرض أعضاء فريق اللوحة الحالية ومعرفاتهم لاستخدامها في الإسناد ومسؤولية المشاريع.",
      inputSchema: { search: z.string().trim().max(160).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    ({ search }) =>
      runTool(async () => {
        const data = await caller.workspace.overview();
        const query = normalizedSearch(search);
        const members = data.members
          .filter(
            member =>
              includesSearch(member.name, query) ||
              includesSearch(member.role, query) ||
              includesSearch(member.email, query)
          )
          .map(member => ({
            id: member.id,
            name: member.name,
            role: member.role,
            email: member.email,
            projectAccess: member.projectAccess,
            currentTasks: member.activeTaskCount,
            lateTasks: member.overdueCount,
          }));
        return {
          message: `أعضاء الفريق (${members.length}):`,
          result: members,
        };
      })
  );

  server.registerTool(
    "athr_list_projects",
    {
      title: "عرض مشاريع أثر",
      description:
        "يعرض المشاريع التي يحق للمستخدم رؤيتها فقط، مع إمكان التصفية بالاسم والحالة والمسؤول.",
      inputSchema: {
        search: z.string().trim().max(240).optional(),
        status: projectStatus.optional(),
        responsible_member_id: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    ({ search, status, responsible_member_id }) =>
      runTool(async () => {
        const data = await caller.workspace.overview();
        const query = normalizedSearch(search);
        const projects = data.projects.filter(
          project =>
            includesSearch(project.title, query) &&
            (!status || project.status === status) &&
            (!responsible_member_id ||
              project.responsibleMemberIds.includes(responsible_member_id))
        );
        return {
          message: `المشاريع المتاحة (${projects.length}):`,
          result: projects,
        };
      })
  );

  server.registerTool(
    "athr_create_project",
    {
      title: "إنشاء مشروع",
      description:
        "ينشئ مشروعًا في لوحة أثر الحالية. يمكن ترك تاريخ النهاية فارغًا للمشروع المستمر. إذا لم يحدد المسؤول يستخدم عضو الفريق المرتبط بالمستخدم الحالي.",
      inputSchema: {
        title: z.string().trim().min(2).max(240),
        summary: z.string().trim().max(1500).optional(),
        annual_goal_id: z.number().int().positive().nullable().optional(),
        owner_member_id: z.number().int().positive().optional(),
        responsible_member_ids: z
          .array(z.number().int().positive())
          .max(100)
          .optional(),
        start_date: dateInput.optional(),
        end_date: dateInput.nullable().optional(),
        status: projectStatus.default("planned"),
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
        const data = await caller.workspace.overview();
        const self = data.members.find(member => member.userId === user.id);
        const ownerMemberId = input.owner_member_id ?? self?.id;
        if (!ownerMemberId)
          throw new Error("حدد owner_member_id من قائمة فريق اللوحة");
        const result = await caller.workspace.createProject({
          title: input.title,
          summary: input.summary,
          annualGoalId: input.annual_goal_id,
          ownerMemberId,
          responsibleMemberIds: input.responsible_member_ids?.length
            ? input.responsible_member_ids
            : [ownerMemberId],
          startDate: asDate(input.start_date) ?? new Date(),
          endDate: asDate(input.end_date),
          status: input.status,
        });
        return { message: "تم إنشاء المشروع في أثر.", result };
      })
  );

  server.registerTool(
    "athr_update_project",
    {
      title: "تعديل مشروع",
      description:
        "يعدّل الحقول المحددة في مشروع متاح للمستخدم، مع الإبقاء على بقية بياناته كما هي.",
      inputSchema: {
        project_id: z.number().int().positive(),
        title: z.string().trim().min(2).max(240).optional(),
        summary: z.string().trim().max(1500).optional(),
        annual_goal_id: z.number().int().positive().nullable().optional(),
        owner_member_id: z.number().int().positive().optional(),
        responsible_member_ids: z
          .array(z.number().int().positive())
          .min(1)
          .max(100)
          .optional(),
        start_date: dateInput.optional(),
        end_date: dateInput.nullable().optional(),
        status: projectStatus.optional(),
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
        const data = await caller.workspace.overview();
        const current = data.projects.find(
          item => item.id === input.project_id
        );
        if (!current) throw new Error("المشروع غير موجود أو غير متاح لحسابك");
        const result = await caller.workspace.updateProject({
          id: current.id,
          title: input.title ?? current.title,
          summary: input.summary ?? current.summary ?? undefined,
          annualGoalId:
            input.annual_goal_id === undefined
              ? current.annualGoalId
              : input.annual_goal_id,
          ownerMemberId: input.owner_member_id ?? current.ownerMemberId,
          responsibleMemberIds:
            input.responsible_member_ids ?? current.responsibleMemberIds,
          startDate: asDate(input.start_date) ?? current.startDate,
          endDate:
            input.end_date === undefined
              ? current.endDate
              : asDate(input.end_date),
          status: input.status ?? current.status,
        });
        return { message: "تم تحديث المشروع في أثر.", result };
      })
  );

  server.registerTool(
    "athr_delete_project",
    {
      title: "حذف مشروع",
      description:
        "يحذف مشروعًا متاحًا للمستخدم وما يرتبط به من مهام ومخرجات ودروس ومواعيد. لا تستخدمه قبل تأكيد المستخدم الصريح.",
      inputSchema: { project_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ project_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.deleteProject({ id: project_id });
        return { message: "تم حذف المشروع من أثر.", result };
      })
  );

  server.registerTool(
    "athr_list_tasks",
    {
      title: "عرض مهام أثر",
      description:
        "يعرض المهام المتاحة للمستخدم مع التصفية بالمشروع أو الشخص أو الحالة أو طلب الدعم.",
      inputSchema: {
        search: z.string().trim().max(240).optional(),
        project_id: z.number().int().positive().optional(),
        assignee_member_id: z.number().int().positive().optional(),
        status: taskStatus.optional(),
        needs_support: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.workspace.overview();
        const query = normalizedSearch(input.search);
        const tasks = data.tasks.filter(
          task =>
            includesSearch(task.title, query) &&
            (!input.project_id || task.projectId === input.project_id) &&
            (!input.assignee_member_id ||
              task.assigneeMemberId === input.assignee_member_id) &&
            (!input.status || task.status === input.status) &&
            (input.needs_support === undefined ||
              task.needsSupport === input.needs_support)
        );
        return { message: `المهام المتاحة (${tasks.length}):`, result: tasks };
      })
  );

  server.registerTool(
    "athr_create_task",
    {
      title: "إنشاء مهمة",
      description:
        "ينشئ مهمة في أثر. المشروع والإسناد والتواريخ اختيارية، ويمكن إنشاء مهمة فرعية بمعرف المهمة الرئيسية.",
      inputSchema: {
        title: z.string().trim().min(2).max(240),
        description: z.string().trim().max(5000).optional(),
        project_id: z.number().int().positive().nullable().optional(),
        assignee_member_id: z.number().int().positive().nullable().optional(),
        start_date: dateInput.nullable().optional(),
        due_date: dateInput.nullable().optional(),
        priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
        status: taskStatus.default("not_started"),
        parent_task_id: z.number().int().positive().nullable().optional(),
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
        const result = await caller.workspace.createTask({
          title: input.title,
          description: input.description,
          projectId: input.project_id,
          assigneeMemberId: input.assignee_member_id,
          startDate: asDate(input.start_date),
          dueDate: asDate(input.due_date),
          priority: input.priority,
          status: input.status,
          parentTaskId: input.parent_task_id,
        });
        return { message: "تم إنشاء المهمة في أثر.", result };
      })
  );

  server.registerTool(
    "athr_update_task",
    {
      title: "تعديل مهمة",
      description:
        "يعدّل الحقول المحددة في مهمة متاحة للمستخدم مع إبقاء بقية بياناتها كما هي.",
      inputSchema: {
        task_id: z.number().int().positive(),
        title: z.string().trim().min(2).max(240).optional(),
        description: z.string().trim().max(5000).optional(),
        project_id: z.number().int().positive().nullable().optional(),
        assignee_member_id: z.number().int().positive().nullable().optional(),
        start_date: dateInput.nullable().optional(),
        due_date: dateInput.nullable().optional(),
        priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
        status: taskStatus.optional(),
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
        const data = await caller.workspace.overview();
        const current = data.tasks.find(item => item.id === input.task_id);
        if (!current) throw new Error("المهمة غير موجودة أو غير متاحة لحسابك");
        const result = await caller.workspace.updateTask({
          id: current.id,
          title: input.title ?? current.title,
          description: input.description ?? current.description ?? undefined,
          projectId:
            input.project_id === undefined
              ? current.projectId
              : input.project_id,
          assigneeMemberId:
            input.assignee_member_id === undefined
              ? current.assigneeMemberId
              : input.assignee_member_id,
          startDate:
            input.start_date === undefined
              ? current.startDate
              : asDate(input.start_date),
          dueDate:
            input.due_date === undefined
              ? current.dueDate
              : asDate(input.due_date),
          priority: input.priority ?? current.priority,
          status: input.status ?? current.status,
        });
        return { message: "تم تحديث المهمة في أثر.", result };
      })
  );

  server.registerTool(
    "athr_delete_task",
    {
      title: "حذف مهمة",
      description:
        "يحذف مهمة متاحة للمستخدم وتعليقاتها ومرفقاتها المرتبطة. لا تستخدمه قبل تأكيد المستخدم الصريح.",
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
        const result = await caller.workspace.deleteTask({ id: task_id });
        return { message: "تم حذف المهمة من أثر.", result };
      })
  );

  server.registerTool(
    "athr_set_task_support",
    {
      title: "تحديد احتياج المهمة للدعم",
      description:
        "يضع أو يزيل علامة يحتاج دعم على مهمة متاحة، ويشرح نوع الدعم عند تفعيلها.",
      inputSchema: {
        task_id: z.number().int().positive(),
        needs_support: z.boolean(),
        support_request: z.string().trim().max(2000).optional(),
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
        const result = await caller.workspace.updateTaskSupport({
          id: input.task_id,
          needsSupport: input.needs_support,
          supportRequest: input.support_request,
        });
        return { message: "تم تحديث احتياج المهمة للدعم.", result };
      })
  );

  server.registerTool(
    "athr_add_task_comment",
    {
      title: "إضافة تعليق على مهمة",
      description: "يضيف تعليقًا باسم المستخدم الحالي إلى مهمة متاحة له.",
      inputSchema: {
        task_id: z.number().int().positive(),
        comment: z.string().trim().min(1).max(3000),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ task_id, comment }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        await caller.workspace.addTaskComment({
          taskId: task_id,
          body: comment,
        });
        return {
          message: "تمت إضافة التعليق إلى المهمة.",
          result: { success: true },
        };
      })
  );

  server.registerTool(
    "athr_list_lessons",
    {
      title: "عرض الدروس المستفادة",
      description:
        "يعرض الدروس المستفادة المتاحة للمستخدم مع التصفية بالمشروع أو التصنيف أو الفترة.",
      inputSchema: {
        search: z.string().trim().max(240).optional(),
        project_id: z.number().int().positive().optional(),
        category: lessonCategory.optional(),
        from_date: dateInput.optional(),
        to_date: dateInput.optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.workspace.overview();
        const query = normalizedSearch(input.search);
        const from = asDate(input.from_date);
        const to = asDate(input.to_date);
        const lessons = data.lessons.filter(item => {
          const date = new Date(item.lessonDate);
          return (
            (includesSearch(item.title, query) ||
              includesSearch(item.lesson, query) ||
              includesSearch(item.recommendation, query)) &&
            (!input.project_id || item.projectId === input.project_id) &&
            (!input.category || item.category === input.category) &&
            (!from || date >= from) &&
            (!to || date <= to)
          );
        });
        return {
          message: `الدروس المستفادة (${lessons.length}):`,
          result: lessons,
        };
      })
  );

  server.registerTool(
    "athr_create_lesson",
    {
      title: "إضافة درس مستفاد",
      description: "يضيف درسًا مستفادًا ويربطه بمشروع متاح للمستخدم.",
      inputSchema: {
        title: z.string().trim().min(2).max(240),
        project_id: z.number().int().positive(),
        category: lessonCategory,
        lesson: z.string().trim().min(2).max(5000),
        recommendation: z.string().trim().max(5000).optional(),
        lesson_date: dateInput.optional(),
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
        const result = await caller.workspace.createLessonLearned({
          title: input.title,
          projectId: input.project_id,
          category: input.category,
          lesson: input.lesson,
          recommendation: input.recommendation,
          lessonDate: asDate(input.lesson_date) ?? new Date(),
        });
        return { message: "تمت إضافة الدرس المستفاد إلى أثر.", result };
      })
  );

  server.registerTool(
    "athr_update_lesson",
    {
      title: "تعديل درس مستفاد",
      description:
        "يعدّل الحقول المحددة في درس مستفاد متاح للمستخدم مع إبقاء بقية بياناته.",
      inputSchema: {
        lesson_id: z.number().int().positive(),
        title: z.string().trim().min(2).max(240).optional(),
        project_id: z.number().int().positive().optional(),
        category: lessonCategory.optional(),
        lesson: z.string().trim().min(2).max(5000).optional(),
        recommendation: z.string().trim().max(5000).optional(),
        lesson_date: dateInput.optional(),
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
        const data = await caller.workspace.overview();
        const current = data.lessons.find(item => item.id === input.lesson_id);
        if (!current) throw new Error("الدرس غير موجود أو غير متاح لحسابك");
        const result = await caller.workspace.updateLessonLearned({
          id: current.id,
          title: input.title ?? current.title,
          projectId: input.project_id ?? current.projectId,
          category: input.category ?? current.category,
          lesson: input.lesson ?? current.lesson,
          recommendation:
            input.recommendation ?? current.recommendation ?? undefined,
          lessonDate: asDate(input.lesson_date) ?? current.lessonDate,
        });
        return { message: "تم تحديث الدرس المستفاد.", result };
      })
  );

  server.registerTool(
    "athr_delete_lesson",
    {
      title: "حذف درس مستفاد",
      description:
        "يحذف درسًا مستفادًا متاحًا للمستخدم. لا تستخدمه قبل تأكيد المستخدم الصريح.",
      inputSchema: { lesson_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ lesson_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.deleteLessonLearned({
          id: lesson_id,
        });
        return { message: "تم حذف الدرس المستفاد.", result };
      })
  );

  server.registerTool(
    "athr_list_goals",
    {
      title: "عرض أهداف الخطة السنوية",
      description: "يعرض أهداف الخطة السنوية في اللوحة الحالية وتقدمها.",
      inputSchema: { year: z.number().int().min(2000).max(2100).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    ({ year }) =>
      runTool(async () => {
        const data = await caller.workspace.overview();
        const goals = data.goals.filter(goal => !year || goal.year === year);
        return { message: `الأهداف السنوية (${goals.length}):`, result: goals };
      })
  );

  server.registerTool(
    "athr_create_goal",
    {
      title: "إضافة هدف سنوي",
      description: "يضيف هدفًا للخطة السنوية. متاح لمدير اللوحة فقط.",
      inputSchema: {
        title: z.string().trim().min(2).max(240),
        theme: z.string().trim().min(2).max(160),
        year: z.number().int().min(2000).max(2100),
        owner_member_id: z.number().int().positive(),
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
        const result = await caller.workspace.createAnnualGoal({
          title: input.title,
          theme: input.theme,
          year: input.year,
          ownerMemberId: input.owner_member_id,
        });
        return { message: "تمت إضافة الهدف السنوي.", result };
      })
  );

  server.registerTool(
    "athr_update_goal",
    {
      title: "تعديل هدف سنوي",
      description: "يعدّل الحقول المحددة في هدف سنوي. متاح لمدير اللوحة فقط.",
      inputSchema: {
        goal_id: z.number().int().positive(),
        title: z.string().trim().min(2).max(240).optional(),
        theme: z.string().trim().min(2).max(160).optional(),
        year: z.number().int().min(2000).max(2100).optional(),
        owner_member_id: z.number().int().positive().optional(),
        status: goalStatus.optional(),
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
        const data = await caller.workspace.overview();
        const current = data.goals.find(item => item.id === input.goal_id);
        if (!current) throw new Error("الهدف غير موجود في اللوحة الحالية");
        if (!current.ownerMemberId)
          throw new Error("حدد owner_member_id لهذا الهدف");
        const result = await caller.workspace.updateAnnualGoal({
          id: current.id,
          title: input.title ?? current.title,
          theme: input.theme ?? current.theme,
          year: input.year ?? current.year,
          ownerMemberId: input.owner_member_id ?? current.ownerMemberId,
          status: input.status ?? current.status,
        });
        return { message: "تم تحديث الهدف السنوي.", result };
      })
  );

  server.registerTool(
    "athr_delete_goal",
    {
      title: "حذف هدف سنوي",
      description:
        "يحذف هدفًا سنويًا ويفك ارتباط المشاريع به دون حذف المشاريع. متاح للمدير وبعد تأكيد المستخدم.",
      inputSchema: { goal_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ goal_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.deleteAnnualGoal({ id: goal_id });
        return { message: "تم حذف الهدف السنوي.", result };
      })
  );

  server.registerTool(
    "athr_list_calendar",
    {
      title: "عرض تقويم أثر",
      description:
        "يعرض مواعيد اللوحة المتاحة للمستخدم مع تصفية الفترة والمشروع.",
      inputSchema: {
        project_id: z.number().int().positive().optional(),
        from_date: dateInput.optional(),
        to_date: dateInput.optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const data = await caller.workspace.overview();
        const from = asDate(input.from_date);
        const to = asDate(input.to_date);
        const events = data.events.filter(item => {
          const date = new Date(item.eventDate);
          return (
            (!input.project_id || item.projectId === input.project_id) &&
            (!from || date >= from) &&
            (!to || date <= to)
          );
        });
        return {
          message: `مواعيد التقويم (${events.length}):`,
          result: events,
        };
      })
  );

  server.registerTool(
    "athr_create_calendar_event",
    {
      title: "إضافة موعد للتقويم",
      description:
        "يضيف اجتماعًا أو تسليمًا أو إطلاقًا أو ورشة أو مراجعة إلى تقويم أثر.",
      inputSchema: {
        title: z.string().trim().min(2).max(240),
        project_id: z.number().int().positive().nullable().optional(),
        event_date: dateInput,
        type: eventType,
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
        const result = await caller.workspace.createCalendarEvent({
          title: input.title,
          projectId: input.project_id,
          eventDate: asDate(input.event_date)!,
          type: input.type,
        });
        return { message: "تمت إضافة الموعد إلى التقويم.", result };
      })
  );

  server.registerTool(
    "athr_delete_calendar_event",
    {
      title: "حذف موعد من التقويم",
      description: "يحذف موعدًا متاحًا للمستخدم من التقويم بعد تأكيده.",
      inputSchema: { event_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ event_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.deleteCalendarEvent({
          id: event_id,
        });
        return { message: "تم حذف الموعد من التقويم.", result };
      })
  );

  server.registerTool(
    "athr_get_report_summary",
    {
      title: "عرض ملخص تقارير أثر",
      description: "يعرض مؤشرات إنجاز وتأخر المهام ضمن نطاق وصول المستخدم.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    () =>
      runTool(async () => ({
        message: "ملخص التقرير الحالي:",
        result: await caller.workspace.reportSummary(),
      }))
  );

  server.registerTool(
    "athr_list_research_feed",
    {
      title: "عرض الخلاصات البحثية",
      description:
        "يعرض موضوعات الخلاصات والأبحاث المتاحة، مع التصفية بالموضوع أو المشروع أو كلمات البحث.",
      inputSchema: {
        interest_id: z.number().int().positive().optional(),
        project_id: z.number().int().positive().optional(),
        search: z.string().trim().max(300).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { securitySchemes: readSecurity },
    },
    input =>
      runTool(async () => {
        const feed = await caller.workspace.researchFeed();
        const query = normalizedSearch(input.search);
        const items = feed.items.filter(
          item =>
            (!input.interest_id ||
              item.interestIds.includes(input.interest_id)) &&
            (!input.project_id || item.projectId === input.project_id) &&
            (includesSearch(item.title, query) ||
              includesSearch(item.abstract, query) ||
              includesSearch(item.abstractArabic, query) ||
              item.authors.some(author => includesSearch(author, query)))
        );
        return {
          message: `الخلاصات البحثية (${items.length}):`,
          result: { interests: feed.interests, items },
        };
      })
  );

  server.registerTool(
    "athr_save_research_translations",
    {
      title: "حفظ ترجمات ملخصات الأبحاث",
      description:
        "يحفظ ترجمة عربية أمينة للملخص الأصلي في أثر. اقرأ الخلاصات أولًا، وترجم المعنى كاملًا دون اختلاق معلومات أو تحويل النص إلى ملخص أقصر. يقبل حتى 20 ترجمة في الطلب، ومتاح لمدير اللوحة وأعضائها.",
      inputSchema: {
        translations: z
          .array(
            z.object({
              feed_item_id: z.number().int().positive(),
              arabic_abstract: z.string().trim().min(20).max(20_000),
            })
          )
          .min(1)
          .max(20),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ translations }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.saveResearchFeedTranslations({
          translations: translations.map(translation => ({
            id: translation.feed_item_id,
            abstractArabic: translation.arabic_abstract,
          })),
        });
        return {
          message: `تم حفظ ${result.updated} ترجمة عربية في أثر.`,
          result,
        };
      })
  );

  server.registerTool(
    "athr_create_research_interest",
    {
      title: "إضافة موضوع للخلاصات البحثية",
      description:
        "يضيف موضوعًا وكلمات مفتاحية للخلاصات البحثية. متاح لمدير اللوحة وأعضائها.",
      inputSchema: {
        name: z.string().trim().min(2).max(180),
        keywords: z.array(z.string().trim().min(2).max(100)).min(1).max(40),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.createResearchInterest(input);
        return { message: "تمت إضافة موضوع الخلاصات البحثية.", result };
      })
  );

  server.registerTool(
    "athr_update_research_interest",
    {
      title: "تعديل موضوع للخلاصات البحثية",
      description:
        "يعدّل اسم موضوع الخلاصات وكلماته المفتاحية. متاح لمدير اللوحة فقط.",
      inputSchema: {
        interest_id: z.number().int().positive(),
        name: z.string().trim().min(2).max(180),
        keywords: z.array(z.string().trim().min(2).max(100)).min(1).max(40),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    input =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.updateResearchInterest({
          id: input.interest_id,
          name: input.name,
          keywords: input.keywords,
        });
        return { message: "تم تحديث موضوع الخلاصات البحثية.", result };
      })
  );

  server.registerTool(
    "athr_delete_research_interest",
    {
      title: "حذف موضوع من الخلاصات البحثية",
      description:
        "يحذف موضوع خلاصات بحثية. متاح لمدير اللوحة فقط وبعد تأكيد المستخدم.",
      inputSchema: { interest_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ interest_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.deleteResearchInterest({
          id: interest_id,
        });
        return { message: "تم حذف موضوع الخلاصات البحثية.", result };
      })
  );

  server.registerTool(
    "athr_link_research_item",
    {
      title: "ربط خلاصة بحثية بمشروع",
      description:
        "يربط بحثًا من الخلاصات بمشروع متاح للمستخدم، أو يفك الارتباط عند تمرير null.",
      inputSchema: {
        feed_item_id: z.number().int().positive(),
        project_id: z.number().int().positive().nullable(),
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
        const result = await caller.workspace.linkResearchFeedItem({
          id: input.feed_item_id,
          projectId: input.project_id,
        });
        return { message: "تم تحديث ارتباط الخلاصة بالمشروع.", result };
      })
  );

  server.registerTool(
    "athr_invite_team_member",
    {
      title: "دعوة عضو إلى فريق اللوحة",
      description:
        "ينشئ دعوة عضو أو مدير أو مشاهد. متاح لمدير اللوحة فقط، ويمكن تقييد العضو بمشاريع مختارة.",
      inputSchema: {
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320),
        team_role: z.string().trim().min(2).max(160),
        access_role: z.enum(["manager", "member", "viewer"]).default("member"),
        project_access: z.enum(["all", "selected"]).default("all"),
        allowed_project_ids: z
          .array(z.number().int().positive())
          .max(500)
          .default([]),
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
        const result = await caller.workspace.inviteMember({
          name: input.name,
          email: input.email,
          teamRole: input.team_role,
          accessRole: input.access_role,
          projectAccess: input.project_access,
          allowedProjectIds: input.allowed_project_ids,
        });
        return { message: "تم إنشاء دعوة عضو الفريق في أثر.", result };
      })
  );

  server.registerTool(
    "athr_update_team_member_access",
    {
      title: "تعديل وصول عضو الفريق",
      description:
        "يعدّل دور عضو الفريق أو يحدد إن كان يرى جميع المشاريع أو مشاريع مختارة. متاح لمدير اللوحة فقط.",
      inputSchema: {
        member_id: z.number().int().positive(),
        access_role: z.enum(["manager", "member", "viewer"]).optional(),
        project_access: z.enum(["all", "selected"]).optional(),
        allowed_project_ids: z
          .array(z.number().int().positive())
          .max(500)
          .optional(),
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
        if (!input.access_role && !input.project_access)
          throw new Error("حدد access_role أو project_access لتعديل الوصول");
        if (input.access_role && input.project_access)
          throw new Error(
            "عدّل الدور أو نطاق المشاريع في كل طلب على حدة لضمان اكتمال العملية"
          );
        const changes: unknown[] = [];
        if (input.access_role) {
          changes.push(
            await caller.workspace.updateTeamMemberAccess({
              memberId: input.member_id,
              accessRole: input.access_role,
            })
          );
        }
        if (input.project_access) {
          changes.push(
            await caller.workspace.updateTeamMemberProjectAccess({
              memberId: input.member_id,
              projectAccess: input.project_access,
              allowedProjectIds:
                input.project_access === "all"
                  ? []
                  : (input.allowed_project_ids ?? []),
            })
          );
        }
        return { message: "تم تحديث وصول عضو الفريق.", result: changes };
      })
  );

  server.registerTool(
    "athr_reissue_team_invitation",
    {
      title: "إعادة إصدار دعوة عضو",
      description:
        "يلغي رمز الدعوة السابق وينشئ رابط دعوة جديدًا للعضو. متاح لمدير اللوحة فقط.",
      inputSchema: { member_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ member_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.reissueTeamInvitation({
          memberId: member_id,
        });
        return { message: "تم إصدار رابط دعوة جديد.", result };
      })
  );

  server.registerTool(
    "athr_remove_team_member",
    {
      title: "حذف عضو من فريق اللوحة",
      description:
        "يحذف عضوًا غير مرتبط بحساب مفعل من فريق اللوحة. متاح للمدير وبعد تأكيد المستخدم الصريح.",
      inputSchema: { member_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: { securitySchemes: writeSecurity },
    },
    ({ member_id }) =>
      runTool(async () => {
        requireWriteScope(authInfo);
        const result = await caller.workspace.deleteTeamMember({
          memberId: member_id,
        });
        return { message: "تم حذف العضو من فريق اللوحة.", result };
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
      throw new Error("يلزم تسجيل الدخول إلى أثر");
    const user = await db.getUserById(userId);
    if (!user) throw new Error("حساب أثر غير موجود");
    return createAthrMcpServer(user, authInfo);
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
