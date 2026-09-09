import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { NotificationCenter } from "@/components/NotificationCenter";
import { BrowserNotificationSettings } from "@/components/BrowserNotificationSettings";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  getTaskAttentionReason,
  matchesTaskDueFilter,
  sortTasksByPriority,
  type TaskDueFilter,
} from "@shared/taskPriority";
import {
  calculatePeriodCompletion,
  filterTasksByCompletionPeriod,
  type CompletionPeriod,
} from "@shared/periodCompletion";
import { DEFAULT_BOARD_MODULES, type BoardModule } from "@shared/boardModules";
import {
  DEFAULT_PRESENTATION_SECTIONS,
  type PresentationSection,
} from "@shared/presentationSections";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  Flag,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Presentation,
  Search,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
  ArrowRight,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  UserRound,
  RotateCcw,
  Send,
  Trash2,
  Rss,
  RefreshCw,
  Rocket,
  ExternalLink,
  SlidersHorizontal,
  Link2,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import BoardOnboarding from "./BoardOnboarding";
import Landing from "./Landing";

type Page =
  | "home"
  | "plan"
  | "time"
  | "projects"
  | "project"
  | "tasks"
  | "task"
  | "team"
  | "member"
  | "launches"
  | "calendar"
  | "feeds"
  | "lessons"
  | "reports"
  | "mcp"
  | "settings";
type Period = CompletionPeriod;
type MyTasksPeriod = "day" | "week" | "month" | "all";
type TaskStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "complete"
  | "overdue";
type ProjectStatus =
  | "planned"
  | "in_progress"
  | "in_review"
  | "complete"
  | "blocked";

const presentationSectionOptions: {
  id: PresentationSection;
  label: string;
  description: string;
  icon: typeof Target;
}[] = [
  {
    id: "completion",
    label: "إنجاز الفترة",
    description: "نسبة المهام المكتملة خلال العرض.",
    icon: TrendingUp,
  },
  {
    id: "priorities",
    label: "أولويات المهام",
    description: "أعلى المهام أولوية التي لم تكتمل.",
    icon: Flag,
  },
  {
    id: "attention",
    label: "يحتاج انتباه",
    description: "المهام المتأخرة أو القريبة أو التي تحتاج دعمًا.",
    icon: AlertTriangle,
  },
  {
    id: "upcoming",
    label: "الإطلاقات القادمة",
    description: "أقرب مواعيد إطلاق المشاريع.",
    icon: CalendarDays,
  },
  {
    id: "projects",
    label: "المشاريع",
    description: "المشاريع الجارية ونسب تقدمها.",
    icon: FolderKanban,
  },
  {
    id: "goals",
    label: "الأهداف السنوية",
    description: "الأهداف وحالة تقدم كل هدف.",
    icon: Target,
  },
  {
    id: "team",
    label: "الفريق",
    description: "عبء العمل الحالي لأعضاء الفريق.",
    icon: Users,
  },
  {
    id: "support",
    label: "طلبات الدعم",
    description: "المهام التي طلب أصحابها دعمًا.",
    icon: CircleHelp,
  },
  {
    id: "lessons",
    label: "الدروس المستفادة",
    description: "أحدث الدروس الموثقة من المشاريع.",
    icon: Lightbulb,
  },
  {
    id: "feeds",
    label: "الخلاصات البحثية",
    description: "أحدث الأبحاث من موضوعات اللوحة.",
    icon: Rss,
  },
];

function supportedPresentationSections(
  sections: unknown
): PresentationSection[] {
  if (!Array.isArray(sections)) return DEFAULT_PRESENTATION_SECTIONS;
  const supported = new Set(
    presentationSectionOptions.map(option => option.id)
  );
  const filtered = sections.filter((section): section is PresentationSection =>
    supported.has(section as PresentationSection)
  );
  return filtered.length ? filtered : DEFAULT_PRESENTATION_SECTIONS;
}

const pageModule: Partial<Record<Page, BoardModule>> = {
  plan: "plan",
  time: "plan",
  projects: "projects",
  project: "projects",
  tasks: "tasks",
  task: "tasks",
  team: "team",
  member: "team",
  launches: "calendar",
  calendar: "calendar",
  feeds: "feeds",
  lessons: "lessons",
  reports: "reports",
};

const periodLabels: Record<Period, string> = {
  day: "اليوم",
  week: "هذا الأسبوع",
  month: "هذا الشهر",
  quarter: "هذا الربع",
  year: "هذه السنة",
};
const taskStatusLabel: Record<string, string> = {
  not_started: "لم تبدأ",
  in_progress: "قيد التنفيذ",
  blocked: "متوقفة",
  in_review: "للمراجعة",
  complete: "مكتملة",
  overdue: "متأخرة",
};
const projectStatusLabel: Record<string, string> = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  in_review: "للمراجعة",
  complete: "مكتمل",
  blocked: "متعثر",
};
const priorityLabel: Record<string, string> = {
  urgent: "عاجلة",
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};
const priorityClass: Record<string, string> = {
  urgent: "bg-rose-50 text-rose-700 ring-rose-100",
  high: "bg-orange-50 text-orange-700 ring-orange-100",
  medium: "bg-blue-50 text-blue-700 ring-blue-100",
  low: "bg-slate-100 text-slate-600 ring-slate-200",
};
const boardAccessLabel: Record<string, string> = {
  manager: "مدير لوحة",
  member: "عضو",
  viewer: "مشاهد",
};
const lessonCategoryLabel: Record<string, string> = {
  success: "ممارسة ناجحة",
  challenge: "تحدٍ واجهناه",
  improvement: "فرصة تحسين",
  risk: "مخاطرة يجب تجنبها",
};
const lessonCategoryClass: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  challenge: "bg-amber-50 text-amber-700 ring-amber-100",
  improvement: "bg-blue-50 text-blue-700 ring-blue-100",
  risk: "bg-rose-50 text-rose-700 ring-rose-100",
};
const SHOW_BOARD_JOIN_LINKS = false;

function dateText(value: Date | string | null | undefined, short = true) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: short ? "short" : "long",
  }).format(new Date(value));
}

function fullDateText(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function headerDateText(value = new Date()) {
  return new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function futureInputValue(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function projectResponsibles(project: any, members: any[]) {
  const ids = project.responsibleMemberIds?.length
    ? project.responsibleMemberIds
    : [project.ownerMemberId];
  return ids
    .map((id: number) => members.find((member: any) => member.id === id))
    .filter(Boolean);
}

function escapeReportHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printLessonsReport({
  lessons,
  workspaceName,
  projectLabel,
  from,
  to,
}: {
  lessons: any[];
  workspaceName: string;
  projectLabel: string;
  from: string;
  to: string;
}) {
  if (!lessons.length) {
    toast.error("لا توجد دروس ضمن النطاق المحدد لتصديرها");
    return;
  }
  const reportWindow = window.open("", "_blank", "width=980,height=800");
  if (!reportWindow) {
    toast.error("اسمح بالنوافذ المنبثقة لإكمال تصدير التقرير");
    return;
  }
  reportWindow.opener = null;
  const categoryCounts = Object.keys(lessonCategoryLabel)
    .map(category => ({
      category,
      count: lessons.filter(item => item.category === category).length,
    }))
    .filter(item => item.count > 0);
  const rangeLabel =
    from || to
      ? `${from ? fullDateText(new Date(`${from}T12:00:00`)) : "البداية"} — ${
          to ? fullDateText(new Date(`${to}T12:00:00`)) : "اليوم"
        }`
      : "كل الفترات";
  const cards = lessons
    .map(
      (item, index) => `
        <article class="lesson">
          <div class="lesson-head">
            <div>
              <span class="number">${String(index + 1).padStart(2, "0")}</span>
              <h2>${escapeReportHtml(item.title)}</h2>
            </div>
            <span class="category category-${escapeReportHtml(item.category)}">
              ${escapeReportHtml(lessonCategoryLabel[item.category] ?? item.category)}
            </span>
          </div>
          <div class="meta">
            <span><b>المشروع:</b> ${escapeReportHtml(item.projectTitle)}</span>
            <span><b>تاريخ الدرس:</b> ${escapeReportHtml(fullDateText(item.lessonDate))}</span>
            <span><b>وثّقه:</b> ${escapeReportHtml(item.authorName)}</span>
          </div>
          <section>
            <h3>الدرس المستفاد</h3>
            <p>${escapeReportHtml(item.lesson).replaceAll("\n", "<br>")}</p>
          </section>
          ${
            item.recommendation
              ? `<section class="recommendation">
                  <h3>التوصية للمشاريع القادمة</h3>
                  <p>${escapeReportHtml(item.recommendation).replaceAll("\n", "<br>")}</p>
                </section>`
              : ""
          }
        </article>`
    )
    .join("");
  const categorySummary = categoryCounts
    .map(
      item => `<div class="stat">
        <strong>${item.count}</strong>
        <span>${escapeReportHtml(lessonCategoryLabel[item.category])}</span>
      </div>`
    )
    .join("");
  reportWindow.document.write(`<!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>تقرير الدروس المستفادة - ${escapeReportHtml(workspaceName)}</title>
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #eef3f8; color: #26364a; font-family: Tahoma, Arial, sans-serif; line-height: 1.75; }
          .toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center; gap: 14px; padding: 12px; background: #26364a; color: white; }
          .toolbar button { border: 0; border-radius: 8px; padding: 9px 20px; background: white; color: #26364a; font: inherit; font-weight: 700; cursor: pointer; }
          .report { width: min(210mm, calc(100% - 32px)); margin: 24px auto; background: white; padding: 18mm 16mm; box-shadow: 0 14px 42px rgba(38,54,74,.12); }
          .cover { position: relative; overflow: hidden; min-height: 180px; padding: 30px; border-radius: 18px; background: linear-gradient(135deg,#26364a,#52769f); color: white; }
          .cover::after { content: ""; position: absolute; left: -55px; bottom: -75px; width: 210px; height: 210px; border: 34px solid rgba(255,255,255,.08); border-radius: 50%; }
          .brand { color: #cfe0ef; font-weight: 700; letter-spacing: .03em; }
          h1 { margin: 24px 0 5px; font-size: 30px; line-height: 1.35; }
          .subtitle { margin: 0; color: #dbe7f1; }
          .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 22px 0; }
          .filter { padding: 13px 15px; border: 1px solid #dce7f2; border-radius: 12px; background: #fbfdff; }
          .filter span { display: block; color: #7c8a9a; font-size: 11px; }
          .filter strong { display: block; margin-top: 3px; font-size: 13px; }
          .summary { display: grid; grid-template-columns: repeat(${Math.min(categoryCounts.length + 1, 5)},1fr); gap: 10px; margin-bottom: 24px; }
          .stat { padding: 13px; border: 1px solid #e4eaf0; border-radius: 12px; text-align: center; }
          .stat strong { display: block; color: #52769f; font-size: 22px; line-height: 1.3; }
          .stat span { color: #647487; font-size: 10px; }
          .lesson { margin: 0 0 16px; padding: 18px; border: 1px solid #dfe7ee; border-radius: 14px; page-break-inside: avoid; break-inside: avoid; }
          .lesson-head, .lesson-head > div { display: flex; align-items: center; gap: 10px; }
          .lesson-head { justify-content: space-between; }
          .lesson h2 { margin: 0; font-size: 17px; }
          .number { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px; background: #edf4fa; color: #52769f; font-size: 11px; font-weight: 700; }
          .category { border-radius: 999px; padding: 4px 9px; font-size: 9px; font-weight: 700; white-space: nowrap; }
          .category-success { background: #ecfdf5; color: #047857; }
          .category-challenge { background: #fffbeb; color: #b45309; }
          .category-improvement { background: #eff6ff; color: #1d4ed8; }
          .category-risk { background: #fff1f2; color: #be123c; }
          .meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 13px 0; padding-bottom: 12px; border-bottom: 1px solid #edf1f5; color: #708092; font-size: 10px; }
          .meta b { color: #52657a; }
          .lesson section { margin-top: 10px; }
          .lesson h3 { margin: 0 0 3px; color: #52769f; font-size: 11px; }
          .lesson p { margin: 0; color: #3d4d60; font-size: 12px; }
          .recommendation { padding: 10px 12px; border-right: 3px solid #6c8fb8; background: #f7f9fc; }
          .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e4eaf0; color: #8492a1; font-size: 9px; text-align: center; }
          @page { size: A4; margin: 11mm; }
          @media print {
            body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .toolbar { display: none; }
            .report { width: auto; margin: 0; padding: 0; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar"><span>التقرير جاهز</span><button onclick="window.print()">حفظ بصيغة PDF</button></div>
        <main class="report">
          <header class="cover">
            <div class="brand">أثر · ${escapeReportHtml(workspaceName)}</div>
            <h1>تقرير الدروس المستفادة</h1>
            <p class="subtitle">معرفة متراكمة تساعد الفريق على تحسين قرارات المشاريع القادمة.</p>
          </header>
          <div class="filters">
            <div class="filter"><span>نطاق المشاريع</span><strong>${escapeReportHtml(projectLabel)}</strong></div>
            <div class="filter"><span>الفترة</span><strong>${escapeReportHtml(rangeLabel)}</strong></div>
          </div>
          <div class="summary">
            <div class="stat"><strong>${lessons.length}</strong><span>إجمالي الدروس</span></div>
            ${categorySummary}
          </div>
          ${cards}
          <footer class="footer">صدر من منصة أثر بتاريخ ${escapeReportHtml(fullDateText(new Date()))}</footer>
        </main>
      </body>
    </html>`);
  reportWindow.document.close();
  reportWindow.focus();
  toast.message("اختر «حفظ كملف PDF» من نافذة الطباعة");
  window.setTimeout(() => reportWindow.print(), 350);
}

function statusClass(status: string) {
  if (status === "complete" || status === "on_track")
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "overdue" || status === "blocked" || status === "at_risk")
    return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "in_review" || status === "attention")
    return "bg-amber-50 text-amber-700 ring-amber-100";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function StatusPill({
  status,
  project = false,
}: {
  status: string;
  project?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        statusClass(status)
      )}
    >
      {project
        ? projectStatusLabel[status]
        : (taskStatusLabel[status] ?? status)}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        priorityClass[priority] ?? priorityClass.medium
      )}
    >
      <Flag className="size-3" />
      {priorityLabel[priority] ?? priority}
    </span>
  );
}

function SupportPill() {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-100">
      <CircleHelp className="size-3" />
      يحتاج دعم
    </span>
  );
}

function Avatar({
  initials,
  color,
  className,
}: {
  initials: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        className
      )}
      style={{ backgroundColor: color ?? "#6C8FB8" }}
    >
      {initials}
    </span>
  );
}

function PeriodSelect({
  value,
  onChange,
}: {
  value: Period;
  onChange: (value: Period) => void;
}) {
  return (
    <label className="relative inline-flex items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value as Period)}
        className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-8 text-sm font-medium text-[#52657A] outline-none transition focus:border-[#6C8FB8] focus:ring-2 focus:ring-[#6C8FB8]/10"
      >
        <option value="day">اليوم</option>
        <option value="week">الأسبوع</option>
        <option value="month">الشهر</option>
        <option value="quarter">الربع</option>
        <option value="year">السنة</option>
      </select>
      <ChevronDown className="pointer-events-none absolute left-2.5 size-4 text-slate-400" />
    </label>
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-[#26364A]">{children}</h2>
      {action}
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="py-12 text-center text-sm text-slate-500">{title}</div>
  );
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const { data: boards, isLoading: boardsLoading } = trpc.boards.mine.useQuery(
    undefined,
    { enabled: Boolean(user), staleTime: 30_000 }
  );
  const activeBoard = boards?.find(board => board.isActive) ?? boards?.[0];
  const enabledModules = activeBoard?.enabledModules ?? DEFAULT_BOARD_MODULES;
  const { data, isLoading, error } = trpc.workspace.overview.useQuery(
    undefined,
    { enabled: Boolean(user && activeBoard), staleTime: 30_000 }
  );
  const selectBoard = trpc.boards.select.useMutation({
    onSuccess: async () => {
      setPage("home");
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.boards.mine.invalidate(),
        utils.workspace.overview.invalidate(),
      ]);
      toast.success("تم الانتقال إلى اللوحة");
    },
    onError: issue => toast.error(issue.message),
  });
  const updateTaskStatus = trpc.workspace.updateTaskStatus.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      toast.success("تم تحديث حالة المهمة");
    },
    onError: issue => toast.error(issue.message),
  });
  const createTask = trpc.workspace.createTask.useMutation({
    onSuccess: result => {
      utils.workspace.overview.invalidate();
      toast.success("تمت إضافة المهمة");
      if (result.showLoadWarning)
        toast.warning("هذا العضو لديه عبء عمل مرتفع حاليًا.");
    },
    onError: issue => toast.error(issue.message),
  });
  const editTaskMutation = trpc.workspace.updateTask.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      setEditingTask(null);
      toast.success("تم تحديث المهمة");
    },
    onError: issue => toast.error(issue.message),
  });
  const deleteTaskMutation = trpc.workspace.deleteTask.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      toast.success("تم حذف المهمة");
    },
    onError: issue => toast.error(issue.message),
  });
  const createProject = trpc.workspace.createProject.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      toast.success("تم إنشاء المشروع");
    },
    onError: issue => toast.error(issue.message),
  });
  const editProjectMutation = trpc.workspace.updateProject.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      setEditingProject(null);
      toast.success("تم تحديث المشروع");
    },
    onError: issue => toast.error(issue.message),
  });
  const deleteProjectMutation = trpc.workspace.deleteProject.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      setProjectId(null);
      setPage("projects");
      toast.success("تم حذف المشروع");
    },
    onError: issue => toast.error(issue.message),
  });
  const createGoal = trpc.workspace.createAnnualGoal.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      toast.success("تمت إضافة الهدف السنوي");
    },
    onError: issue => toast.error(issue.message),
  });
  const createLesson = trpc.workspace.createLessonLearned.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      toast.success("تمت إضافة الدرس المستفاد");
    },
    onError: issue => toast.error(issue.message),
  });
  const assignTask = trpc.workspace.assignTask.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      toast.success("تم إسناد المهمة");
    },
  });
  const updateProjectStatus = trpc.workspace.updateProjectStatus.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      toast.success("تم تحديث حالة المشروع");
    },
  });
  const inviteMember = trpc.workspace.inviteMember.useMutation({
    onSuccess: () => toast.success("تم إنشاء رابط دعوة العضو"),
  });
  const markOpenedNotification =
    trpc.workspace.markNotificationRead.useMutation({
      onSuccess: () => {
        void utils.workspace.notifications.invalidate();
        const url = new URL(window.location.href);
        url.searchParams.delete("notificationId");
        window.history.replaceState({}, "", url.pathname + url.search);
      },
    });
  const requestedPage = new URLSearchParams(window.location.search).get(
    "view"
  ) as Page | null;
  const validPages: Page[] = [
    "home",
    "plan",
    "time",
    "projects",
    "project",
    "tasks",
    "task",
    "team",
    "member",
    "launches",
    "calendar",
    "feeds",
    "lessons",
    "reports",
    "mcp",
    "settings",
  ];
  const [page, setPage] = useState<Page>(() =>
    requestedPage && validPages.includes(requestedPage) ? requestedPage : "home"
  );
  const [period, setPeriod] = useState<Period>("week");
  const requestedProjectId = Number(
    new URLSearchParams(window.location.search).get("projectId")
  );
  const requestedTaskId = Number(
    new URLSearchParams(window.location.search).get("taskId")
  );
  const [projectId, setProjectId] = useState<number | null>(() =>
    Number.isInteger(requestedProjectId) && requestedProjectId > 0
      ? requestedProjectId
      : null
  );
  const [taskId, setTaskId] = useState<number | null>(() =>
    Number.isInteger(requestedTaskId) && requestedTaskId > 0
      ? requestedTaskId
      : null
  );
  const [memberId, setMemberId] = useState<number | null>(null);
  const [showNav, setShowNav] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const openedNotificationId = Number(
    new URLSearchParams(window.location.search).get("notificationId")
  );
  useEffect(() => {
    if (
      !activeBoard ||
      !Number.isInteger(openedNotificationId) ||
      openedNotificationId <= 0 ||
      markOpenedNotification.isPending
    )
      return;
    markOpenedNotification.mutate({ id: openedNotificationId });
  }, [activeBoard?.id, openedNotificationId]);
  const requestedDrawer = new URLSearchParams(window.location.search).get(
    "drawer"
  );
  const [taskDrawer, setTaskDrawer] = useState(
    () => requestedDrawer === "task"
  );
  const [newTaskProjectId, setNewTaskProjectId] = useState<number | null>(null);
  const [projectDrawer, setProjectDrawer] = useState(
    () => requestedDrawer === "project"
  );
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [goalDrawer, setGoalDrawer] = useState(
    () => requestedDrawer === "goal"
  );
  const [lessonDrawer, setLessonDrawer] = useState(
    () => requestedDrawer === "lesson"
  );
  const [inviteDrawer, setInviteDrawer] = useState(
    () => requestedDrawer === "invite"
  );

  useEffect(() => {
    const requiredModule = pageModule[page];
    if (requiredModule && !enabledModules.includes(requiredModule)) {
      setPage("home");
    }
  }, [enabledModules, page]);

  const goPeriod = (next: Period) => {
    setPeriod(next);
    setPage(next === "year" ? "plan" : "time");
  };
  const boardRole = activeBoard?.membershipRole;
  const requireMember = (action: () => void) => {
    if (!user) {
      toast.message("سجّل الدخول لإدارة أعمال القسم");
      startLogin();
      return;
    }
    if (boardRole === "viewer") {
      toast.error("صلاحية المشاهد للعرض فقط");
      return;
    }
    action();
  };
  const requireManager = (action: () => void) => {
    if (!user) {
      toast.message("سجّل الدخول لإدارة أعمال القسم");
      startLogin();
      return;
    }
    if (user.role !== "admin" && boardRole !== "manager") {
      toast.error("هذه العملية متاحة لمدير اللوحة فقط");
      return;
    }
    action();
  };
  const completeTask = (id: number, currentStatus?: string) => {
    if (!user) {
      toast.message("سجّل الدخول لتحديث حالة المهمة");
      startLogin();
      return;
    }
    requireMember(() =>
      updateTaskStatus.mutate({
        id,
        status: currentStatus === "complete" ? "not_started" : "complete",
      })
    );
  };
  const previewOnboarding =
    new URLSearchParams(window.location.search).get("preview") === "onboarding";
  const workspaceName = activeBoard?.name ?? "مساحة العمل";

  if (previewOnboarding) return <BoardOnboarding preview />;
  if (authLoading) return <LoadingShell />;
  if (!user) return <Landing />;
  if (boardsLoading) return <LoadingShell />;
  if (boards && boards.length === 0) return <BoardOnboarding />;
  if (presentation && data)
    return (
      <PresentationMode
        data={data}
        workspaceName={workspaceName}
        canManage={user.role === "admin" || boardRole === "manager"}
        sections={
          activeBoard?.presentationSections ?? DEFAULT_PRESENTATION_SECTIONS
        }
        close={() => setPresentation(false)}
      />
    );
  if (isLoading) return <LoadingShell />;
  if (error || !data)
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#F7F9FC] p-8 text-center"
      >
        <div>
          <AlertTriangle className="mx-auto mb-3 size-7 text-amber-600" />
          <h1 className="font-semibold">تعذر تحميل لوحة القسم</h1>
          <p className="mt-2 text-sm text-slate-500">
            يرجى تحديث الصفحة أو المحاولة لاحقًا.
          </p>
        </div>
      </div>
    );
  const shared = {
    data,
    user,
    workspaceName,
    setPage,
    setProjectId,
    setTaskId,
    setMemberId,
    period,
    goPeriod,
    completeTask,
    assignTask: (id: number, assigneeMemberId: number | null) =>
      requireMember(() => assignTask.mutate({ id, assigneeMemberId })),
    updateProjectStatus: (id: number, status: ProjectStatus) =>
      updateProjectStatus.mutate({ id, status }),
    openTask: (initialProjectId?: number) =>
      requireMember(() => {
        setNewTaskProjectId(initialProjectId ?? null);
        setTaskDrawer(true);
      }),
    openTaskDetail: (selectedTaskId: number) => {
      setTaskId(selectedTaskId);
      setPage("task");
    },
    updateTaskStatus: (id: number, status: TaskStatus) =>
      requireMember(() => updateTaskStatus.mutate({ id, status })),
    openProject: () => requireMember(() => setProjectDrawer(true)),
    editTask: (task: any) => requireMember(() => setEditingTask(task)),
    deleteTask: (id: number) =>
      requireMember(() => deleteTaskMutation.mutate({ id })),
    editProject: (project: any) =>
      requireMember(() => setEditingProject(project)),
    deleteProject: (id: number) =>
      requireMember(() => deleteProjectMutation.mutate({ id })),
    canEditWork: boardRole !== "viewer",
    canModerateComments:
      user.role === "admin" ||
      user.role === "manager" ||
      boardRole === "manager",
    openGoal: () => requireManager(() => setGoalDrawer(true)),
    openLesson: () => requireMember(() => setLessonDrawer(true)),
    canManagePlan: user.role === "admin" || boardRole === "manager",
    canManageTeam: user.role === "admin" || boardRole === "manager",
    canManageFeeds: user.role === "admin" || boardRole === "manager",
    canAddFeeds:
      user.role === "admin" ||
      boardRole === "manager" ||
      boardRole === "member",
    openInvite: () => requireManager(() => setInviteDrawer(true)),
  };
  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F9FC] text-[#26364A]">
      <Sidebar
        workspaceName={workspaceName}
        user={user}
        membershipRole={boardRole}
        boards={boards ?? []}
        activeBoardId={activeBoard?.id}
        switchingBoard={selectBoard.isPending}
        enabledModules={enabledModules}
        onSelectBoard={boardId => selectBoard.mutate({ boardId })}
        page={page}
        onNavigate={next => {
          setPage(next);
          setShowNav(false);
        }}
        open={showNav}
        close={() => setShowNav(false)}
      />
      <main className="app-main min-h-screen px-4 py-5 xl:mr-[272px] xl:px-9 xl:py-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 xl:hidden">
            <button
              onClick={() => setShowNav(true)}
              aria-label="فتح القائمة"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600"
            >
              <Menu className="size-5" />
            </button>
            <span className="font-semibold text-[#52769F]">أثر</span>
          </div>
          <div className="hidden xl:block">
            <p className="text-xs font-medium text-[#7C8A9A]">
              {workspaceName}
            </p>
            <p className="mt-1 text-sm text-[#52657A]">{headerDateText()}</p>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <NotificationCenter
              onOpenLink={link => {
                const target = new URL(link, window.location.origin);
                const nextPage = target.searchParams.get("view") as Page | null;
                const nextTaskId = Number(target.searchParams.get("taskId"));
                const nextProjectId = Number(
                  target.searchParams.get("projectId")
                );
                if (Number.isInteger(nextTaskId) && nextTaskId > 0)
                  setTaskId(nextTaskId);
                if (Number.isInteger(nextProjectId) && nextProjectId > 0)
                  setProjectId(nextProjectId);
                if (nextPage && validPages.includes(nextPage))
                  setPage(nextPage);
                window.history.replaceState(
                  {},
                  "",
                  target.pathname + target.search
                );
              }}
            />
            {enabledModules.includes("plan") && (
              <PeriodSelect value={period} onChange={goPeriod} />
            )}
            <Button
              variant="outline"
              onClick={() => setPresentation(true)}
              className="hidden h-9 gap-2 border-slate-200 bg-white px-3 text-xs text-[#52657A] md:inline-flex"
            >
              <Presentation className="size-4" />
              وضع العرض
            </Button>
          </div>
        </header>
        {page === "home" && <OverviewPage {...shared} />}
        {page === "plan" && <AnnualPlanPage {...shared} />}
        {page === "time" && <TemporalPage {...shared} />}
        {page === "projects" && <ProjectsPage {...shared} />}
        {page === "project" && (
          <ProjectDetailWithComments {...shared} projectId={projectId} />
        )}
        {page === "tasks" && <TasksPage {...shared} />}
        {page === "task" && <TaskDetailPage {...shared} taskId={taskId} />}
        {page === "team" && <TeamPageWithInvite {...shared} />}
        {page === "member" && <MemberDetail {...shared} memberId={memberId} />}
        {page === "launches" && <LaunchesPage {...shared} />}
        {page === "calendar" && <CalendarPage {...shared} />}
        {page === "feeds" && <ResearchFeedsPage {...shared} />}
        {page === "lessons" && <LessonsLearnedPage {...shared} />}
        {page === "reports" && <ReportsPage {...shared} />}
        {page === "mcp" && <McpPage />}
        {page === "settings" && (
          <SettingsPage board={activeBoard} accountRole={user.role} />
        )}
      </main>
      <TaskDrawer
        open={taskDrawer}
        setOpen={setTaskDrawer}
        data={data}
        submitting={createTask.isPending}
        initialProjectId={newTaskProjectId}
        onSubmit={(input: any, options: any) =>
          createTask.mutate(input, options)
        }
      />
      <ProjectDrawer
        open={projectDrawer}
        setOpen={setProjectDrawer}
        data={data}
        submitting={createProject.isPending}
        onSubmit={(input: any, options: any) =>
          createProject.mutate(input, options)
        }
      />
      <EditTaskDrawer
        task={editingTask}
        setTask={setEditingTask}
        data={data}
        submitting={editTaskMutation.isPending}
        onSubmit={(input: any) => editTaskMutation.mutate(input)}
      />
      <EditProjectDrawer
        project={editingProject}
        setProject={setEditingProject}
        data={data}
        submitting={editProjectMutation.isPending}
        onSubmit={(input: any) => editProjectMutation.mutate(input)}
      />
      <GoalDrawer
        open={goalDrawer}
        setOpen={setGoalDrawer}
        data={data}
        submitting={createGoal.isPending}
        onSubmit={(input: any, options: any) =>
          createGoal.mutate(input, options)
        }
      />
      <LessonDrawer
        open={lessonDrawer}
        setOpen={setLessonDrawer}
        data={data}
        submitting={createLesson.isPending}
        onSubmit={(input: any, options: any) =>
          createLesson.mutate(input, options)
        }
      />
      <InviteDrawer
        open={inviteDrawer}
        setOpen={setInviteDrawer}
        data={data}
        submitting={inviteMember.isPending}
        onSubmit={(input: any, options: any) =>
          inviteMember.mutate(input, options)
        }
      />
    </div>
  );
}

function Sidebar({
  workspaceName,
  user,
  membershipRole,
  boards,
  activeBoardId,
  switchingBoard,
  enabledModules,
  onSelectBoard,
  page,
  onNavigate,
  open,
  close,
}: {
  workspaceName: string;
  user: { name?: string | null; role?: string | null };
  membershipRole?: string;
  boards: { id: number; name: string; isActive: boolean }[];
  activeBoardId?: number;
  switchingBoard: boolean;
  enabledModules: BoardModule[];
  onSelectBoard: (boardId: number) => void;
  page: Page;
  onNavigate: (page: Page) => void;
  open: boolean;
  close: () => void;
}) {
  const userName = user.name?.trim() || "مستخدم أثر";
  const userInitials =
    userName
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join("") || "أ";
  const roleLabel =
    user.role === "admin"
      ? "مدير المنصة"
      : membershipRole === "manager"
        ? "مدير اللوحة"
        : membershipRole === "viewer"
          ? "مشاهد"
          : "عضو";
  const entries: {
    id: Page;
    label: string;
    icon: typeof LayoutDashboard;
    module?: BoardModule;
  }[] = [
    { id: "home", label: "الرئيسية", icon: LayoutDashboard },
    { id: "plan", label: "الخطة السنوية", icon: Target, module: "plan" },
    {
      id: "projects",
      label: "المشاريع",
      icon: FolderKanban,
      module: "projects",
    },
    { id: "tasks", label: "المهام", icon: ListChecks, module: "tasks" },
    { id: "team", label: "الفريق", icon: Users, module: "team" },
    {
      id: "feeds",
      label: "الخلاصات البحثية",
      icon: Rss,
      module: "feeds",
    },
    {
      id: "lessons",
      label: "الدروس المستفادة",
      icon: Lightbulb,
      module: "lessons",
    },
    {
      id: "launches",
      label: "الإطلاقات",
      icon: Rocket,
      module: "calendar",
    },
    {
      id: "calendar",
      label: "التقويم",
      icon: CalendarDays,
      module: "calendar",
    },
    { id: "reports", label: "التقارير", icon: BarChart3, module: "reports" },
  ];
  const visibleEntries = entries.filter(
    entry => !entry.module || enabledModules.includes(entry.module)
  );
  return (
    <>
      <div
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] xl:hidden",
          open ? "block" : "hidden"
        )}
      />
      <aside
        className={cn(
          "app-sidebar fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-[272px] flex-col overflow-hidden border-l border-slate-200 bg-white px-4 py-6 transition-transform duration-200 xl:w-[272px] xl:max-w-none xl:translate-x-0",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="mb-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#EDF4FA] text-[#52769F]">
              <Target className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight text-[#26364A]">
                أثر
              </p>
              <p className="max-w-36 truncate text-[11px] text-[#7C8A9A]">
                {workspaceName}
              </p>
            </div>
          </div>
          <button onClick={close} className="xl:hidden">
            <X className="size-5 text-slate-400" />
          </button>
        </div>
        <div className="mb-6 px-2">
          <label className="text-[10px] font-semibold text-[#7C8A9A]">
            اللوحة الحالية
            <span className="relative mt-2 flex items-center">
              <select
                value={activeBoardId ?? ""}
                disabled={switchingBoard}
                onChange={event => onSelectBoard(Number(event.target.value))}
                className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-[#FBFDFF] pr-3 pl-8 text-xs font-semibold text-[#52657A] outline-none transition focus:border-[#6C8FB8]"
                aria-label="اختيار لوحة العمل"
              >
                {boards.map(board => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2.5 size-4 text-slate-400" />
            </span>
          </label>
          {(user.role === "manager" || user.role === "admin") && (
            <button
              onClick={() => window.location.assign("/boards/new")}
              className="mt-2 flex w-full items-center gap-2 px-1 text-[11px] font-semibold text-[#52769F] hover:text-[#46698F]"
            >
              <Plus className="size-3.5" />
              إنشاء لوحة جديدة
            </button>
          )}
        </div>
        <div className="app-sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pb-2">
          <nav className="space-y-1">
            {visibleEntries.map(entry => {
              const active =
                page === entry.id || (entry.id === "plan" && page === "time");
              return (
                <button
                  key={entry.id}
                  onClick={() => onNavigate(entry.id)}
                  className={cn(
                    "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-right text-sm transition-colors",
                    active
                      ? "bg-[#EDF4FA] font-semibold text-[#52769F]"
                      : "text-[#647487] hover:bg-slate-50 hover:text-[#52657A]"
                  )}
                >
                  <entry.icon className="size-[18px]" />
                  {entry.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <PwaInstallButton
              compact
              comingSoon
              className="mb-2 h-10 w-full justify-start px-3 text-xs"
            />
            <button
              onClick={() => onNavigate("mcp")}
              className={cn(
                "mb-2 flex h-10 w-full items-center gap-2 rounded-lg border px-3 text-right text-xs transition-colors",
                page === "mcp"
                  ? "border-[#BFD3E7] bg-[#EDF4FA] font-semibold text-[#52769F]"
                  : "border-[#BFD3E7] bg-white text-[#45698F] hover:bg-slate-50"
              )}
            >
              <Link2 className="size-4" />
              ربط المساعد الذكي (MCP)
            </button>
            {user.role === "admin" && (
              <button
                onClick={() => window.location.assign("/admin")}
                className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#647487] hover:bg-slate-50"
              >
                <ShieldCheck className="size-[18px]" />
                إدارة المنصة
              </button>
            )}
            <button
              onClick={() => onNavigate("settings")}
              className={cn(
                "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm",
                page === "settings"
                  ? "bg-[#EDF4FA] font-semibold text-[#52769F]"
                  : "text-[#647487] hover:bg-slate-50"
              )}
            >
              <Settings className="size-[18px]" />
              الإعدادات
            </button>
            <div className="mt-5 flex items-center gap-2 px-3">
              <Avatar
                initials={userInitials}
                color="#52769F"
                className="size-8"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{userName}</p>
                <p className="text-[10px] text-[#7C8A9A]">{roleLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold text-[#6C8FB8]">{eyebrow}</p>
        )}
        <h1 className="break-words text-2xl font-bold tracking-tight text-[#26364A] md:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-[#7C8A9A]">{description}</p>
        )}
      </div>
      {action && (
        <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {action}
        </div>
      )}
    </div>
  );
}

function OverviewPage({
  data,
  user,
  setPage,
  openTaskDetail,
  period,
  openTask,
  completeTask,
}: any) {
  const [completionDetailsOpen, setCompletionDetailsOpen] = useState(false);
  const [myTasksPeriod, setMyTasksPeriod] = useState<MyTasksPeriod>("week");
  const currentMember = data.members.find(
    (member: any) => member.userId === user.id
  );
  const assignedToMe = currentMember
    ? data.tasks.filter(
        (task: any) => task.assigneeMemberId === currentMember.id
      )
    : [];
  const myTasks = (
    myTasksPeriod === "all"
      ? assignedToMe
      : filterTasksByCompletionPeriod<any>(
          assignedToMe,
          myTasksPeriod as CompletionPeriod
        )
  ).sort((a: any, b: any) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  const attentionReasonLabel = {
    due_soon: "اقترب الموعد النهائي",
    overdue: "متأخر",
    needs_support: "يحتاج دعم",
  } as const;
  const attention = sortTasksByPriority(
    data.tasks.filter((task: any) => getTaskAttentionReason(task))
  )
    .map((task: any) => ({
      ...task,
      reason: getTaskAttentionReason(task),
      assignee: data.members.find(
        (member: any) => member.id === task.assigneeMemberId
      ),
      project: data.projects.find(
        (project: any) => project.id === task.projectId
      ),
    }))
    .slice(0, 5);
  const allBlockedTasks = sortTasksByPriority(
    data.tasks.filter((task: any) => task.status === "blocked")
  );
  const blockedTasks = allBlockedTasks.slice(0, 5);
  const priorities = sortTasksByPriority(
    data.tasks.filter((task: any) => task.status !== "complete")
  ).slice(0, 5);
  const completion = calculatePeriodCompletion(data.tasks, period as Period);
  const completionTasks = filterTasksByCompletionPeriod<any>(
    data.tasks,
    period as Period
  ).sort(
    (a: any, b: any) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  return (
    <div className="entry max-w-5xl">
      <PageHeading
        eyebrow={periodLabels[period as Period]}
        title="وش يحتاج انتباهي الآن؟"
        description="نظرة مركزة على ما يحتاج قرارًا أو متابعة في هذه الفترة."
        action={
          <Button
            onClick={openTask}
            className="h-10 gap-2 bg-[#52769F] px-4 hover:bg-[#46698F]"
          >
            <Plus className="size-4" />
            مهمة جديدة
          </Button>
        }
      />
      <button
        type="button"
        onClick={() => setCompletionDetailsOpen(true)}
        aria-label={`عرض المهام المحسوبة في إنجاز ${periodLabels[period as Period]}`}
        className="group mb-9 block w-full max-w-xl rounded-xl border border-[#E8EEF5] bg-white px-5 py-4 text-right transition hover:border-[#BFD3E7] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6C8FB8]/20"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">
            إنجاز {periodLabels[period as Period]}
          </span>
          <span className="text-sm font-bold text-[#52769F]">
            {completion.total ? `${completion.percentage}%` : "—"}
          </span>
        </div>
        <Progress
          value={completion.percentage}
          className="h-2 bg-[#EDF4FA] [&>div]:bg-[#6C8FB8]"
        />
        <p className="mt-3 text-xs text-[#7C8A9A]">
          {completion.total
            ? `${completion.completed} من ${completion.total} مهمة مستحقة مكتملة خلال ${periodLabels[period as Period]}`
            : `لا توجد مهام مستحقة خلال ${periodLabels[period as Period]}`}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#52769F]">
          عرض المهام المحسوبة
          <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        </span>
      </button>
      <Sheet
        open={completionDetailsOpen}
        onOpenChange={setCompletionDetailsOpen}
      >
        <SheetContent
          side="left"
          dir="rtl"
          className="w-full overflow-y-auto sm:max-w-lg"
        >
          <SheetHeader className="border-b border-slate-100 text-right">
            <SheetTitle>
              مهام {periodLabels[period as Period]} المحسوبة
            </SheetTitle>
            <SheetDescription className="leading-6">
              تشمل كل مهمة يقع تاريخ استحقاقها داخل الفترة. المكتملة تدخل في
              البسط، وجميع المهام الظاهرة تدخل في إجمالي النسبة.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#EDF4FA] px-4 py-3">
                <p className="text-xs text-[#60758D]">إجمالي المهام</p>
                <p className="mt-1 text-xl font-bold text-[#52769F]">
                  {completion.total}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-700">المكتملة</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">
                  {completion.completed}
                </p>
              </div>
            </div>
            {completionTasks.length ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {completionTasks.map((task: any) => {
                  const assignee = data.members.find(
                    (member: any) => member.id === task.assigneeMemberId
                  );
                  const project = data.projects.find(
                    (item: any) => item.id === task.projectId
                  );
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        setCompletionDetailsOpen(false);
                        openTaskDetail(task.id);
                      }}
                      className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 text-right transition last:border-0 hover:bg-[#F8FAFC]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#26364A]">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#7C8A9A]">
                          {project?.title ?? "بدون مشروع"} ·{" "}
                          {assignee?.name ?? "غير مسند"}
                        </p>
                        <p className="mt-1 text-xs text-[#7C8A9A]">
                          الاستحقاق: {fullDateText(task.dueDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <StatusPill status={task.status} />
                        <ChevronLeft className="size-4 text-slate-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-5 py-12 text-center">
                <ListChecks className="mx-auto size-7 text-slate-300" />
                <p className="mt-3 text-sm text-[#7C8A9A]">
                  لا توجد مهام مستحقة خلال هذه الفترة.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[#26364A]">مهامي</h2>
            <p className="mt-1 text-xs text-[#7C8A9A]">
              المهام المسندة لك حسب تاريخ الاستحقاق.
            </p>
          </div>
          <div className="grid grid-cols-4 rounded-lg bg-[#F1F5F9] p-1">
            {(
              [
                ["day", "اليوم"],
                ["week", "هذا الأسبوع"],
                ["month", "هذا الشهر"],
                ["all", "الكل"],
              ] as [MyTasksPeriod, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMyTasksPeriod(value)}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] transition sm:px-3",
                  myTasksPeriod === value
                    ? "bg-white font-semibold text-[#40556D] shadow-sm"
                    : "text-[#7C8A9A]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {myTasks.length ? (
          <div className="divide-y divide-slate-100">
            {myTasks.map((task: any) => {
              const project = data.projects.find(
                (item: any) => item.id === task.projectId
              );
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openTaskDetail(task.id)}
                  className="flex w-full flex-col gap-3 px-5 py-4 text-right transition hover:bg-[#FBFCFE] sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#26364A]">
                      {task.title}
                    </p>
                    <p className="mt-1 text-xs text-[#7C8A9A]">
                      {project?.title ?? "بدون مشروع"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={task.status} />
                    <span className="text-xs text-[#7C8A9A]">
                      {task.dueDate
                        ? fullDateText(task.dueDate)
                        : "بدون موعد استحقاق"}
                    </span>
                    <ChevronLeft className="size-4 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <ListChecks className="mx-auto size-6 text-slate-300" />
            <p className="mt-3 text-sm text-[#7C8A9A]">
              {currentMember
                ? "لا توجد مهام مسندة لك في هذه الفترة."
                : "حسابك غير مرتبط بعضو في فريق هذه اللوحة."}
            </p>
          </div>
        )}
      </section>
      <div className="grid gap-5 lg:grid-cols-[1fr_.92fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle
            action={
              <span className="text-xs text-[#7C8A9A]">
                {attention.length} عناصر
              </span>
            }
          >
            يحتاج انتباهك
          </SectionTitle>
          <div className="divide-y divide-slate-100">
            {attention.length ? (
              attention.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => openTaskDetail(item.id)}
                  className="flex w-full items-center gap-3 py-3 text-right transition hover:bg-slate-50"
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      item.reason === "overdue"
                        ? "bg-rose-500"
                        : item.reason === "needs_support"
                          ? "bg-violet-500"
                          : "bg-amber-500"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#7C8A9A]">
                      <span>{item.assignee?.name ?? "غير مسند"}</span>
                      <span>·</span>
                      <span>{item.project?.title ?? "بدون مشروع"}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-medium",
                          item.reason === "overdue"
                            ? "bg-rose-50 text-rose-700"
                            : item.reason === "needs_support"
                              ? "bg-violet-50 text-violet-700"
                              : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {
                          attentionReasonLabel[
                            item.reason as keyof typeof attentionReasonLabel
                          ]
                        }
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-[#7C8A9A]">
                    {item.dueDate ? dateText(item.dueDate) : "بدون موعد"}
                  </span>
                </button>
              ))
            ) : (
              <EmptyState title="لا توجد عناصر حرجة الآن" />
            )}
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle
            action={
              <button
                onClick={() => setPage("tasks")}
                className="text-xs font-medium text-[#52769F]"
              >
                عرض الكل
              </button>
            }
          >
            أولويات هذا الأسبوع
          </SectionTitle>
          <div className="space-y-2">
            {priorities.map((task: any) => {
              const member = data.members.find(
                (item: any) => item.id === task.assigneeMemberId
              );
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-lg px-1 py-2"
                >
                  <button
                    onClick={() => completeTask(task.id, task.status)}
                    aria-label={
                      task.status === "complete"
                        ? `إلغاء إكمال ${task.title}`
                        : `إكمال ${task.title}`
                    }
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition",
                      task.status === "complete"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 text-transparent hover:border-[#6C8FB8]"
                    )}
                  >
                    <Check className="size-3" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        task.status === "complete" &&
                          "text-slate-400 line-through"
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#7C8A9A]">
                      {member?.name ?? "غير مسند"} · {dateText(task.dueDate)}
                    </p>
                  </div>
                  <StatusPill status={task.status} />
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle
          action={
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#7C8A9A]">
                {allBlockedTasks.length} مهام
              </span>
              <button
                type="button"
                onClick={() => setPage("tasks")}
                className="text-xs font-medium text-[#52769F]"
              >
                عرض كل المهام
              </button>
            </div>
          }
        >
          المهام المتوقفة
        </SectionTitle>
        {blockedTasks.length ? (
          <div className="divide-y divide-slate-100">
            {blockedTasks.map((task: any) => {
              const assignee = data.members.find(
                (member: any) => member.id === task.assigneeMemberId
              );
              const project = data.projects.find(
                (item: any) => item.id === task.projectId
              );
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openTaskDetail(task.id)}
                  className="flex w-full flex-col gap-3 py-3 text-right transition hover:bg-slate-50 sm:flex-row sm:items-center"
                >
                  <span className="size-2 shrink-0 rounded-full bg-rose-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-[#7C8A9A]">
                      {assignee?.name ?? "غير مسند"} ·{" "}
                      {project?.title ?? "بدون مشروع"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={task.status} />
                    <span className="text-xs text-[#7C8A9A]">
                      {task.dueDate ? dateText(task.dueDate) : "بدون موعد"}
                    </span>
                    <ChevronLeft className="size-4 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState title="لا توجد مهام متوقفة حاليًا" />
        )}
      </section>
      <div className="mt-5 rounded-xl border border-[#E5ECF3] bg-[#FDFEFF] px-5 py-4">
        <div className="flex items-center gap-3">
          <Clock3 className="size-4 text-[#6C8FB8]" />
          <p className="text-sm text-[#52657A]">
            <strong className="font-semibold text-[#26364A]">القادم:</strong>{" "}
            أضف المهام والمواعيد الفعلية لتظهر متابعتها هنا.
          </p>
        </div>
      </div>
    </div>
  );
}

function AnnualPlanPage({
  data,
  setPage,
  period,
  goPeriod,
  openGoal,
  canManagePlan,
}: any) {
  const quarters = [
    { q: "Q1", theme: "تأسيس الأولويات", progress: 100 },
    { q: "Q2", theme: "بناء الحلول", progress: 88 },
    { q: "Q3", theme: "التنفيذ والتسليم", progress: 67 },
    { q: "Q4", theme: "قياس الأثر", progress: 0 },
  ];
  const planProgress = data.goals.length
    ? Math.round(
        data.goals.reduce((sum: number, goal: any) => sum + goal.progress, 0) /
          data.goals.length
      )
    : 0;
  if (!data.goals.length)
    return (
      <div className="entry max-w-5xl">
        <PageHeading
          eyebrow="السنة"
          title="الخطة السنوية"
          description="هل نحن ماشيين حسب الخطة؟"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <PeriodSelect value={period} onChange={goPeriod} />
              {canManagePlan && (
                <Button
                  onClick={openGoal}
                  className="h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
                >
                  <Plus className="size-4" />
                  إضافة هدف
                </Button>
              )}
            </div>
          }
        />
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Target className="mx-auto size-7 text-[#6C8FB8]" />
          <h2 className="mt-3 font-semibold">ابدأ بإضافة أهداف القسم</h2>
          <p className="mt-2 text-sm text-[#7C8A9A]">
            ستظهر هنا خارطة العام ومؤشرات الإنجاز بعد إدخال أول هدف فعلي.
          </p>
          {canManagePlan ? (
            <Button
              onClick={openGoal}
              className="mt-5 h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
            >
              <Plus className="size-4" />
              إضافة أول هدف
            </Button>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              يستطيع مدير اللوحة إضافة أهداف الخطة السنوية.
            </p>
          )}
        </div>
      </div>
    );
  return (
    <div className="entry max-w-5xl">
      <PageHeading
        eyebrow="السنة"
        title="الخطة السنوية 2026"
        description="هل نحن ماشيين حسب الخطة؟"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelect value={period} onChange={goPeriod} />
            {canManagePlan && (
              <Button
                onClick={openGoal}
                className="h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
              >
                <Plus className="size-4" />
                هدف جديد
              </Button>
            )}
          </div>
        }
      />
      <section className="mb-8 max-w-xl rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">إنجاز الخطة</span>
          <span className="font-bold text-[#52769F]">{planProgress}%</span>
        </div>
        <Progress
          value={planProgress}
          className="h-2 bg-[#EDF4FA] [&>div]:bg-[#6C8FB8]"
        />
      </section>
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle>خارطة السنة</SectionTitle>
        <div className="grid gap-4 md:grid-cols-4">
          {quarters.map((quarter, index) => (
            <button
              key={quarter.q}
              onClick={() => {
                if (index === 2) {
                  goPeriod("quarter");
                  setPage("time");
                }
              }}
              className="group rounded-lg border border-slate-100 p-4 text-right transition hover:border-[#C9DBEC] hover:bg-[#FAFCFE]"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-bold tracking-wide text-[#6C8FB8]">
                  {quarter.q}
                </span>
                <span className="text-xs font-semibold text-[#52657A]">
                  {quarter.progress}%
                </span>
              </div>
              <p className="text-sm font-medium">{quarter.theme}</p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-[#6C8FB8]"
                  style={{ width: `${quarter.progress}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle>أهم أهداف السنة</SectionTitle>
        <div className="divide-y divide-slate-100">
          {data.goals.map((goal: any) => (
            <div key={goal.id} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{goal.title}</p>
                <p className="mt-1 text-xs text-[#7C8A9A]">{goal.theme}</p>
              </div>
              <span className="text-sm font-semibold text-[#52657A]">
                {goal.progress}%
              </span>
              <div className="w-20">
                <Progress
                  value={goal.progress}
                  className="h-1.5 bg-slate-100 [&>div]:bg-[#6C8FB8]"
                />
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 text-sm font-medium text-amber-700">
          <AlertTriangle className="ml-1 inline size-4" />٢ مخاطر تحتاج متابعة
        </button>
      </section>
    </div>
  );
}

function TemporalPage({
  data,
  period,
  goPeriod,
  setPage,
  setProjectId,
  completeTask,
}: any) {
  const referenceDate = new Date();
  const tasksInPeriod = filterTasksByCompletionPeriod<any>(
    data.tasks,
    period as Period,
    referenceDate
  );
  const upcoming = sortTasksByPriority(
    tasksInPeriod.filter((task: any) => task.status !== "complete")
  );
  const taskRows = upcoming.slice(0, 5);
  const heading =
    period === "quarter"
      ? "وش أهم شيء لازم ننجزه هذا الربع؟"
      : period === "month"
        ? "وش أهم التسليمات هذا الشهر؟"
        : period === "day"
          ? "وش لازم يخلص اليوم؟"
          : "وش لازم يخلص هذا الأسبوع؟";
  const label =
    period === "day"
      ? `اليوم — ${fullDateText(referenceDate)}`
      : periodLabels[period as Period];
  const completion = calculatePeriodCompletion(
    data.tasks,
    period as Period,
    referenceDate
  );
  if (period === "month")
    return <MonthView data={data} period={period} goPeriod={goPeriod} />;
  return (
    <div className="entry max-w-5xl">
      <PageHeading
        eyebrow={label}
        title={heading}
        action={<PeriodSelect value={period} onChange={goPeriod} />}
      />
      {period === "day" && (
        <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          <AlertTriangle className="size-4" />١ مهمة متأخرة
        </div>
      )}
      <section className="mb-6 max-w-xl rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex justify-between text-sm">
          <span className="font-semibold">
            إنجاز{" "}
            {period === "quarter"
              ? "الربع"
              : period === "day"
                ? "اليوم"
                : "الأسبوع"}
          </span>
          <strong className="text-[#52769F]">
            {completion.total ? `${completion.percentage}%` : "—"}
          </strong>
        </div>
        <Progress
          value={completion.percentage}
          className="h-2 bg-[#EDF4FA] [&>div]:bg-[#6C8FB8]"
        />
        <p className="mt-3 text-xs text-[#7C8A9A]">
          {completion.total
            ? `${completion.completed} من ${completion.total} مهمة مستحقة مكتملة`
            : `لا توجد مهام مستحقة خلال ${periodLabels[period as Period]}`}
        </p>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1fr_.65fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle>
            {period === "quarter"
              ? "أولويات الربع"
              : period === "day"
                ? "مهام اليوم"
                : "أولويات الأسبوع"}
          </SectionTitle>
          <div className="divide-y divide-slate-100">
            {taskRows.map((task: any) => {
              const member = data.members.find(
                (item: any) => item.id === task.assigneeMemberId
              );
              return (
                <div key={task.id} className="flex items-center gap-3 py-3">
                  <button
                    onClick={() => completeTask(task.id, task.status)}
                    aria-label={
                      task.status === "complete"
                        ? `إلغاء إكمال ${task.title}`
                        : `إكمال ${task.title}`
                    }
                    className={cn(
                      "flex size-5 items-center justify-center rounded-md border",
                      task.status === "complete"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 text-transparent hover:border-[#6C8FB8]"
                    )}
                  >
                    <Check className="size-3" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-[#7C8A9A]">
                      {member?.name} · {dateText(task.dueDate)}
                    </p>
                  </div>
                  <StatusPill status={task.status} />
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle>
            {period === "quarter" ? "المعالم القادمة" : "القادم"}
          </SectionTitle>
          <div className="space-y-4">
            {data.events.slice(0, 3).map((event: any) => (
              <div key={event.id} className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#6C8FB8]" />
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="mt-1 text-xs text-[#7C8A9A]">
                    {dateText(event.eventDate, false)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MonthView({ data, period, goPeriod }: any) {
  const weeks = ["الأسبوع ١", "الأسبوع ٢", "الأسبوع ٣", "الأسبوع ٤"];
  const mainDeliveries = data.events
    .filter((event: any) => event.type !== "meeting")
    .slice(0, 4);
  return (
    <div className="entry max-w-5xl">
      <PageHeading
        eyebrow="الشهر"
        title="أغسطس ٢٠٢٦"
        description="وش أهم التسليمات هذا الشهر؟"
        action={<PeriodSelect value={period} onChange={goPeriod} />}
      />
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle>تسليمات الشهر</SectionTitle>
        <div className="grid gap-3 md:grid-cols-4">
          {weeks.map((week, index) => (
            <div
              key={week}
              className="min-h-36 rounded-lg border border-slate-100 bg-[#FCFDFE] p-3"
            >
              <p className="mb-4 text-xs font-semibold text-[#7C8A9A]">
                {week}
              </p>
              {mainDeliveries[index] && (
                <div className="rounded-md border-r-2 border-[#6C8FB8] bg-[#EDF4FA]/60 px-2 py-2 text-xs leading-5 text-[#3E5C7D]">
                  {mainDeliveries[index].title}
                  <span className="mt-1 block text-[10px] text-[#7C8A9A]">
                    {dateText(mainDeliveries[index].eventDate)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="mt-5 max-w-2xl rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle>يحتاج انتباه هذا الشهر</SectionTitle>
        {data.projects
          .filter(
            (project: any) =>
              project.status === "blocked" || project.progress < 45
          )
          .slice(0, 3)
          .map((project: any) => (
            <div
              key={project.id}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm">{project.title}</span>
              <StatusPill status={project.status} project />
            </div>
          ))}
      </section>
    </div>
  );
}

function MobileTableFilters({
  activeCount,
  onClear,
  children,
}: {
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 shrink-0 gap-2 border-slate-200 bg-white px-3 text-[#52657A]"
      >
        <SlidersHorizontal className="size-4" />
        <span className="hidden sm:inline">تصفية</span>
        {activeCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-[#52769F] text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          dir="rtl"
          className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-slate-200 bg-[#F8FAFC] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="px-0 text-right">
            <SheetTitle>تصفية النتائج</SheetTitle>
            <SheetDescription>
              اختر القيم التي تريد ظهورها في القائمة.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3">{children}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClear}
              disabled={activeCount === 0}
              className="border-slate-200 bg-white"
            >
              مسح الفلاتر
            </Button>
            <Button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-[#52769F] hover:bg-[#46698F]"
            >
              عرض النتائج
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ProjectsPage({
  data,
  setPage,
  setProjectId,
  openProject,
  editProject,
  deleteProject,
  canEditWork,
}: any) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [responsible, setResponsible] = useState("all");
  const projects = data.projects.filter(
    (project: any) =>
      project.title.includes(query) &&
      (status === "all" || project.status === status) &&
      (responsible === "all" ||
        projectResponsibles(project, data.members).some(
          (member: any) => member.id === Number(responsible)
        ))
  );
  return (
    <div className="entry">
      <PageHeading
        title="المشاريع"
        description="وين وصل كل مشروع؟"
        action={
          <Button
            onClick={openProject}
            className="h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
          >
            <Plus className="size-4" />
            مشروع جديد
          </Button>
        }
      />
      <div className="mb-5 flex gap-2">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute right-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث عن مشروع"
            className="h-9 border-slate-200 bg-white pr-9"
          />
        </div>
        <div className="lg:hidden">
          <MobileTableFilters
            activeCount={
              Number(status !== "all") + Number(responsible !== "all")
            }
            onClear={() => {
              setStatus("all");
              setResponsible("all");
            }}
          >
            <label className="grid gap-1.5 text-sm font-medium text-[#52657A]">
              الحالة
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal"
              >
                <option value="all">كل الحالات</option>
                {Object.entries(projectStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-[#52657A]">
              المسؤول
              <select
                value={responsible}
                onChange={e => setResponsible(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal"
              >
                <option value="all">كل المسؤولين</option>
                {data.members.map((member: any) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </MobileTableFilters>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="responsive-data-table w-full min-w-[720px] text-right">
            <thead className="border-b border-slate-100 bg-[#FCFDFE] text-[11px] font-medium text-[#7C8A9A]">
              <tr>
                <th className="px-5 py-3.5">المشروع</th>
                <th className="px-5 py-3.5">
                  <div className="grid min-w-36 gap-1.5">
                    <span>المسؤولون</span>
                    <select
                      value={responsible}
                      onChange={e => setResponsible(e.target.value)}
                      aria-label="تصفية المشاريع حسب المسؤول"
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-[#52657A]"
                    >
                      <option value="all">كل المسؤولين</option>
                      {data.members.map((member: any) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-5 py-3.5">
                  <div className="grid min-w-32 gap-1.5">
                    <span>الحالة</span>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                      aria-label="تصفية المشاريع حسب الحالة"
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-[#52657A]"
                    >
                      <option value="all">كل الحالات</option>
                      {Object.entries(projectStatusLabel).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </th>
                <th className="px-5 py-3.5">التقدم</th>
                <th className="px-5 py-3.5">الموعد</th>
                <th className="px-5 py-3.5">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project: any) => {
                const responsibles = projectResponsibles(project, data.members);
                const responsibleNames = responsibles
                  .map((member: any) => member.name)
                  .join("، ");
                return (
                  <tr
                    key={project.id}
                    onClick={() => {
                      setProjectId(project.id);
                      setPage("project");
                    }}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-[#FBFCFE]"
                  >
                    <td
                      data-mobile-primary
                      data-label="المشروع"
                      className="px-5 py-4"
                    >
                      <p className="text-sm font-medium">{project.title}</p>
                      <p className="mt-1 max-w-60 truncate text-xs text-[#7C8A9A]">
                        {project.summary}
                      </p>
                    </td>
                    <td data-label="المسؤولون" className="px-5 py-4">
                      <div
                        className="flex items-center gap-2"
                        title={responsibleNames}
                      >
                        <div className="flex -space-x-1.5 space-x-reverse">
                          {responsibles.slice(0, 3).map((member: any) => (
                            <Avatar
                              key={member.id}
                              initials={member.avatarInitials}
                              color={member.color}
                              className="size-6 border-2 border-white text-[8px]"
                            />
                          ))}
                        </div>
                        <span className="max-w-40 truncate text-xs">
                          {responsibleNames || "غير مسند"}
                        </span>
                        {responsibles.length > 3 && (
                          <span className="text-[10px] text-[#7C8A9A]">
                            +{responsibles.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="الحالة" className="px-5 py-4">
                      <StatusPill status={project.status} project />
                    </td>
                    <td data-label="التقدم" className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#52657A]">
                          {project.progress}%
                        </span>
                        <Progress
                          value={project.progress}
                          className="h-1.5 w-16 bg-slate-100 [&>div]:bg-[#6C8FB8]"
                        />
                      </div>
                    </td>
                    <td
                      data-label="الموعد"
                      className="px-5 py-4 text-xs text-[#7C8A9A]"
                    >
                      {project.endDate ? dateText(project.endDate) : "مستمر"}
                    </td>
                    <td
                      data-mobile-actions
                      data-label="الإجراءات"
                      className="px-5 py-4"
                      onClick={event => event.stopPropagation()}
                    >
                      {canEditWork ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => editProject(project)}
                            aria-label={`تعديل ${project.title}`}
                            className="rounded-md p-2 text-[#647487] hover:bg-[#EDF4FA] hover:text-[#52769F]"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <DeleteWorkDialog
                            kind="المشروع"
                            title={project.title}
                            description="سيُحذف المشروع مع مهامه ومخرجاته ودروسه ومواعيده المرتبطة. لا يمكن التراجع عن هذا الإجراء."
                            onConfirm={() => deleteProject(project.id)}
                          />
                        </div>
                      ) : (
                        <ChevronLeft className="size-4 text-slate-400" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {!projects.length && (
                <tr>
                  <td
                    data-mobile-empty
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-[#7C8A9A]"
                  >
                    لا توجد مشاريع مطابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({
  data,
  projectId,
  setPage,
  openTask,
  openTaskDetail,
  editProject,
  deleteProject,
  canEditWork,
}: any) {
  const project =
    data.projects.find((item: any) => item.id === projectId) ??
    data.projects[0];
  const responsibles = projectResponsibles(project, data.members);
  const outputs = data.deliverables.filter(
    (item: any) => item.projectId === project.id
  );
  const linkedTasks = data.tasks.filter(
    (item: any) => item.projectId === project.id
  );
  const [tab, setTab] = useState("work");
  return (
    <div className="entry max-w-5xl">
      <button
        onClick={() => setPage("projects")}
        className="mb-5 flex items-center gap-1 text-sm text-[#647487] hover:text-[#52769F]"
      >
        <ArrowRight className="size-4" />
        كل المشاريع
      </button>
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start">
        <div>
          <p className="mb-2 text-xs font-semibold text-[#6C8FB8]">مشروع</p>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#7C8A9A]">
            {project.summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditWork && (
            <>
              <Button
                variant="outline"
                onClick={() => editProject(project)}
                className="h-9 gap-2 border-slate-200 bg-white text-[#52657A]"
              >
                <Pencil className="size-4" />
                تعديل
              </Button>
              <DeleteWorkDialog
                kind="المشروع"
                title={project.title}
                description="سيُحذف المشروع مع مهامه ومخرجاته ودروسه ومواعيده المرتبطة. لا يمكن التراجع عن هذا الإجراء."
                onConfirm={() => deleteProject(project.id)}
                showLabel
              />
            </>
          )}
          <Button
            onClick={() => openTask(project.id)}
            className="h-9 gap-2 bg-[#52769F] hover:bg-[#46698F]"
          >
            <Plus className="size-4" />
            إضافة مهمة
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[#7C8A9A]">المسؤولون:</span>
          <div className="flex -space-x-1.5 space-x-reverse">
            {responsibles.map((member: any) => (
              <Avatar
                key={member.id}
                initials={member.avatarInitials}
                color={member.color}
                className="size-7 border-2 border-white text-[9px]"
              />
            ))}
          </div>
          <span>
            {responsibles.map((member: any) => member.name).join("، ")}
          </span>
        </div>
        <span className="text-[#7C8A9A]">
          {project.endDate ? "الموعد:" : "المدة:"}{" "}
          <b className="mr-1 font-medium text-[#52657A]">
            {project.endDate ? dateText(project.endDate, false) : "مشروع مستمر"}
          </b>
        </span>
        <span className="text-[#7C8A9A]">
          التقدم:{" "}
          <b className="mr-1 font-medium text-[#52657A]">{project.progress}%</b>
        </span>
        <StatusPill status={project.status} project />
      </div>
      <div className="mt-8 flex gap-5 border-b border-slate-200">
        <button
          onClick={() => setTab("work")}
          className={cn(
            "border-b-2 px-1 pb-3 text-sm",
            tab === "work"
              ? "border-[#6C8FB8] font-semibold text-[#52769F]"
              : "border-transparent text-[#7C8A9A]"
          )}
        >
          العمل
        </button>
        <button
          onClick={() => setTab("activity")}
          className={cn(
            "border-b-2 px-1 pb-3 text-sm",
            tab === "activity"
              ? "border-[#6C8FB8] font-semibold text-[#52769F]"
              : "border-transparent text-[#7C8A9A]"
          )}
        >
          النشاط والملفات
        </button>
      </div>
      {tab === "work" ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionTitle>المخرجات</SectionTitle>
            <div className="space-y-1">
              {outputs.map((output: any) => (
                <div
                  key={output.id}
                  className="flex items-center gap-3 rounded-lg py-2.5"
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full",
                      output.status === "complete"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                    )}
                  >
                    <Check className="size-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{output.title}</p>
                    <p className="text-[11px] text-[#7C8A9A]">
                      {dateText(output.dueDate)}
                    </p>
                  </div>
                  <span className="text-xs text-[#52657A]">
                    {output.progress}%
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionTitle>المهام</SectionTitle>
            <div className="space-y-1">
              {linkedTasks.slice(0, 6).map((task: any) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openTaskDetail(task.id)}
                  className="flex w-full items-center justify-between rounded-lg py-2.5 text-right hover:bg-slate-50"
                >
                  <p className="text-sm">{task.title}</p>
                  <StatusPill status={task.status} />
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-[#7C8A9A]">
          تظهر هنا الملفات والتعليقات والنشاط المرتبط بالمشروع عند إضافتها.
        </div>
      )}
    </div>
  );
}

function ProjectDetailWithComments({
  data,
  projectId,
  user,
  updateProjectStatus,
  ...projectProps
}: any) {
  const project =
    data.projects.find((item: any) => item.id === projectId) ??
    data.projects[0];
  const outputs = data.deliverables.filter(
    (item: any) => item.projectId === project.id
  );
  const [deliverableId, setDeliverableId] = useState(outputs[0]?.id ?? 0);
  const [body, setBody] = useState("");
  const utils = trpc.useUtils();
  const addComment = trpc.workspace.addDeliverableComment.useMutation({
    onSuccess: () => {
      utils.workspace.overview.invalidate();
      setBody("");
      toast.success("تمت إضافة ملاحظة المدير على التسليم");
    },
  });
  const comments = (data.deliverableComments ?? []).filter(
    (comment: any) => comment.deliverableId === Number(deliverableId)
  );
  const canComment = Boolean(
    user &&
      projectProps.canEditWork &&
      (user.role === "admin" ||
        data.members.some((member: any) => member.userId === user.id))
  );
  return (
    <>
      <ProjectDetail data={data} projectId={projectId} {...projectProps} />
      {canComment && (
        <section className="entry mt-5 max-w-5xl rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold">حالة المشروع</h2>
              <p className="mt-1 text-xs text-[#7C8A9A]">
                يستطيع أي عضو فريق تحديث حالة العمل الجماعية.
              </p>
            </div>
            <select
              aria-label="تحديث حالة المشروع"
              value={project.status}
              onChange={event =>
                updateProjectStatus(
                  project.id,
                  event.target.value as ProjectStatus
                )
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[#52657A]"
            >
              {Object.entries(projectStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}
      <section className="entry mt-5 max-w-5xl rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">
              ملاحظات الفريق على التسليمات
            </h2>
            <p className="mt-1 text-xs text-[#7C8A9A]">
              تظهر الملاحظات للموظف المسؤول ضمن متابعة التسليم.
            </p>
          </div>
          <select
            value={deliverableId}
            onChange={event => setDeliverableId(Number(event.target.value))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[#52657A]"
          >
            {outputs.map((output: any) => (
              <option key={output.id} value={output.id}>
                {output.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          {comments.length ? (
            comments.map((comment: any) => (
              <div
                key={comment.id}
                className="rounded-lg bg-[#F7F9FC] px-4 py-3"
              >
                <p className="text-sm leading-6 text-[#52657A]">
                  {comment.body}
                </p>
                <p className="mt-2 text-[11px] text-[#7C8A9A]">
                  {comment.authorName} · {dateText(comment.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-[#7C8A9A]">
              لا توجد ملاحظات على هذا التسليم بعد.
            </p>
          )}
        </div>
        {canComment && (
          <form
            onSubmit={event => {
              event.preventDefault();
              if (!body.trim() || !deliverableId) return;
              addComment.mutate({ deliverableId: Number(deliverableId), body });
            }}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={body}
              onChange={event => setBody(event.target.value)}
              placeholder="أضف ملاحظة أو طلب تعديل على التسليم..."
              className="h-10 flex-1 border-slate-200"
            />
            <Button
              disabled={addComment.isPending}
              type="submit"
              className="h-10 bg-[#52769F] hover:bg-[#46698F]"
            >
              {addComment.isPending ? "جارٍ الإضافة..." : "إضافة ملاحظة"}
            </Button>
          </form>
        )}
      </section>
    </>
  );
}

function TaskDetailPage({
  data,
  user,
  taskId,
  setPage,
  completeTask,
  updateTaskStatus,
  editTask,
  deleteTask,
  canEditWork,
  canModerateComments,
}: any) {
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingComment, setEditingComment] = useState<any>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const task =
    data.tasks.find((item: any) => item.id === taskId) ?? data.tasks[0];
  const [supportEnabled, setSupportEnabled] = useState(
    Boolean(task?.needsSupport)
  );
  const [supportRequest, setSupportRequest] = useState(
    task?.supportRequest ?? ""
  );
  const utils = trpc.useUtils();
  const addComment = trpc.workspace.addTaskComment.useMutation({
    onSuccess: async () => {
      await utils.workspace.overview.invalidate();
      setBody("");
      setReplyingTo(null);
      toast.success("تمت إضافة التعليق");
    },
    onError: issue => toast.error(issue.message),
  });
  const updateComment = trpc.workspace.updateTaskComment.useMutation({
    onSuccess: async () => {
      await utils.workspace.overview.invalidate();
      setEditingComment(null);
      setEditingCommentBody("");
      toast.success("تم تعديل التعليق");
    },
    onError: issue => toast.error(issue.message),
  });
  const updateSupport = trpc.workspace.updateTaskSupport.useMutation({
    onSuccess: async () => {
      await utils.workspace.overview.invalidate();
      toast.success(
        supportEnabled ? "تم إرسال طلب الدعم" : "تم إغلاق طلب الدعم"
      );
    },
    onError: issue => toast.error(issue.message),
  });
  useEffect(() => {
    setSupportEnabled(Boolean(task?.needsSupport));
    setSupportRequest(task?.supportRequest ?? "");
  }, [task?.id, task?.needsSupport, task?.supportRequest]);
  const requestedCommentId = Number(
    new URLSearchParams(window.location.search).get("commentId")
  );
  useEffect(() => {
    if (!Number.isInteger(requestedCommentId) || requestedCommentId <= 0)
      return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`task-comment-${requestedCommentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [requestedCommentId, task?.id]);
  if (!task)
    return (
      <div className="entry max-w-5xl">
        <button
          onClick={() => setPage("tasks")}
          className="mb-5 flex items-center gap-1 text-sm text-[#647487] hover:text-[#52769F]"
        >
          <ArrowRight className="size-4" />
          كل المهام
        </button>
        <EmptyState title="لا توجد مهمة لعرضها" />
      </div>
    );
  const project = data.projects.find((item: any) => item.id === task.projectId);
  const assignee = data.members.find(
    (item: any) => item.id === task.assigneeMemberId
  );
  const comments = (data.taskComments ?? []).filter(
    (comment: any) => comment.taskId === task.id
  );
  return (
    <div className="entry max-w-5xl">
      <button
        onClick={() => setPage("tasks")}
        className="mb-5 flex items-center gap-1 text-sm text-[#647487] hover:text-[#52769F]"
      >
        <ArrowRight className="size-4" />
        كل المهام
      </button>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#6C8FB8]">مهمة</span>
              <PriorityPill priority={task.priority} />
              <StatusPill status={task.status} />
              {task.needsSupport && <SupportPill />}
            </div>
            <h1 className="text-2xl font-bold leading-9">{task.title}</h1>
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-[#647487]">
              {task.description?.trim() || "لم يُضف وصف لهذه المهمة بعد."}
            </p>
          </div>
          {canEditWork && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => editTask(task)}
                className="h-9 gap-2 border-slate-200"
              >
                <Pencil className="size-4" />
                تعديل
              </Button>
              <DeleteWorkDialog
                kind="المهمة"
                title={task.title}
                description="سيُحذف سجل المهمة وتعليقاتها نهائيًا. لا يمكن التراجع عن هذا الإجراء."
                onConfirm={() => {
                  deleteTask(task.id);
                  setPage("tasks");
                }}
                showLabel
              />
            </div>
          )}
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["المشروع", project?.title ?? "غير مرتبط"],
            ["المسؤول", assignee?.name ?? "غير مسند"],
            [
              "تاريخ البداية",
              task.startDate ? fullDateText(task.startDate) : "غير محدد",
            ],
            [
              "الموعد النهائي",
              task.dueDate ? fullDateText(task.dueDate) : "غير محدد",
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[#F7F9FC] px-4 py-3">
              <p className="text-[11px] text-[#7C8A9A]">{label}</p>
              <p className="mt-1 text-sm font-medium text-[#40556D]">{value}</p>
            </div>
          ))}
        </div>
        {canEditWork && (
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-[#FBFDFF] p-4 sm:flex-row sm:items-end">
            <Field label="تحديث الحالة">
              <select
                value={task.status}
                onChange={event =>
                  updateTaskStatus(task.id, event.target.value as TaskStatus)
                }
                className="form-select min-w-44"
              >
                {Object.entries(taskStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => completeTask(task.id, task.status)}
              className="h-10 gap-2 border-slate-200 bg-white"
            >
              {task.status === "complete" ? (
                <RotateCcw className="size-4" />
              ) : (
                <Check className="size-4" />
              )}
              {task.status === "complete" ? "إلغاء الإكمال" : "تحديد كمكتملة"}
            </Button>
          </div>
        )}
      </section>
      <section className="mt-5 rounded-xl border border-violet-100 bg-white p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[#26364A]">
              <CircleHelp className="size-4 text-violet-600" />
              طلب دعم للمهمة
            </h2>
            <p className="mt-1 text-xs leading-6 text-[#7C8A9A]">
              فعّل العلامة واكتب ما يحتاجه صاحب المهمة ليظهر الطلب للفريق في
              تبويب «تحتاج دعم».
            </p>
          </div>
          {canEditWork ? (
            <Switch
              checked={supportEnabled}
              onCheckedChange={setSupportEnabled}
              aria-label="تحديد أن المهمة تحتاج دعم"
            />
          ) : (
            task.needsSupport && <SupportPill />
          )}
        </div>
        {canEditWork && (
          <form
            onSubmit={event => {
              event.preventDefault();
              if (supportEnabled && !supportRequest.trim())
                return toast.error("اكتب نوع الدعم المطلوب");
              updateSupport.mutate({
                id: task.id,
                needsSupport: supportEnabled,
                supportRequest: supportEnabled ? supportRequest.trim() : "",
              });
            }}
            className="mt-4"
          >
            {supportEnabled && (
              <textarea
                autoFocus
                value={supportRequest}
                onChange={event => setSupportRequest(event.target.value)}
                placeholder="مثال: أحتاج مراجعة المحتوى من الفريق القانوني قبل الاعتماد"
                className="min-h-24 w-full rounded-lg border border-violet-100 bg-violet-50/30 px-3 py-2 text-sm outline-none focus:border-violet-300"
              />
            )}
            <Button
              disabled={
                updateSupport.isPending ||
                (supportEnabled && !supportRequest.trim())
              }
              type="submit"
              className="mt-3 h-10 bg-violet-600 hover:bg-violet-700"
            >
              {updateSupport.isPending
                ? "جارٍ الحفظ..."
                : supportEnabled
                  ? "حفظ طلب الدعم"
                  : "إغلاق طلب الدعم"}
            </Button>
          </form>
        )}
        {!canEditWork && task.needsSupport && task.supportRequest && (
          <p className="mt-4 rounded-lg bg-violet-50 px-4 py-3 text-sm leading-7 text-violet-800">
            {task.supportRequest}
          </p>
        )}
      </section>
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        <SectionTitle
          action={
            <span className="text-xs text-[#7C8A9A]">
              {comments.length} تعليق
            </span>
          }
        >
          تعليقات المهمة
        </SectionTitle>
        <div className="space-y-3">
          {comments.length ? (
            comments.map((comment: any) => (
              <article
                key={comment.id}
                id={`task-comment-${comment.id}`}
                className={cn(
                  "rounded-lg border border-slate-100 bg-[#F9FBFD] px-4 py-3 scroll-mt-6",
                  requestedCommentId === comment.id &&
                    "border-[#8EACCB] ring-2 ring-[#DCE8F3]"
                )}
              >
                {comment.replyToCommentId && (
                  <p className="mb-2 text-[10px] font-semibold text-[#6C8FB8]">
                    رد على تعليق سابق
                  </p>
                )}
                {editingComment?.id === comment.id ? (
                  <form
                    onSubmit={event => {
                      event.preventDefault();
                      if (!editingCommentBody.trim())
                        return toast.error("لا يمكن حفظ تعليق فارغ");
                      updateComment.mutate({
                        id: comment.id,
                        body: editingCommentBody.trim(),
                      });
                    }}
                  >
                    <textarea
                      autoFocus
                      value={editingCommentBody}
                      onChange={event =>
                        setEditingCommentBody(event.target.value)
                      }
                      className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#6C8FB8]"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="submit"
                        disabled={
                          updateComment.isPending || !editingCommentBody.trim()
                        }
                        className="h-8 bg-[#52769F] px-3 text-xs hover:bg-[#46698F]"
                      >
                        {updateComment.isPending
                          ? "جارٍ الحفظ..."
                          : "حفظ التعليق"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updateComment.isPending}
                        onClick={() => {
                          setEditingComment(null);
                          setEditingCommentBody("");
                        }}
                        className="h-8 px-3 text-xs"
                      >
                        إلغاء
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#40556D]">
                    {comment.body}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-[#7C8A9A]">
                  {comment.authorName} · {fullDateText(comment.createdAt)}
                </p>
                {canEditWork && editingComment?.id !== comment.id && (
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setReplyingTo(comment)}
                      className="text-[11px] font-semibold text-[#52769F]"
                    >
                      رد
                    </button>
                    {(comment.authorUserId === user?.id ||
                      canModerateComments) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingComment(comment);
                          setEditingCommentBody(comment.body);
                        }}
                        className="text-[11px] font-semibold text-[#52769F]"
                      >
                        تعديل
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-[#7C8A9A]">
              لا توجد تعليقات على هذه المهمة بعد.
            </p>
          )}
        </div>
        {canEditWork && (
          <form
            onSubmit={event => {
              event.preventDefault();
              if (!body.trim()) return;
              addComment.mutate({
                taskId: task.id,
                body: body.trim(),
                replyToCommentId: replyingTo?.id ?? null,
              });
            }}
            className="mt-4"
          >
            {replyingTo && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-[#EDF4FA] px-3 py-2 text-xs text-[#52657A]">
                <span>رد على {replyingTo.authorName}</span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  aria-label="إلغاء الرد"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
            <textarea
              value={body}
              onChange={event => setBody(event.target.value)}
              placeholder="اكتب تعليقًا، وللإشارة إلى عضو اكتب @ ثم اسمه الكامل أو بريده..."
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#6C8FB8]"
            />
            <Button
              disabled={addComment.isPending || !body.trim()}
              type="submit"
              className="mt-2 h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
            >
              <Send className="size-4" />
              {addComment.isPending ? "جارٍ الإضافة..." : "إضافة تعليق"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

function TeamPageWithInvite({
  openInvite,
  canManageTeam,
  user,
  ...props
}: any) {
  const utils = trpc.useUtils();
  const [reissuedInviteUrl, setReissuedInviteUrl] = useState("");
  const { data: administration } = trpc.workspace.teamAdministration.useQuery(
    undefined,
    {
      enabled: canManageTeam,
    }
  );
  const updateAccess = trpc.workspace.updateTeamMemberAccess.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.workspace.teamAdministration.invalidate(),
        utils.workspace.overview.invalidate(),
      ]);
      toast.success("تم تحديث صلاحية العضو");
    },
    onError: issue => toast.error(issue.message),
  });
  const updateProjectAccess =
    trpc.workspace.updateTeamMemberProjectAccess.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.workspace.teamAdministration.invalidate(),
          utils.workspace.overview.invalidate(),
        ]);
        toast.success("تم تحديث المشاريع المتاحة للعضو");
      },
      onError: issue => toast.error(issue.message),
    });
  const setActive = trpc.workspace.setTeamMemberActive.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.workspace.teamAdministration.invalidate(),
        utils.workspace.overview.invalidate(),
      ]);
      toast.success("تم تحديث وصول العضو");
    },
    onError: issue => toast.error(issue.message),
  });
  const reissueInvitation = trpc.workspace.reissueTeamInvitation.useMutation({
    onSuccess: async result => {
      await utils.workspace.teamAdministration.invalidate();
      setReissuedInviteUrl(`${window.location.origin}${result.invitePath}`);
      toast.success("تم إنشاء رابط دعوة جديد");
    },
    onError: issue => toast.error(issue.message),
  });
  const deleteMember = trpc.workspace.deleteTeamMember.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.workspace.teamAdministration.invalidate(),
        utils.workspace.overview.invalidate(),
      ]);
      setReissuedInviteUrl("");
      toast.success("تم حذف العضو من الفريق");
    },
    onError: issue => toast.error(issue.message),
  });
  return (
    <TeamPage
      {...props}
      user={user}
      openInvite={openInvite}
      canManageTeam={canManageTeam}
      administration={administration}
      updating={
        updateAccess.isPending ||
        updateProjectAccess.isPending ||
        setActive.isPending ||
        reissueInvitation.isPending ||
        deleteMember.isPending
      }
      reissuedInviteUrl={reissuedInviteUrl}
      clearReissuedInvite={() => setReissuedInviteUrl("")}
      updateAccess={(memberId: number, accessRole: string) =>
        updateAccess.mutate({
          memberId,
          accessRole: accessRole as "manager" | "member" | "viewer",
        })
      }
      updateProjectAccess={(
        memberId: number,
        projectAccess: "all" | "selected",
        allowedProjectIds: number[]
      ) =>
        updateProjectAccess.mutate({
          memberId,
          projectAccess,
          allowedProjectIds,
        })
      }
      setActive={(memberId: number, active: boolean) =>
        setActive.mutate({ memberId, active })
      }
      reissueInvitation={(memberId: number) =>
        reissueInvitation.mutate({ memberId })
      }
      deleteMember={(memberId: number) => deleteMember.mutate({ memberId })}
    />
  );
}

function TasksPage({
  data,
  openTask,
  completeTask,
  assignTask,
  openTaskDetail,
  updateTaskStatus,
  editTask,
  deleteTask,
  canEditWork,
}: any) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "support">("all");
  const [state, setState] = useState("all");
  const [project, setProject] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [due, setDue] = useState<TaskDueFilter>("all");
  const supportCount = data.tasks.filter(
    (task: any) => task.needsSupport
  ).length;
  const list = sortTasksByPriority(
    data.tasks.filter(
      (task: any) =>
        task.title.includes(query) &&
        (scope === "all" || task.needsSupport) &&
        (state === "all" || task.status === state) &&
        (priority === "all" || task.priority === priority) &&
        matchesTaskDueFilter(task, due) &&
        (project === "all" ||
          (project === "none"
            ? !task.projectId
            : task.projectId === Number(project))) &&
        (assignee === "all" ||
          (assignee === "none"
            ? !task.assigneeMemberId
            : task.assigneeMemberId === Number(assignee)))
    )
  );
  return (
    <div className="entry">
      <PageHeading
        title="المهام"
        description="وش كل الأعمال المسندة حاليًا؟"
        action={
          <Button
            onClick={openTask}
            className="h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
          >
            <Plus className="size-4" />
            مهمة جديدة
          </Button>
        }
      />
      <div className="mb-5 flex w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-fit">
        <button
          type="button"
          onClick={() => setScope("all")}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm transition sm:flex-none sm:px-4",
            scope === "all"
              ? "bg-[#EDF4FA] font-semibold text-[#46698F]"
              : "text-[#647487] hover:bg-slate-50"
          )}
        >
          كل المهام
        </button>
        <button
          type="button"
          onClick={() => setScope("support")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition sm:flex-none sm:px-4",
            scope === "support"
              ? "bg-violet-50 font-semibold text-violet-700"
              : "text-[#647487] hover:bg-slate-50"
          )}
        >
          <CircleHelp className="size-4" />
          تحتاج دعم
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] ring-1 ring-slate-200">
            {supportCount}
          </span>
        </button>
      </div>
      <div className="mb-5 flex gap-2">
        <div className="relative w-full min-w-0 flex-1 sm:min-w-52">
          <Search className="absolute right-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث عن مهمة"
            className="h-9 border-slate-200 bg-white pr-9"
          />
        </div>
        <div className="lg:hidden">
          <MobileTableFilters
            activeCount={
              Number(state !== "all") +
              Number(assignee !== "all") +
              Number(project !== "all") +
              Number(priority !== "all") +
              Number(due !== "all")
            }
            onClear={() => {
              setState("all");
              setAssignee("all");
              setProject("all");
              setPriority("all");
              setDue("all");
            }}
          >
            <label className="grid gap-1.5 text-sm font-medium text-[#52657A]">
              المسؤول
              <select
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal"
              >
                <option value="all">كل المسؤولين</option>
                <option value="none">غير مسندة</option>
                {data.members.map((member: any) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-[#52657A]">
              المشروع
              <select
                value={project}
                onChange={e => setProject(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal"
              >
                <option value="all">كل المشاريع</option>
                <option value="none">بدون مشروع</option>
                {data.projects.map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-[#52657A]">
              الأولوية
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal"
              >
                <option value="all">كل الأولويات</option>
                {Object.entries(priorityLabel).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-[#52657A]">
              الموعد
              <select
                value={due}
                onChange={e => setDue(e.target.value as TaskDueFilter)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal"
              >
                <option value="all">كل المواعيد</option>
                <option value="overdue">متأخرة</option>
                <option value="today">اليوم</option>
                <option value="week">هذا الأسبوع</option>
                <option value="upcoming">قادمة</option>
                <option value="none">بدون موعد</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-[#52657A]">
              الحالة
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal"
              >
                <option value="all">كل الحالات</option>
                {Object.entries(taskStatusLabel).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </MobileTableFilters>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="responsive-data-table w-full min-w-[760px] text-right">
            <thead className="border-b border-slate-100 bg-[#FCFDFE] text-[11px] text-[#7C8A9A]">
              <tr>
                <th className="w-12 px-4 py-3" />
                <th className="px-4 py-3">المهمة</th>
                <th className="px-4 py-3">
                  <div className="grid min-w-32 gap-1.5">
                    <span>المسؤول</span>
                    <select
                      value={assignee}
                      onChange={e => setAssignee(e.target.value)}
                      aria-label="تصفية المهام حسب المسؤول"
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-[#52657A]"
                    >
                      <option value="all">كل المسؤولين</option>
                      <option value="none">غير مسندة</option>
                      {data.members.map((member: any) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="grid min-w-32 gap-1.5">
                    <span>المشروع</span>
                    <select
                      value={project}
                      onChange={e => setProject(e.target.value)}
                      aria-label="تصفية المهام حسب المشروع"
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-[#52657A]"
                    >
                      <option value="all">كل المشاريع</option>
                      <option value="none">بدون مشروع</option>
                      {data.projects.map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="grid min-w-28 gap-1.5">
                    <span>الأولوية</span>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      aria-label="تصفية المهام حسب الأولوية"
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-[#52657A]"
                    >
                      <option value="all">كل الأولويات</option>
                      {Object.entries(priorityLabel).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="grid min-w-28 gap-1.5">
                    <span>الموعد</span>
                    <select
                      value={due}
                      onChange={e => setDue(e.target.value as TaskDueFilter)}
                      aria-label="تصفية المهام حسب الموعد"
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-[#52657A]"
                    >
                      <option value="all">كل المواعيد</option>
                      <option value="overdue">متأخرة</option>
                      <option value="today">اليوم</option>
                      <option value="week">هذا الأسبوع</option>
                      <option value="upcoming">قادمة</option>
                      <option value="none">بدون موعد</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3">
                  <div className="grid min-w-28 gap-1.5">
                    <span>الحالة</span>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      aria-label="تصفية المهام حسب الحالة"
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-[#52657A]"
                    >
                      <option value="all">كل الحالات</option>
                      {Object.entries(taskStatusLabel).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((task: any) => {
                const project = data.projects.find(
                  (item: any) => item.id === task.projectId
                );
                return (
                  <tr
                    key={task.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-[#FBFCFE]"
                  >
                    <td data-label="إنجاز" className="px-4 py-3.5">
                      <button
                        onClick={() => completeTask(task.id, task.status)}
                        aria-label={
                          task.status === "complete"
                            ? `إلغاء إكمال ${task.title}`
                            : `إكمال ${task.title}`
                        }
                        disabled={!canEditWork}
                        className={cn(
                          "flex size-5 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50",
                          task.status === "complete"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 text-transparent hover:border-[#6C8FB8]"
                        )}
                      >
                        <Check className="size-3" />
                      </button>
                    </td>
                    <td
                      data-mobile-primary
                      data-label="المهمة"
                      className="px-4 py-3.5 text-sm font-medium"
                    >
                      <button
                        type="button"
                        onClick={() => openTaskDetail(task.id)}
                        className="text-right hover:text-[#52769F] hover:underline"
                      >
                        {task.title}
                      </button>
                      {task.parentTaskId && (
                        <span className="mr-2 text-[10px] text-[#7C8A9A]">
                          مهمة فرعية
                        </span>
                      )}
                      {task.needsSupport && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <SupportPill />
                          {task.supportRequest && (
                            <span className="max-w-64 truncate text-[11px] font-normal text-violet-700">
                              {task.supportRequest}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td data-label="المسؤول" className="px-4 py-3.5">
                      <select
                        aria-label={`إسناد ${task.title}`}
                        value={task.assigneeMemberId ?? ""}
                        onChange={event =>
                          assignTask(
                            task.id,
                            event.target.value
                              ? Number(event.target.value)
                              : null
                          )
                        }
                        disabled={!canEditWork}
                        className="max-w-36 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-[#52657A]"
                      >
                        <option value="">غير مسند</option>
                        {data.members.map((member: any) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      data-label="المشروع"
                      className="px-4 py-3.5 text-xs text-[#7C8A9A]"
                    >
                      {project?.title ?? "غير مرتبط"}
                    </td>
                    <td data-label="الأولوية" className="px-4 py-3.5">
                      <PriorityPill priority={task.priority} />
                    </td>
                    <td
                      data-label="الموعد"
                      className="px-4 py-3.5 text-xs text-[#7C8A9A]"
                    >
                      {task.dueDate ? dateText(task.dueDate) : "غير محدد"}
                    </td>
                    <td data-label="الحالة" className="px-4 py-3.5">
                      {canEditWork ? (
                        <select
                          aria-label={`حالة ${task.title}`}
                          value={task.status}
                          onChange={event =>
                            updateTaskStatus(
                              task.id,
                              event.target.value as TaskStatus
                            )
                          }
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-[#52657A]"
                        >
                          {Object.entries(taskStatusLabel).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <StatusPill status={task.status} />
                      )}
                    </td>
                    <td
                      data-mobile-actions
                      data-label="الإجراءات"
                      className="px-4 py-3.5"
                    >
                      {canEditWork && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => editTask(task)}
                            aria-label={`تعديل ${task.title}`}
                            className="rounded-md p-2 text-[#647487] hover:bg-[#EDF4FA] hover:text-[#52769F]"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <DeleteWorkDialog
                            kind="المهمة"
                            title={task.title}
                            description="سيُحذف سجل المهمة وتعليقاتها وروابطها نهائيًا. لا يمكن التراجع عن هذا الإجراء."
                            onConfirm={() => deleteTask(task.id)}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!list.length && (
                <tr>
                  <td
                    data-mobile-empty
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-[#7C8A9A]"
                  >
                    {scope === "support"
                      ? "لا توجد مهام تحتاج دعم حاليًا"
                      : "لا توجد مهام مطابقة"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TeamPage({
  data,
  user,
  setPage,
  setMemberId,
  openInvite,
  canManageTeam,
  administration,
  updating,
  updateAccess,
  updateProjectAccess,
  setActive,
  reissueInvitation,
  deleteMember,
  reissuedInviteUrl,
  clearReissuedInvite,
}: any) {
  const support = data.members.filter(
    (member: any) => member.loadStatus === "loaded" || member.overdueCount > 0
  );
  const loadLabel: Record<string, string> = {
    available: "متاح",
    busy: "مشغول",
    loaded: "محمّل",
  };
  const loadClass: Record<string, string> = {
    available: "bg-emerald-50 text-emerald-700",
    busy: "bg-amber-50 text-amber-700",
    loaded: "bg-rose-50 text-rose-700",
  };
  const showManagement = canManageTeam && Boolean(administration);
  const members = showManagement
    ? administration.members.map((member: any) => {
        const operational = data.members.find(
          (item: any) => item.id === member.id
        );
        return {
          ...member,
          activeTaskCount: operational?.activeTaskCount ?? 0,
          overdueCount: operational?.overdueCount ?? 0,
          loadStatus: operational?.loadStatus ?? "available",
        };
      })
    : data.members;
  return (
    <div className="entry">
      <PageHeading
        title="الفريق"
        description="مين عليه ضغط ومين متاح؟"
        action={
          canManageTeam && (
            <Button
              onClick={openInvite}
              className="h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
            >
              <UserRound className="size-4" />
              دعوة عضو
            </Button>
          )
        }
      />
      {reissuedInviteUrl && (
        <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                رابط الدعوة الجديد جاهز
              </p>
              <p className="mt-1 text-xs leading-6 text-emerald-700">
                الرابط السابق أُلغي. انسخ الرابط الجديد وأرسله للعضو.
              </p>
            </div>
            <button
              onClick={clearReissuedInvite}
              aria-label="إغلاق رابط الدعوة"
              className="text-emerald-700"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={reissuedInviteUrl}
              dir="ltr"
              className="h-9 flex-1 border-emerald-200 bg-white text-left text-xs"
            />
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard
                  .writeText(reissuedInviteUrl)
                  .then(() => toast.success("تم نسخ رابط الدعوة"))
              }
              className="h-9 border-emerald-200 bg-white text-emerald-800"
            >
              نسخ الرابط
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table
            className={cn(
              "responsive-data-table responsive-data-table-wide w-full text-right",
              showManagement ? "min-w-[1180px]" : "min-w-[700px]"
            )}
          >
            <thead className="border-b border-slate-100 bg-[#FCFDFE] text-[11px] text-[#7C8A9A]">
              <tr>
                <th className="px-5 py-3.5">العضو</th>
                <th className="px-5 py-3.5">الدور</th>
                {showManagement && (
                  <th className="px-5 py-3.5">صلاحية اللوحة</th>
                )}
                {showManagement && (
                  <th className="px-5 py-3.5">المشاريع المتاحة</th>
                )}
                <th className="px-5 py-3.5">الأعمال الحالية</th>
                <th className="px-5 py-3.5">حالة الضغط</th>
                <th className="px-5 py-3.5">المهام المتأخرة</th>
                {showManagement && (
                  <th className="px-5 py-3.5">إدارة الوصول</th>
                )}
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((member: any) => {
                const active =
                  !showManagement || member.accessStatus === "active";
                const navigable = data.members.some(
                  (item: any) => item.id === member.id
                );
                const protectedMember =
                  member.isOwner || member.userId === user.id;
                const accessLabel = member.isOwner
                  ? "مدير اللوحة الأساسي"
                  : member.accountRole === "admin"
                    ? "مدير المنصة"
                    : member.userId === user.id
                      ? "حسابك الحالي"
                      : null;
                return (
                  <tr
                    key={member.id}
                    onClick={() => {
                      if (!navigable) return;
                      setMemberId(member.id);
                      setPage("member");
                    }}
                    className={cn(
                      "border-b border-slate-100 last:border-0 hover:bg-[#FBFCFE]",
                      navigable && "cursor-pointer"
                    )}
                  >
                    <td
                      data-mobile-primary
                      data-label="العضو"
                      className="px-5 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          initials={member.avatarInitials}
                          color={member.color}
                          className="size-8 text-[10px]"
                        />
                        <div>
                          <span className="text-sm font-medium">
                            {member.name}
                          </span>
                          {showManagement && member.email && (
                            <p
                              dir="ltr"
                              className="mt-1 break-all text-right text-[11px] text-[#7C8A9A]"
                            >
                              {member.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      data-label="الدور"
                      className="px-5 py-4 text-xs text-[#7C8A9A]"
                    >
                      {member.role}
                    </td>
                    {showManagement && (
                      <td
                        data-label="صلاحية اللوحة"
                        className="px-5 py-4"
                        onClick={event => event.stopPropagation()}
                      >
                        {accessLabel ? (
                          <span className="rounded-full bg-[#EDF4FA] px-2.5 py-1 text-[11px] font-semibold text-[#52769F]">
                            {accessLabel}
                          </span>
                        ) : active ? (
                          <select
                            aria-label={`صلاحية ${member.name}`}
                            value={member.accessRole ?? "member"}
                            disabled={updating}
                            onChange={event =>
                              updateAccess(member.id, event.target.value)
                            }
                            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-50"
                          >
                            <option value="manager">مدير لوحة</option>
                            <option value="member">عضو</option>
                            <option value="viewer">مشاهد</option>
                          </select>
                        ) : (
                          <span className="text-xs text-[#52657A]">
                            {boardAccessLabel[member.accessRole] ?? "عضو"}
                          </span>
                        )}
                      </td>
                    )}
                    {showManagement && (
                      <td
                        data-label="المشاريع المتاحة"
                        className="px-5 py-4"
                        onClick={event => event.stopPropagation()}
                      >
                        {member.accessRole === "member" ? (
                          <ProjectAccessDialog
                            member={member}
                            projects={administration.projects}
                            updating={updating}
                            onConfirm={(
                              projectAccess: "all" | "selected",
                              allowedProjectIds: number[]
                            ) =>
                              updateProjectAccess(
                                member.id,
                                projectAccess,
                                allowedProjectIds
                              )
                            }
                          />
                        ) : (
                          <span className="text-xs text-[#52657A]">
                            كل المشاريع
                          </span>
                        )}
                      </td>
                    )}
                    <td
                      data-label="الأعمال الحالية"
                      className="px-5 py-4 text-sm"
                    >
                      {active ? member.activeTaskCount : "—"}
                    </td>
                    <td data-label="حالة الضغط" className="px-5 py-4">
                      {active ? (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium",
                            loadClass[member.loadStatus]
                          )}
                        >
                          {loadLabel[member.loadStatus]}
                        </span>
                      ) : (
                        <TeamAccessStatus status={member.accessStatus} />
                      )}
                    </td>
                    <td
                      data-label="المهام المتأخرة"
                      className="px-5 py-4 text-sm"
                    >
                      {active ? member.overdueCount || "—" : "—"}
                    </td>
                    {showManagement && (
                      <td
                        data-label="إدارة الوصول"
                        className="px-5 py-4"
                        onClick={event => event.stopPropagation()}
                      >
                        {active ? (
                          protectedMember ? (
                            <span className="text-xs text-slate-400">محمي</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <MemberAccessDialog
                                member={member}
                                updating={updating}
                                onConfirm={() => setActive(member.id, false)}
                              />
                              <DeleteMemberDialog
                                member={member}
                                updating={updating}
                                onConfirm={() => deleteMember(member.id)}
                              />
                            </div>
                          )
                        ) : member.accessStatus === "pending" ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updating}
                              onClick={() => reissueInvitation(member.id)}
                              className="gap-1.5 border-[#B8CBE0] text-[#52769F]"
                            >
                              <Send className="size-3.5" />
                              إعادة إرسال
                            </Button>
                            <DeleteMemberDialog
                              member={member}
                              updating={updating}
                              onConfirm={() => deleteMember(member.id)}
                            />
                          </div>
                        ) : member.userId ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updating}
                              onClick={() => setActive(member.id, true)}
                              className="gap-1.5 border-emerald-200 text-emerald-700"
                            >
                              <RotateCcw className="size-3.5" />
                              إعادة التفعيل
                            </Button>
                            <DeleteMemberDialog
                              member={member}
                              updating={updating}
                              onConfirm={() => deleteMember(member.id)}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={openInvite}
                              className="border-slate-200 text-[#52657A]"
                            >
                              دعوة جديدة
                            </Button>
                            <DeleteMemberDialog
                              member={member}
                              updating={updating}
                              onConfirm={() => deleteMember(member.id)}
                            />
                          </div>
                        )}
                      </td>
                    )}
                    <td
                      data-mobile-actions
                      data-label="التفاصيل"
                      className="px-5 py-4"
                    >
                      {navigable && (
                        <ChevronLeft className="size-4 text-slate-400" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <section className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle>يحتاج دعم</SectionTitle>
        {support.length ? (
          <div className="space-y-3">
            {support.map((member: any) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar
                  initials={member.avatarInitials}
                  color={member.color}
                  className="size-7 text-[10px]"
                />
                <p className="flex-1 text-sm">
                  <b className="font-medium">{member.name}</b>
                  <span className="mr-2 text-[#7C8A9A]">
                    لديه عبء مرتفع أو مهام متأخرة
                  </span>
                </p>
                <span className="text-xs text-rose-700">يحتاج متابعة</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="لا يوجد أعضاء يحتاجون دعمًا حاليًا" />
        )}
      </section>
    </div>
  );
}

function TeamAccessStatus({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium",
        status === "pending"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-600"
      )}
    >
      {status === "pending" ? "بانتظار القبول" : "موقوف"}
    </span>
  );
}

function ProjectAccessDialog({ member, projects, updating, onConfirm }: any) {
  const [open, setOpen] = useState(false);
  const [projectAccess, setProjectAccess] = useState<"all" | "selected">(
    member.projectAccess ?? "all"
  );
  const [allowedProjectIds, setAllowedProjectIds] = useState<number[]>(
    Array.isArray(member.allowedProjectIds) ? member.allowedProjectIds : []
  );
  const selectedCount = allowedProjectIds.filter((id: number) =>
    projects.some((project: any) => project.id === id)
  ).length;

  const reset = () => {
    setProjectAccess(member.projectAccess ?? "all");
    setAllowedProjectIds(
      Array.isArray(member.allowedProjectIds) ? member.allowedProjectIds : []
    );
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={value => {
        setOpen(value);
        if (value) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={updating}
          className="h-9 border-[#B8CBE0] text-xs text-[#52769F]"
        >
          {member.projectAccess === "selected"
            ? `${selectedCount} مشروع محدد`
            : "كل المشاريع"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl" className="max-w-lg">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle>مشاريع {member.name}</AlertDialogTitle>
          <AlertDialogDescription className="leading-7">
            حددي هل يرى العضو كل مشاريع اللوحة أو مشاريع بعينها فقط. وينطبق
            الاختيار أيضًا على مهام وتقارير ودروس تلك المشاريع.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="radio"
              name={`project-access-${member.id}`}
              checked={projectAccess === "all"}
              onChange={() => setProjectAccess("all")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold">كل المشاريع</span>
              <span className="mt-1 block text-xs text-slate-500">
                يرى المشاريع الحالية وأي مشروع يُضاف مستقبلًا.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="radio"
              name={`project-access-${member.id}`}
              checked={projectAccess === "selected"}
              onChange={() => setProjectAccess("selected")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold">
                مشاريع محددة فقط
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                لا تظهر له أي مشاريع أخرى داخل اللوحة.
              </span>
            </span>
          </label>
          {projectAccess === "selected" && (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
              {projects.length ? (
                projects.map((project: any) => {
                  const checked = allowedProjectIds.includes(project.id);
                  return (
                    <label
                      key={project.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={value =>
                          setAllowedProjectIds((current: number[]) =>
                            value === true
                              ? Array.from(new Set([...current, project.id]))
                              : current.filter(id => id !== project.id)
                          )
                        }
                      />
                      <span>{project.title}</span>
                    </label>
                  );
                })
              ) : (
                <p className="py-3 text-center text-xs text-slate-500">
                  لا توجد مشاريع في اللوحة حاليًا. سيبقى العضو بلا مشاريع حتى
                  يختار له المدير مشروعًا.
                </p>
              )}
            </div>
          )}
        </div>
        <AlertDialogFooter className="sm:justify-start">
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(projectAccess, allowedProjectIds)}
            className="bg-[#52769F] text-white hover:bg-[#46698F]"
          >
            حفظ النطاق
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MemberAccessDialog({ member, updating, onConfirm }: any) {
  const pending = member.accessStatus === "pending";
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          disabled={updating}
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          {pending ? "إلغاء الدعوة" : "إيقاف الوصول"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle>
            {pending ? "إلغاء دعوة العضو؟" : "إيقاف وصول العضو؟"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending
              ? `سيتم إلغاء دعوة ${member.name} الحالية.`
              : `سيُمنع ${member.name} من دخول هذه اللوحة، مع الاحتفاظ بسجل أعماله السابقة.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-start">
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {pending ? "تأكيد الإلغاء" : "تأكيد الإيقاف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteMemberDialog({ member, updating, onConfirm }: any) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          disabled={updating}
          aria-label={`حذف ${member.name}`}
          className="gap-1.5 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 className="size-3.5" />
          حذف
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle>حذف {member.name} نهائيًا؟</AlertDialogTitle>
          <AlertDialogDescription className="leading-7">
            سيُحذف العضو من هذه اللوحة وتُلغى دعواته. إذا كانت لديه مهام أو
            مشاريع أو سجلات مرتبطة فلن يسمح النظام بالحذف، ويمكنك إيقاف وصوله
            بدلًا من ذلك.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-start">
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            حذف العضو
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteWorkDialog({
  kind,
  title,
  description,
  onConfirm,
  showLabel = false,
}: any) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={`حذف ${title}`}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-md text-rose-600 hover:bg-rose-50 hover:text-rose-700",
            showLabel ? "h-9 border border-rose-200 px-3 text-sm" : "p-2"
          )}
        >
          <Trash2 className="size-4" />
          {showLabel && "حذف"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle>
            حذف {kind} «{title}» نهائيًا؟
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-7">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-start">
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            تأكيد الحذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MemberDetail({ data, memberId, setPage }: any) {
  const member =
    data.members.find((item: any) => item.id === memberId) ?? data.members[0];
  const current = data.tasks.filter(
    (task: any) =>
      task.assigneeMemberId === member.id && task.status !== "complete"
  );
  return (
    <div className="entry max-w-4xl">
      <button
        onClick={() => setPage("team")}
        className="mb-5 flex items-center gap-1 text-sm text-[#647487]"
      >
        <ArrowRight className="size-4" />
        الفريق
      </button>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <Avatar
            initials={member.avatarInitials}
            color={member.color}
            className="size-14 text-base"
          />
          <div>
            <h1 className="text-xl font-bold">{member.name}</h1>
            <p className="mt-1 text-sm text-[#7C8A9A]">{member.role}</p>
          </div>
          <span
            className={cn(
              "mr-auto rounded-full px-3 py-1.5 text-xs font-medium",
              member.loadStatus === "loaded"
                ? "bg-rose-50 text-rose-700"
                : member.loadStatus === "busy"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
            )}
          >
            {member.loadStatus === "loaded"
              ? "محمّل"
              : member.loadStatus === "busy"
                ? "مشغول"
                : "متاح"}
          </span>
        </div>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle>أعماله الحالية</SectionTitle>
          {current.map((task: any) => (
            <div
              key={task.id}
              className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
            >
              <p className="text-sm">{task.title}</p>
              <StatusPill status={task.status} />
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle>هذا الأسبوع</SectionTitle>
          {current.slice(0, 4).map((task: any) => (
            <div key={task.id} className="flex items-center gap-3 py-3">
              <span className="size-1.5 rounded-full bg-[#6C8FB8]" />
              <p className="flex-1 text-sm">{task.title}</p>
              <span className="text-xs text-[#7C8A9A]">
                {dateText(task.dueDate)}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function LaunchesPage({ data, canEditWork, setPage, setProjectId }: any) {
  const utils = trpc.useUtils();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLaunch, setEditingLaunch] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [projectId, setLaunchProjectId] = useState("");
  const [launchDate, setLaunchDate] = useState(todayInputValue);
  const launches = [...data.events]
    .filter((event: any) => event.type === "launch")
    .sort(
      (a: any, b: any) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );
  const requestedEventId = Number(
    new URLSearchParams(window.location.search).get("eventId")
  );
  useEffect(() => {
    if (!Number.isInteger(requestedEventId) || requestedEventId <= 0) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`launch-${requestedEventId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [requestedEventId]);
  const refresh = async () => utils.workspace.overview.invalidate();
  const createLaunch = trpc.workspace.createCalendarEvent.useMutation({
    onSuccess: async () => {
      await refresh();
      setEditorOpen(false);
      toast.success("تمت إضافة الإطلاق إلى التقويم");
    },
    onError: issue => toast.error(issue.message),
  });
  const updateLaunch = trpc.workspace.updateCalendarEvent.useMutation({
    onSuccess: async () => {
      await refresh();
      setEditorOpen(false);
      toast.success("تم تحديث الإطلاق وموعده في التقويم");
    },
    onError: issue => toast.error(issue.message),
  });
  const deleteLaunch = trpc.workspace.deleteCalendarEvent.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("تم حذف الإطلاق");
    },
    onError: issue => toast.error(issue.message),
  });
  const openCreate = () => {
    setEditingLaunch(null);
    setTitle("");
    setLaunchProjectId("");
    setLaunchDate(todayInputValue());
    setEditorOpen(true);
  };
  const openEdit = (launch: any) => {
    setEditingLaunch(launch);
    setTitle(launch.title);
    setLaunchProjectId(launch.projectId ? String(launch.projectId) : "");
    setLaunchDate(dateInputValue(launch.eventDate));
    setEditorOpen(true);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !launchDate) {
      toast.error("أكمل اسم الإطلاق وموعده");
      return;
    }
    const input = {
      title: title.trim(),
      projectId: projectId ? Number(projectId) : null,
      eventDate: new Date(`${launchDate}T12:00:00`),
      type: "launch" as const,
    };
    if (editingLaunch) {
      updateLaunch.mutate({ id: editingLaunch.id, ...input });
    } else {
      createLaunch.mutate(input);
    }
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="entry">
      <PageHeading
        eyebrow="مواعيد مرتبطة تلقائيًا بالتقويم"
        title="الإطلاقات"
        description="أدر مواعيد الإطلاق واربط كل إطلاق بالمشروع المناسب."
        action={
          canEditWork ? (
            <Button
              onClick={openCreate}
              className="h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
            >
              <Plus className="size-4" />
              إطلاق جديد
            </Button>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {launches.length ? (
          <div className="overflow-x-auto">
            <table className="responsive-data-table w-full min-w-[680px] text-right">
              <thead className="border-b border-slate-100 bg-[#FCFDFE] text-[11px] text-[#7C8A9A]">
                <tr>
                  <th className="px-5 py-3">الإطلاق</th>
                  <th className="px-5 py-3">المشروع المرتبط</th>
                  <th className="px-5 py-3">الموعد</th>
                  <th className="px-5 py-3">الحالة</th>
                  <th className="px-5 py-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {launches.map((launch: any) => {
                  const project = data.projects.find(
                    (item: any) => item.id === launch.projectId
                  );
                  const upcoming = new Date(launch.eventDate) >= today;
                  return (
                    <tr
                      key={launch.id}
                      id={`launch-${launch.id}`}
                      className={cn(
                        "scroll-mt-6 border-b border-slate-100 last:border-0 hover:bg-[#FBFCFE]",
                        requestedEventId === launch.id &&
                          "bg-[#F2F7FC] ring-2 ring-inset ring-[#BFD3E7]"
                      )}
                    >
                      <td
                        data-mobile-primary
                        data-label="الإطلاق"
                        className="px-5 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                            <Rocket className="size-4" />
                          </span>
                          <span className="text-sm font-semibold">
                            {launch.title}
                          </span>
                        </div>
                      </td>
                      <td data-label="المشروع" className="px-5 py-4 text-sm">
                        {project ? (
                          <button
                            type="button"
                            onClick={() => {
                              setProjectId(project.id);
                              setPage("project");
                            }}
                            className="text-[#52769F] hover:underline"
                          >
                            {project.title}
                          </button>
                        ) : (
                          <span className="text-[#7C8A9A]">بدون مشروع</span>
                        )}
                      </td>
                      <td data-label="الموعد" className="px-5 py-4 text-sm">
                        {fullDateText(launch.eventDate)}
                      </td>
                      <td data-label="الحالة" className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            upcoming
                              ? "bg-violet-50 text-violet-700"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {upcoming ? "قادم" : "انتهى"}
                        </span>
                      </td>
                      <td
                        data-mobile-actions
                        data-label="الإجراءات"
                        className="px-5 py-4"
                      >
                        {canEditWork && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(launch)}
                              aria-label={`تعديل ${launch.title}`}
                              className="rounded-md p-2 text-[#647487] hover:bg-[#EDF4FA] hover:text-[#52769F]"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <DeleteWorkDialog
                              kind="الإطلاق"
                              title={launch.title}
                              description="سيُحذف الإطلاق من القائمة والتقويم نهائيًا."
                              onConfirm={() =>
                                deleteLaunch.mutate({ id: launch.id })
                              }
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <Rocket className="mx-auto size-7 text-violet-300" />
            <h2 className="mt-3 font-semibold">لا توجد إطلاقات بعد</h2>
            <p className="mt-2 text-sm text-[#7C8A9A]">
              أضف أول إطلاق وسيظهر موعده تلقائيًا في التقويم.
            </p>
            {canEditWork && (
              <Button
                onClick={openCreate}
                className="mt-5 bg-[#52769F] hover:bg-[#46698F]"
              >
                إضافة أول إطلاق
              </Button>
            )}
          </div>
        )}
      </div>
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent
          side="left"
          dir="rtl"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader className="text-right">
            <SheetTitle>
              {editingLaunch ? "تعديل الإطلاق" : "إطلاق جديد"}
            </SheetTitle>
            <SheetDescription>
              الموعد محفوظ مرة واحدة هنا، وأي تغيير سيظهر مباشرة في التقويم.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={submit} className="mt-7 space-y-5">
            <Field label="اسم الإطلاق">
              <Input
                autoFocus
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="مثال: إطلاق النسخة التجريبية"
                required
              />
            </Field>
            <Field label="المشروع المرتبط (اختياري)">
              <select
                value={projectId}
                onChange={event => setLaunchProjectId(event.target.value)}
                className="form-select"
              >
                <option value="">بدون مشروع</option>
                {data.projects.map((project: any) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="موعد الإطلاق">
              <Input
                type="date"
                value={launchDate}
                onChange={event => setLaunchDate(event.target.value)}
                required
              />
            </Field>
            <Button
              type="submit"
              disabled={createLaunch.isPending || updateLaunch.isPending}
              className="h-10 w-full bg-[#52769F] hover:bg-[#46698F]"
            >
              {createLaunch.isPending || updateLaunch.isPending
                ? "جارٍ الحفظ..."
                : editingLaunch
                  ? "حفظ التعديلات"
                  : "حفظ الإطلاق"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CalendarPage({ data, setPage, openTaskDetail }: any) {
  const [calendarSystem, setCalendarSystem] = useState<"gregory" | "islamic">(
    "gregory"
  );
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingCells = monthCursor.getDay();
  const dateKey = (value: Date | string) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };
  const calendarItems = [
    ...data.events.map((event: any) => ({
      ...event,
      calendarId: `event-${event.id}`,
      calendarKind: event.type === "launch" ? "launch" : "event",
    })),
    ...data.tasks
      .filter((task: any) => task.dueDate)
      .map((task: any) => ({
        id: task.id,
        taskId: task.id,
        title: task.title,
        projectId: task.projectId,
        eventDate: task.dueDate,
        type: "task_due",
        calendarId: `task-${task.id}`,
        calendarKind: "task",
      })),
  ];
  const eventsByDate = calendarItems.reduce(
    (acc: Record<string, any[]>, event: any) => {
      const key = dateKey(event.eventDate);
      (acc[key] ??= []).push(event);
      return acc;
    },
    {} as Record<string, any[]>
  );
  const cells: Array<Date | null> = Array.from(
    { length: Math.ceil((leadingCells + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - leadingCells + 1;
      return day > 0 && day <= daysInMonth ? new Date(year, month, day) : null;
    }
  );
  const gregorianTitle = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    month: "long",
    year: "numeric",
  }).format(monthCursor);
  const hijriFormatter = new Intl.DateTimeFormat(
    "ar-SA-u-ca-islamic-umalqura",
    { month: "long", year: "numeric" }
  );
  const hijriStart = hijriFormatter.format(monthCursor);
  const hijriEnd = hijriFormatter.format(new Date(year, month, daysInMonth));
  const hijriTitle =
    hijriStart === hijriEnd ? hijriStart : `${hijriStart} — ${hijriEnd}`;
  const todayKey = dateKey(new Date());
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcomingEvents = [...calendarItems]
    .sort(
      (a: any, b: any) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    )
    .filter((event: any) => new Date(event.eventDate) >= startOfToday)
    .slice(0, 5);
  const visibleUpcoming = upcomingEvents.length
    ? upcomingEvents
    : [...calendarItems]
        .sort(
          (a: any, b: any) =>
            new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
        )
        .slice(-5);
  const eventTypeLabel: Record<string, string> = {
    meeting: "اجتماع",
    delivery: "تسليم",
    launch: "إطلاق",
    workshop: "ورشة",
    review: "مراجعة",
    task_due: "موعد نهائي لمهمة",
  };
  const eventClass = (event: any) =>
    event.calendarKind === "task"
      ? "border-rose-500 bg-rose-50 text-rose-700"
      : event.calendarKind === "launch"
        ? "border-violet-500 bg-violet-50 text-violet-700"
        : "border-[#6C8FB8] bg-[#EDF4FA] text-[#46698F]";
  const openCalendarItem = (event: any) => {
    if (event.calendarKind === "task") openTaskDetail(event.taskId);
    if (event.calendarKind === "launch") setPage("launches");
  };
  return (
    <div className="entry">
      <PageHeading
        title="التقويم"
        description="المواعيد النهائية للمهام والإطلاقات في مكان واحد."
        action={
          <Button
            variant="outline"
            onClick={() => setPage("launches")}
            className="h-10 gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
          >
            <Rocket className="size-4" />
            إدارة الإطلاقات
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_265px]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="الشهر السابق"
                onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
                className="rounded-lg border border-slate-200 p-2 text-[#647487] hover:bg-slate-50"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                aria-label="الشهر التالي"
                onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
                className="rounded-lg border border-slate-200 p-2 text-[#647487] hover:bg-slate-50"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="mr-2">
                <h2 className="font-semibold">
                  {calendarSystem === "gregory" ? gregorianTitle : hijriTitle}
                </h2>
                <p className="mt-0.5 text-[11px] text-[#7C8A9A]">
                  {calendarSystem === "gregory" ? hijriTitle : gregorianTitle}
                </p>
              </div>
            </div>
            <div className="inline-flex w-fit rounded-lg bg-[#F1F5F9] p-1">
              <button
                type="button"
                onClick={() => setCalendarSystem("gregory")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs transition",
                  calendarSystem === "gregory"
                    ? "bg-white font-semibold text-[#40556D] shadow-sm"
                    : "text-[#7C8A9A]"
                )}
              >
                ميلادي
              </button>
              <button
                type="button"
                onClick={() => setCalendarSystem("islamic")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs transition",
                  calendarSystem === "islamic"
                    ? "bg-white font-semibold text-[#40556D] shadow-sm"
                    : "text-[#7C8A9A]"
                )}
              >
                هجري
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 border-b border-slate-100 px-5 py-3 text-[11px] text-[#647487]">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-rose-500" />
              موعد نهائي لمهمة
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-violet-500" />
              موعد إطلاق
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#6C8FB8]" />
              موعد آخر
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] text-[#7C8A9A]">
                {[
                  "أحد",
                  "اثنين",
                  "ثلاثاء",
                  "أربعاء",
                  "خميس",
                  "جمعة",
                  "سبت",
                ].map(day => (
                  <div key={day} className="py-3">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((date, index) => {
                  if (!date)
                    return (
                      <div
                        key={`blank-${index}`}
                        className="min-h-24 border-b border-l border-slate-100 bg-[#FCFDFE]"
                      />
                    );
                  const key = dateKey(date);
                  const gregorianDay = new Intl.NumberFormat("ar-SA").format(
                    date.getDate()
                  );
                  const hijriDay = new Intl.DateTimeFormat(
                    "ar-SA-u-ca-islamic-umalqura",
                    { day: "numeric" }
                  ).format(date);
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "min-h-24 border-b border-l border-slate-100 p-2",
                        isToday && "bg-[#EDF4FA]/45"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full text-xs",
                            isToday && "bg-[#6C8FB8] text-white"
                          )}
                        >
                          {calendarSystem === "gregory"
                            ? gregorianDay
                            : hijriDay}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {calendarSystem === "gregory"
                            ? `${hijriDay} هـ`
                            : `${gregorianDay} م`}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {(eventsByDate[key] ?? []).map((event: any) => (
                          <button
                            key={event.calendarId}
                            type="button"
                            onClick={() => openCalendarItem(event)}
                            className={cn(
                              "w-full truncate rounded border-r-2 px-1.5 py-1 text-right text-[10px]",
                              eventClass(event),
                              event.calendarKind === "event" && "cursor-default"
                            )}
                          >
                            {event.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        <aside className="rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle>القادم</SectionTitle>
          <div className="space-y-4">
            {visibleUpcoming.map((event: any) => (
              <button
                key={event.calendarId}
                type="button"
                onClick={() => openCalendarItem(event)}
                className={cn(
                  "flex w-full gap-3 rounded-lg p-1 text-right transition",
                  event.calendarKind !== "event" && "hover:bg-slate-50"
                )}
              >
                <div className="w-9 text-center">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      event.calendarKind === "task"
                        ? "text-rose-600"
                        : event.calendarKind === "launch"
                          ? "text-violet-700"
                          : "text-[#52769F]"
                    )}
                  >
                    {new Intl.NumberFormat("ar-SA").format(
                      new Date(event.eventDate).getDate()
                    )}
                  </p>
                  <p className="text-[9px] text-[#7C8A9A]">
                    {new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
                      month: "short",
                    }).format(new Date(event.eventDate))}
                  </p>
                </div>
                <div className="min-w-0 border-r border-slate-100 pr-3">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="mt-1 text-[11px] text-[#7C8A9A]">
                    {eventTypeLabel[event.type] ?? event.type}
                  </p>
                </div>
              </button>
            ))}
            {!visibleUpcoming.length && (
              <EmptyState title="لا توجد مواعيد مسجلة" />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

const MAX_RESEARCH_KEYWORDS = 40;

function parseResearchKeywords(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[،,\n]/)
        .map(keyword => keyword.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  );
}

function researchInterestErrorMessage(message: string) {
  if (message.includes("too_big") || message.includes("Too big"))
    return `الحد الأعلى ${MAX_RESEARCH_KEYWORDS} كلمة مفتاحية لكل اهتمام`;
  return message;
}

function ResearchFeedsPage({
  data,
  canManageFeeds,
  canAddFeeds,
  canEditWork,
}: any) {
  const utils = trpc.useUtils();
  const {
    data: feed,
    isLoading,
    error,
  } = trpc.workspace.researchFeed.useQuery(undefined, { staleTime: 60_000 });
  const [showManagement, setShowManagement] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [interestName, setInterestName] = useState("");
  const [keywordText, setKeywordText] = useState("");
  const [selectedInterest, setSelectedInterest] = useState<string>("all");
  const [search, setSearch] = useState("");
  const parsedKeywords = parseResearchKeywords(keywordText);
  const invalidateFeed = () => utils.workspace.researchFeed.invalidate();
  const refreshInterest = trpc.workspace.refreshResearchInterest.useMutation({
    onSuccess: async result => {
      await invalidateFeed();
      toast.success(
        result.fetched
          ? `تم تحديث ${result.fetched} نتيجة بحثية`
          : "تم التحديث ولا توجد نتائج جديدة"
      );
    },
    onError: issue => toast.error(researchInterestErrorMessage(issue.message)),
  });
  const createInterest = trpc.workspace.createResearchInterest.useMutation({
    onSuccess: async result => {
      await invalidateFeed();
      setInterestName("");
      setKeywordText("");
      toast.success("تمت إضافة الموضوع وسيبدأ جلب أبحاثه الآن");
      refreshInterest.mutate({ id: result.id });
    },
    onError: issue => toast.error(researchInterestErrorMessage(issue.message)),
  });
  const updateInterest = trpc.workspace.updateResearchInterest.useMutation({
    onSuccess: async (_result, variables) => {
      await invalidateFeed();
      setEditingId(null);
      setInterestName("");
      setKeywordText("");
      toast.success("تم تحديث الموضوع وسيُعاد جلب نتائجه");
      refreshInterest.mutate({ id: variables.id });
    },
    onError: issue => toast.error(researchInterestErrorMessage(issue.message)),
  });
  const setInterestActive =
    trpc.workspace.setResearchInterestActive.useMutation({
      onSuccess: invalidateFeed,
      onError: issue => toast.error(issue.message),
    });
  const deleteInterest = trpc.workspace.deleteResearchInterest.useMutation({
    onSuccess: async () => {
      setSelectedInterest("all");
      await invalidateFeed();
      toast.success("تم حذف الموضوع");
    },
    onError: issue => toast.error(issue.message),
  });
  const refreshAll = trpc.workspace.refreshResearchFeed.useMutation({
    onSuccess: async result => {
      await invalidateFeed();
      if (result.failures)
        toast.warning("اكتمل التحديث، لكن تعذر الوصول إلى بعض النتائج");
      else toast.success(`تم تحديث ${result.fetched} نتيجة بحثية`);
    },
    onError: issue => toast.error(issue.message),
  });
  const linkItem = trpc.workspace.linkResearchFeedItem.useMutation({
    onSuccess: async () => {
      await invalidateFeed();
      toast.success("تم ربط الخلاصة بالمشروع");
    },
    onError: issue => toast.error(issue.message),
  });
  const interests = feed?.interests ?? [];
  const activeInterests = interests.filter(
    (interest: any) => interest.isActive
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const items = (feed?.items ?? []).filter((item: any) => {
    const matchesInterest =
      selectedInterest === "all" ||
      item.interestIds.includes(Number(selectedInterest));
    const searchable = [
      item.title,
      item.abstract,
      item.abstractArabic,
      ...(item.authors ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      matchesInterest &&
      (!normalizedSearch || searchable.includes(normalizedSearch))
    );
  });
  const latestRefresh = interests
    .map((interest: any) => interest.lastFetchedAt)
    .filter(Boolean)
    .sort(
      (a: Date | string, b: Date | string) =>
        new Date(b).getTime() - new Date(a).getTime()
    )[0];
  const resetEditor = () => {
    setEditingId(null);
    setInterestName("");
    setKeywordText("");
  };
  const edit = (interest: any) => {
    setEditingId(interest.id);
    setInterestName(interest.name);
    setKeywordText((interest.keywords ?? []).join("، "));
    setShowManagement(true);
  };
  const submitInterest = (event: React.FormEvent) => {
    event.preventDefault();
    const keywords = parseResearchKeywords(keywordText);
    if (!interestName.trim() || !keywords.length) {
      toast.error("أدخل اسم الموضوع وكلمة بحث واحدة على الأقل");
      return;
    }
    if (keywords.length > MAX_RESEARCH_KEYWORDS) {
      toast.error(
        `أدخل ${MAX_RESEARCH_KEYWORDS} كلمة مفتاحية كحد أعلى؛ لديك الآن ${keywords.length}`
      );
      return;
    }
    if (editingId)
      updateInterest.mutate({
        id: editingId,
        name: interestName.trim(),
        keywords,
      });
    else createInterest.mutate({ name: interestName.trim(), keywords });
  };
  return (
    <div className="entry max-w-6xl">
      <PageHeading
        eyebrow="المرصد البحثي"
        title="الخلاصات البحثية"
        description="أحدث الأبحاث حسب موضوعات اللوحة، مع ترجمة عربية محفوظة للملخصات."
        action={
          canAddFeeds ? (
            <div className="flex flex-wrap gap-2">
              {canManageFeeds && (
                <Button
                  variant="outline"
                  onClick={() => refreshAll.mutate()}
                  disabled={refreshAll.isPending || !activeInterests.length}
                  className="h-10 gap-2 border-slate-200 bg-white text-[#52657A]"
                >
                  <RefreshCw
                    className={cn(
                      "size-4",
                      refreshAll.isPending && "animate-spin"
                    )}
                  />
                  تحديث الآن
                </Button>
              )}
              <Button
                onClick={() => setShowManagement(current => !current)}
                className="h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
              >
                {canManageFeeds ? (
                  <SlidersHorizontal className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {canManageFeeds ? "إدارة الموضوعات" : "إضافة موضوع"}
              </Button>
            </div>
          ) : undefined
        }
      />

      {canAddFeeds && showManagement && (
        <section className="mb-6 rounded-xl border border-[#DCE7F2] bg-white p-5">
          <SectionTitle>
            {editingId ? "تعديل موضوع بحثي" : "إضافة موضوع بحثي"}
          </SectionTitle>
          <form
            onSubmit={submitInterest}
            className="grid gap-4 lg:grid-cols-[.75fr_1.4fr_auto] lg:items-end"
          >
            <Field label="اسم الموضوع">
              <Input
                value={interestName}
                onChange={event => setInterestName(event.target.value)}
                placeholder="مثال: معالجة اللغة العربية"
                maxLength={180}
              />
            </Field>
            <Field label="كلمات البحث بالعربية أو الإنجليزية">
              <Textarea
                value={keywordText}
                onChange={event => setKeywordText(event.target.value)}
                placeholder="Arabic NLP، Arabic language model، Arabic LLM"
                rows={2}
                className="min-h-[64px] resize-y"
              />
            </Field>
            <div className="flex w-full gap-2 [&>*]:flex-1 lg:w-auto lg:[&>*]:flex-none">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetEditor}
                  className="h-10 border-slate-200"
                >
                  إلغاء
                </Button>
              )}
              <Button
                type="submit"
                disabled={createInterest.isPending || updateInterest.isPending}
                className="h-10 bg-[#52769F] hover:bg-[#46698F]"
              >
                {editingId ? "حفظ" : "إضافة"}
              </Button>
            </div>
          </form>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] leading-5">
            <p className="text-[#7C8A9A]">
              افصل بين الكلمات بفاصلة أو سطر جديد. يُحدّث أثر النتائج تلقائيًا
              كل 6 ساعات من arXiv دون تكلفة ذكاء اصطناعي.
            </p>
            <p
              className={cn(
                "font-semibold",
                parsedKeywords.length > MAX_RESEARCH_KEYWORDS
                  ? "text-rose-600"
                  : "text-[#52769F]"
              )}
            >
              {parsedKeywords.length} / {MAX_RESEARCH_KEYWORDS} كلمة
            </p>
          </div>

          {canManageFeeds && interests.length > 0 && (
            <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
              {interests.map((interest: any) => (
                <div
                  key={interest.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{interest.name}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          interest.lastFetchStatus === "error"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {interest.lastFetchMessage ?? "بانتظار أول تحديث"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[#7C8A9A]">
                      {(interest.keywords ?? []).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={interest.isActive}
                      onCheckedChange={active =>
                        setInterestActive.mutate({ id: interest.id, active })
                      }
                      aria-label={`تفعيل ${interest.name}`}
                      className="ml-2 data-[state=checked]:bg-[#52769F]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        refreshInterest.mutate({ id: interest.id })
                      }
                      disabled={refreshInterest.isPending || !interest.isActive}
                      aria-label={`تحديث ${interest.name}`}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-[#52769F] disabled:opacity-40"
                    >
                      <RefreshCw className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => edit(interest)}
                      aria-label={`تعديل ${interest.name}`}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-[#52769F]"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          aria-label={`حذف ${interest.name}`}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader className="text-right">
                          <AlertDialogTitle>حذف الموضوع؟</AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتوقف ظهور خلاصات موضوع «{interest.name}» لجميع
                            أعضاء اللوحة.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2 sm:justify-start">
                          <AlertDialogCancel>تراجع</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deleteInterest.mutate({ id: interest.id })
                            }
                            className="bg-rose-600 hover:bg-rose-700"
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <label className="flex flex-col items-stretch gap-2 text-xs font-medium text-[#52657A] sm:flex-row sm:items-center">
            <span>الموضوع</span>
            <select
              value={selectedInterest}
              onChange={event => setSelectedInterest(event.target.value)}
              aria-label="تصفية الخلاصات حسب الموضوع"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm sm:min-w-48 sm:w-auto"
            >
              <option value="all">كل الموضوعات</option>
              {activeInterests.map((interest: any) => (
                <option key={interest.id} value={interest.id}>
                  {interest.name}
                </option>
              ))}
            </select>
          </label>
          <label className="relative block lg:w-72">
            <Search className="absolute top-2.5 right-3 size-4 text-slate-400" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="ابحث في الخلاصات"
              className="h-9 pr-9"
            />
          </label>
        </div>
        <p className="mt-3 text-[11px] text-[#7C8A9A]">
          المصدر الحالي: arXiv · آخر تحديث: {fullDateText(latestRefresh)}
        </p>
        {canAddFeeds && (
          <p className="mt-1 text-[11px] leading-5 text-[#6C8FB8]">
            لترجمة النتائج غير المترجمة، اطلب من ChatGPT أو Claude بعد ربطه
            بأثر: «ترجم ملخصات الخلاصات الجديدة إلى العربية واحفظها».
          </p>
        )}
      </section>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-[#7C8A9A]">
          جارٍ تحميل الخلاصات...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 py-12 text-center text-sm text-rose-700">
          تعذر تحميل الخلاصات البحثية. حاول تحديث الصفحة.
        </div>
      ) : !activeInterests.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Rss className="mx-auto size-8 text-slate-300" />
          <p className="mt-4 text-sm font-semibold">لا توجد اهتمامات مفعلة</p>
          <p className="mt-2 text-xs text-[#7C8A9A]">
            {canAddFeeds
              ? "أضف أول موضوع وحدد الكلمات التي تهم الفريق."
              : "لم يضف الفريق موضوعات بحثية حتى الآن."}
          </p>
        </div>
      ) : items.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item: any) => {
            const itemInterests = activeInterests.filter((interest: any) =>
              item.interestIds.includes(interest.id)
            );
            return (
              <article
                key={item.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-[#C9D8E8] hover:shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {itemInterests.map((interest: any) => (
                      <span
                        key={interest.id}
                        className="rounded-full bg-[#EDF4FA] px-2 py-1 text-[10px] font-medium text-[#52769F]"
                      >
                        {interest.name}
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 text-[10px] text-[#7C8A9A]">
                    {fullDateText(item.publishedAt)}
                  </span>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-2 text-base font-bold leading-7 text-[#26364A] hover:text-[#52769F]"
                  dir="auto"
                >
                  <span className="flex-1">{item.title}</span>
                  <ExternalLink className="mt-1 size-4 shrink-0 text-slate-300 group-hover:text-[#52769F]" />
                </a>
                <p className="mt-2 text-xs text-[#7C8A9A]" dir="auto">
                  {(item.authors ?? []).slice(0, 4).join("، ") ||
                    "باحثون متعددون"}
                  {(item.authors ?? []).length > 4 ? " وآخرون" : ""}
                </p>
                <div className="mt-4 flex-1 rounded-lg bg-[#F8FAFC] p-3">
                  <p className="mb-1 text-[10px] font-semibold text-[#52769F]">
                    {item.translationIsCurrent
                      ? "الملخص بالعربية"
                      : "ملخص الباحثين الأصلي"}
                  </p>
                  <p
                    className="line-clamp-5 text-xs leading-6 text-[#52657A]"
                    dir={item.translationIsCurrent ? "rtl" : "auto"}
                  >
                    {(item.translationIsCurrent && item.abstractArabic) ||
                      item.abstract ||
                      "لا يتوفر ملخص لهذا البحث."}
                  </p>
                  {item.translationIsCurrent && item.abstract && (
                    <details className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-[#647487]">
                      <summary className="cursor-pointer font-medium text-[#52769F]">
                        عرض الملخص الإنجليزي الأصلي
                      </summary>
                      <p className="mt-2 leading-5" dir="ltr">
                        {item.abstract}
                      </p>
                    </details>
                  )}
                  {!item.translationIsCurrent && item.abstractArabic && (
                    <p className="mt-2 text-[10px] text-amber-700">
                      توجد ترجمة سابقة، لكن الملخص الأصلي تغير وتحتاج الترجمة
                      إلى تحديث.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                  <span className="text-[10px] font-bold tracking-wide text-[#6C8FB8]">
                    arXiv
                  </span>
                  <label className="flex min-w-0 items-center gap-2 text-xs text-[#647487]">
                    <Link2 className="size-3.5 shrink-0" />
                    <select
                      value={item.projectId ?? ""}
                      disabled={!canEditWork || linkItem.isPending}
                      onChange={event =>
                        linkItem.mutate({
                          id: item.id,
                          projectId: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                      className="h-8 min-w-0 max-w-56 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none disabled:opacity-70"
                      aria-label="ربط الخلاصة بمشروع"
                    >
                      <option value="">بدون مشروع مرتبط</option>
                      {data.projects.map((project: any) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Search className="mx-auto size-8 text-slate-300" />
          <p className="mt-4 text-sm font-semibold">لا توجد نتائج مطابقة</p>
          <p className="mt-2 text-xs text-[#7C8A9A]">
            {search
              ? "غيّر عبارة البحث أو اعرض كل الاهتمامات."
              : "سيجلب أثر النتائج تلقائيًا، ويمكن للمدير تشغيل التحديث الآن."}
          </p>
        </div>
      )}
    </div>
  );
}

function LessonsLearnedPage({ data, workspaceName, openLesson }: any) {
  const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidRange = Boolean(from && to && from > to);
  const lessons = useMemo(() => {
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
    return [...data.lessons]
      .filter((item: any) => {
        const time = new Date(item.lessonDate).getTime();
        return (
          (!projectId || item.projectId === Number(projectId)) &&
          (fromTime === null || time >= fromTime) &&
          (toTime === null || time <= toTime)
        );
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.lessonDate).getTime() - new Date(a.lessonDate).getTime()
      );
  }, [data.lessons, from, projectId, to]);
  const projectLabel = projectId
    ? (data.projects.find((project: any) => project.id === Number(projectId))
        ?.title ?? "المشروع المحدد")
    : "كل المشاريع";
  const exportReport = () => {
    if (invalidRange) {
      toast.error("تاريخ البداية يجب أن يسبق تاريخ النهاية");
      return;
    }
    printLessonsReport({
      lessons,
      workspaceName,
      projectLabel,
      from,
      to,
    });
  };
  const resetFilters = () => {
    setProjectId("");
    setFrom("");
    setTo("");
  };
  return (
    <div className="entry max-w-6xl">
      <PageHeading
        title="الدروس المستفادة"
        description="وش تعلمنا وكيف نستفيد منه في المشاريع القادمة؟"
        action={
          <Button
            onClick={() => {
              if (!data.projects.length) {
                toast.error("أضف مشروعًا أولًا قبل توثيق درس مستفاد");
                return;
              }
              openLesson();
            }}
            className="h-10 gap-2 bg-[#52769F] hover:bg-[#46698F]"
          >
            <Plus className="size-4" />
            إضافة درس
          </Button>
        }
      />

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">نطاق التقرير</h2>
            <p className="mt-1 text-xs text-[#7C8A9A]">
              صفِّ الدروس حسب المشروع أو الفترة ثم صدّر النتيجة بصيغة PDF.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(projectId || from || to) && (
              <Button
                variant="ghost"
                onClick={resetFilters}
                className="h-9 text-xs text-[#647487]"
              >
                مسح الفلاتر
              </Button>
            )}
            <Button
              variant="outline"
              onClick={exportReport}
              disabled={!lessons.length || invalidRange}
              className="h-9 gap-2 border-[#B8CBE0] text-[#52769F]"
            >
              <Download className="size-4" />
              تصدير PDF
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="المشروع">
            <select
              value={projectId}
              onChange={event => setProjectId(event.target.value)}
              className="form-select"
            >
              <option value="">كل المشاريع</option>
              {data.projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="من تاريخ">
            <Input
              type="date"
              value={from}
              onChange={event => setFrom(event.target.value)}
              className={cn(invalidRange && "border-rose-300")}
            />
          </Field>
          <Field label="إلى تاريخ">
            <Input
              type="date"
              value={to}
              onChange={event => setTo(event.target.value)}
              className={cn(invalidRange && "border-rose-300")}
            />
          </Field>
        </div>
        {invalidRange && (
          <p className="mt-3 text-xs text-rose-600">
            تاريخ البداية يجب أن يسبق تاريخ النهاية.
          </p>
        )}
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(lessonCategoryLabel).map(([category, label]) => {
          const count = lessons.filter(
            (item: any) => item.category === category
          ).length;
          return (
            <div
              key={category}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"
            >
              <p className="text-[11px] text-[#7C8A9A]">{label}</p>
              <p className="mt-1.5 text-xl font-bold text-[#52657A]">{count}</p>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">سجل الدروس</h2>
            <p className="mt-1 text-[11px] text-[#7C8A9A]">
              {lessons.length} {lessons.length === 1 ? "درس" : "دروس"} ضمن
              النطاق الحالي
            </p>
          </div>
          <span className="rounded-full bg-[#EDF4FA] px-3 py-1 text-xs font-semibold text-[#52769F]">
            {projectLabel}
          </span>
        </div>
        {lessons.length ? (
          <div className="divide-y divide-slate-100">
            {lessons.map((item: any) => (
              <article key={item.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset",
                          lessonCategoryClass[item.category]
                        )}
                      >
                        {lessonCategoryLabel[item.category] ?? item.category}
                      </span>
                      <span className="text-[11px] text-[#7C8A9A]">
                        {item.projectTitle}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[#26364A]">
                      {item.title}
                    </h3>
                  </div>
                  <div className="text-left text-[11px] leading-5 text-[#7C8A9A]">
                    <p>{fullDateText(item.lessonDate)}</p>
                    <p>{item.authorName}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-[#52769F]">
                      الدرس المستفاد
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-[#52657A]">
                      {item.lesson}
                    </p>
                  </div>
                  {item.recommendation && (
                    <div className="rounded-lg border-r-2 border-[#6C8FB8] bg-[#F7F9FC] px-4 py-3">
                      <p className="mb-1 text-[11px] font-semibold text-[#52769F]">
                        التوصية للمشاريع القادمة
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-[#52657A]">
                        {item.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#EDF4FA] text-[#52769F]">
              <Lightbulb className="size-6" />
            </span>
            <h3 className="mt-4 text-sm font-semibold">
              {data.lessons.length
                ? "لا توجد دروس ضمن النطاق المحدد"
                : "ابدأ بتوثيق أول درس مستفاد"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#7C8A9A]">
              سجّل ما نجح وما يمكن تحسينه ليكون مرجعًا عمليًا لكل المشاريع
              القادمة.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ReportsPage({ data, period, goPeriod }: any) {
  const tasksInPeriod = filterTasksByCompletionPeriod<any>(
    data.tasks,
    period as Period
  );
  const completed = tasksInPeriod.filter(
    (task: any) => task.status === "complete"
  ).length;
  const overdue = tasksInPeriod.filter(
    (task: any) => task.status === "overdue"
  ).length;
  const achievement = tasksInPeriod.length
    ? Math.round((completed / tasksInPeriod.length) * 100)
    : 0;
  const chart = [
    { name: "الأسبوع ١", value: 0 },
    { name: "الأسبوع ٢", value: 0 },
    { name: "الأسبوع ٣", value: 0 },
    { name: "الأسبوع ٤", value: achievement },
  ];
  return (
    <div className="entry max-w-5xl">
      <PageHeading
        title="التقارير"
        description="كيف أداء القسم؟"
        action={<PeriodSelect value={period} onChange={goPeriod} />}
      />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {[
          {
            label: "الإنجاز",
            value: tasksInPeriod.length ? `${achievement}%` : "—",
            tone: "text-[#52769F]",
          },
          { label: "المتأخر", value: overdue, tone: "text-rose-700" },
          { label: "المكتمل", value: completed, tone: "text-emerald-700" },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white px-5 py-4"
          >
            <p className="text-xs text-[#7C8A9A]">{item.label}</p>
            <p className={cn("mt-2 text-2xl font-bold", item.tone)}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle>تطور الإنجاز</SectionTitle>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chart}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#7C8A9A", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#7C8A9A", fontSize: 11 }}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #E6EDF3",
                  fontFamily: "IBM Plex Sans Arabic",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6C8FB8"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#6C8FB8" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="mt-5 max-w-3xl rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle>ملخص</SectionTitle>
        <div className="space-y-3 text-sm leading-6 text-[#52657A]">
          <p>
            ستظهر استنتاجات الأداء تلقائيًا بعد إدخال أعمال القسم وبياناتها
            الفعلية.
          </p>
        </div>
      </section>
    </div>
  );
}

function McpPage() {
  const utils = trpc.useUtils();
  const endpoint = `${window.location.origin}/mcp`;
  const mcpConnections = trpc.auth.mcpConnections.useQuery(undefined, {
    retry: false,
  });
  const revokeMcpConnections = trpc.auth.revokeMcpConnections.useMutation({
    onSuccess: async () => {
      await utils.auth.mcpConnections.invalidate();
      toast.success("تم فصل المساعدات الذكية عن حساب أثر");
    },
    onError: issue => toast.error(issue.message),
  });
  const copyEndpoint = async () => {
    await navigator.clipboard.writeText(endpoint);
    toast.success("تم نسخ رابط MCP");
  };
  const connectorOptions = [
    {
      name: "Claude",
      description:
        "أضف الرابط من Settings ثم Connectors واختر إضافة موصل مخصص.",
      href: "https://claude.ai/settings/connectors",
      action: "فتح موصلات Claude",
    },
    {
      name: "ChatGPT",
      description:
        "أنشئ تطبيقًا مخصصًا باسم أثر، ثم استخدم الرابط نفسه كخادم MCP.",
      href: "https://chatgpt.com/plugins",
      action: "فتح تطبيقات ChatGPT",
    },
  ];

  return (
    <div className="entry max-w-5xl">
      <PageHeading
        title="ربط المساعد الذكي"
        description="اربط أثر بالمساعد الذي تستخدمه، وأدر أعمالك بالمحادثة دون مغادرة حسابك."
      />

      <section className="rounded-xl border border-[#DCE7F2] bg-[#FBFDFF] p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E9F2FA] text-[#52769F]">
              <Link2 className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-[#26364A]">
                  رابط أثر الموحّد
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  جاهز للربط
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7C8A9A]">
                يعمل الرابط مع Claude وChatGPT وأي مساعد يدعم Remote MCP وOAuth.
                بعد إضافته، سجّل الدخول إلى أثر ووافق على الصلاحيات المطلوبة.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <SettingsCopyField
            label="رابط MCP الخاص بأثر"
            value={endpoint}
            onCopy={copyEndpoint}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-[#7C8A9A]">
          يلتزم المساعد بدورك داخل أثر؛ لا يمكنه الوصول إلى لوحة أو مشروع غير
          متاح لك، وتعمل الإضافة والتعديل والحذف ضمن صلاحيات حسابك.
        </p>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {connectorOptions.map(option => (
          <section
            key={option.name}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold">{option.name}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#7C8A9A]">
              {option.description}
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-5 w-fit gap-2 border-[#BFD3E7] text-[#45698F]"
            >
              <a href={option.href} target="_blank" rel="noreferrer">
                {option.action}
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </section>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <SectionTitle>الاتصالات الحالية</SectionTitle>
        <div className="mt-4 rounded-lg border border-slate-100 bg-[#FCFDFE] px-4">
          {mcpConnections.isLoading ? (
            <p className="py-5 text-sm text-[#7C8A9A]">
              جارٍ التحقق من الاتصالات…
            </p>
          ) : (mcpConnections.data?.length ?? 0) > 0 ? (
            <div className="divide-y divide-slate-100">
              {mcpConnections.data?.map(connection => (
                <div
                  key={connection.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {connection.clientName}
                    </p>
                    <p className="mt-1 text-xs text-[#7C8A9A]">
                      آخر استخدام: {fullDateText(connection.lastUsedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    متصل
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-5 text-sm text-[#7C8A9A]">
              لا يوجد مساعد ذكي مرتبط بهذا الحساب حاليًا.
            </p>
          )}
        </div>
        {(mcpConnections.data?.length ?? 0) > 0 && (
          <div className="mt-4 flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 border-rose-200 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                >
                  فصل جميع الاتصالات
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>فصل المساعدات الذكية؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    ستتوقف جميع اتصالات المساعدات بهذا الحساب، ويمكن إعادة الربط
                    لاحقًا.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => revokeMcpConnections.mutate()}
                    className="bg-rose-600 hover:bg-rose-700"
                  >
                    فصل الاتصالات
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingsPage({
  board,
  accountRole,
}: {
  board?: {
    id: number;
    name: string;
    joinCode: string;
    inviteToken: string;
    membershipRole: string;
    enabledModules?: BoardModule[] | null;
    presentationSections?: PresentationSection[] | null;
  };
  accountRole?: string | null;
}) {
  const utils = trpc.useUtils();
  const canManage =
    board?.membershipRole === "manager" || accountRole === "admin";
  const [selectedModules, setSelectedModules] = useState<BoardModule[]>(
    board?.enabledModules ?? DEFAULT_BOARD_MODULES
  );
  const [selectedPresentationSections, setSelectedPresentationSections] =
    useState<PresentationSection[]>(
      supportedPresentationSections(board?.presentationSections)
    );
  useEffect(() => {
    setSelectedModules(board?.enabledModules ?? DEFAULT_BOARD_MODULES);
    setSelectedPresentationSections(
      supportedPresentationSections(board?.presentationSections)
    );
  }, [board?.id, board?.enabledModules, board?.presentationSections]);
  const updateModules = trpc.workspace.updateBoardModules.useMutation({
    onSuccess: async () => {
      await utils.boards.mine.invalidate();
      toast.success("تم حفظ تبويبات اللوحة");
    },
    onError: issue => toast.error(issue.message),
  });
  const updatePresentationSections =
    trpc.workspace.updateBoardPresentationSections.useMutation({
      onSuccess: async () => {
        await utils.boards.mine.invalidate();
        toast.success("تم حفظ أقسام وضع العرض");
      },
      onError: issue => toast.error(issue.message),
    });
  const moduleOptions: {
    id: BoardModule;
    label: string;
    description: string;
    icon: typeof Target;
  }[] = [
    {
      id: "plan",
      label: "الخطة السنوية",
      description: "الأهداف السنوية والمتابعة حسب الفترات.",
      icon: Target,
    },
    {
      id: "projects",
      label: "المشاريع",
      description: "المشاريع وتقدمها والمخرجات المرتبطة بها.",
      icon: FolderKanban,
    },
    {
      id: "tasks",
      label: "المهام",
      description: "إنشاء الأعمال وإسنادها ومتابعة حالتها.",
      icon: ListChecks,
    },
    {
      id: "team",
      label: "الفريق",
      description: "الأعضاء والأدوار وعبء العمل وإدارة الوصول.",
      icon: Users,
    },
    {
      id: "calendar",
      label: "التقويم والإطلاقات",
      description: "مواعيد المهام والإطلاقات والاجتماعات والتسليمات القادمة.",
      icon: CalendarDays,
    },
    {
      id: "feeds",
      label: "الخلاصات البحثية",
      description: "أبحاث جديدة حسب الكلمات والاهتمامات التي يحددها المدير.",
      icon: Rss,
    },
    {
      id: "reports",
      label: "التقارير",
      description: "ملخص الإنجاز والتأخر ومؤشرات الأداء.",
      icon: BarChart3,
    },
    {
      id: "lessons",
      label: "الدروس المستفادة",
      description: "توثيق الخبرات وربطها بالمشاريع وإصدار تقاريرها.",
      icon: Lightbulb,
    },
  ];
  const toggleModule = (module: BoardModule, enabled: boolean) => {
    setSelectedModules(current =>
      enabled
        ? DEFAULT_BOARD_MODULES.filter(
            item => item === module || current.includes(item)
          )
        : current.filter(item => item !== module)
    );
  };
  const togglePresentationSection = (
    section: PresentationSection,
    enabled: boolean
  ) => {
    setSelectedPresentationSections(current =>
      enabled
        ? presentationSectionOptions
            .map(option => option.id)
            .filter(item => item === section || current.includes(item))
        : current.filter(item => item !== section)
    );
  };
  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`تم نسخ ${label}`);
  };
  return (
    <div className="entry max-w-3xl">
      <PageHeading
        title="الإعدادات"
        description="إدارة تفضيلات القسم وصلاحيات الوصول."
      />
      {board && canManage && (
        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle>تخصيص القائمة الجانبية</SectionTitle>
          <p className="mb-5 text-sm leading-6 text-[#7C8A9A]">
            اختر الأقسام التي يحتاجها فريق هذه اللوحة. الرئيسية والإعدادات
            تبقيان ظاهرتين دائمًا.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {moduleOptions.map(option => (
              <div
                key={option.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-[#FCFDFE] p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EDF4FA] text-[#52769F]">
                  <option.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#7C8A9A]">
                    {option.description}
                  </p>
                </div>
                <Switch
                  checked={selectedModules.includes(option.id)}
                  onCheckedChange={checked => toggleModule(option.id, checked)}
                  aria-label={`إظهار ${option.label}`}
                  className="mt-1 data-[state=checked]:bg-[#52769F]"
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-[#7C8A9A]">
              ستُطبق التغييرات على جميع أعضاء هذه اللوحة.
            </p>
            <Button
              onClick={() =>
                updateModules.mutate({ enabledModules: selectedModules })
              }
              disabled={updateModules.isPending}
              className="h-9 shrink-0 bg-[#52769F] px-5 hover:bg-[#46698F]"
            >
              {updateModules.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </section>
      )}
      {board && canManage && (
        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
          <SectionTitle>تخصيص وضع العرض</SectionTitle>
          <p className="mb-5 text-sm leading-6 text-[#7C8A9A]">
            اختر البطاقات التي تريد إظهارها عند فتح وضع العرض لهذه اللوحة. يمكنك
            إضافة أي بطاقة أو إخفائها مع إبقاء بطاقة واحدة على الأقل.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {presentationSectionOptions.map(option => {
              const selected = selectedPresentationSections.includes(option.id);
              return (
                <div
                  key={option.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 bg-[#FCFDFE] p-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EDF4FA] text-[#52769F]">
                    <option.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#7C8A9A]">
                      {option.description}
                    </p>
                  </div>
                  <Switch
                    checked={selected}
                    disabled={
                      selected && selectedPresentationSections.length === 1
                    }
                    onCheckedChange={checked =>
                      togglePresentationSection(option.id, checked)
                    }
                    aria-label={`إظهار ${option.label} في وضع العرض`}
                    className="mt-1 data-[state=checked]:bg-[#52769F]"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-[#7C8A9A]">
              المختار حاليًا: {selectedPresentationSections.length} بطاقات
            </p>
            <Button
              onClick={() =>
                updatePresentationSections.mutate({
                  presentationSections: selectedPresentationSections,
                })
              }
              disabled={updatePresentationSections.isPending}
              className="h-9 shrink-0 bg-[#52769F] px-5 hover:bg-[#46698F]"
            >
              {updatePresentationSections.isPending
                ? "جارٍ الحفظ..."
                : "حفظ وضع العرض"}
            </Button>
          </div>
        </section>
      )}
      <BrowserNotificationSettings />
      {SHOW_BOARD_JOIN_LINKS && board && canManage && (
        <div className="mb-5 rounded-xl border border-[#DCE7F2] bg-[#FBFDFF] p-5">
          <SectionTitle>مشاركة لوحة الإدارة</SectionTitle>
          <p className="mb-4 text-sm text-[#7C8A9A]">
            شارك رمزًا أو رابطًا مع فريقك للانضمام إلى «{board.name}».
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsCopyField
              label="رمز اللوحة"
              value={board.joinCode}
              onCopy={() => copy(board.joinCode, "رمز اللوحة")}
            />
            <SettingsCopyField
              label="رابط الانضمام"
              value={`${window.location.origin}/join/${board.inviteToken}`}
              onCopy={() =>
                copy(
                  `${window.location.origin}/join/${board.inviteToken}`,
                  "رابط الانضمام"
                )
              }
            />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle>الصلاحيات</SectionTitle>
        <div className="divide-y divide-slate-100">
          <div className="py-4">
            <p className="text-sm font-semibold">مدير اللوحة</p>
            <p className="mt-1 text-sm text-[#7C8A9A]">
              يدير دعوات الموظفين وإعدادات اللوحة.
            </p>
          </div>
          <div className="py-4">
            <p className="text-sm font-semibold">عضو الفريق</p>
            <p className="mt-1 text-sm text-[#7C8A9A]">
              يتعاون في المشاريع والمهام والتعليقات وإسناد العمل داخل اللوحة.
            </p>
          </div>
          <div className="py-4">
            <p className="text-sm font-semibold">المشاهد</p>
            <p className="mt-1 text-sm text-[#7C8A9A]">
              يطّلع على بيانات اللوحة دون إنشاء أو تعديل أو إسناد.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCopyField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[#52657A]">{label}</p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className="h-9 min-w-0 border-slate-200 bg-white text-xs"
        />
        <Button
          onClick={onCopy}
          variant="outline"
          className="h-9 border-slate-200 px-3 text-xs text-[#52769F]"
        >
          نسخ
        </Button>
      </div>
    </div>
  );
}

function PresentationMode({
  data,
  workspaceName,
  sections = DEFAULT_PRESENTATION_SECTIONS,
  canManage = false,
  close,
}: any) {
  const utils = trpc.useUtils();
  const [visibleSections, setVisibleSections] = useState<PresentationSection[]>(
    supportedPresentationSections(sections)
  );
  const [draftSections, setDraftSections] = useState<PresentationSection[]>(
    supportedPresentationSections(sections)
  );
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [completionPeriod, setCompletionPeriod] = useState<Period>("week");
  const [completionReferenceDate] = useState(() => new Date());
  useEffect(() => {
    const supportedSections = supportedPresentationSections(sections);
    setVisibleSections(supportedSections);
    setDraftSections(supportedSections);
  }, [sections]);
  const updatePresentationSections =
    trpc.workspace.updateBoardPresentationSections.useMutation({
      onSuccess: async (_result, input) => {
        setVisibleSections(input.presentationSections);
        setDraftSections(input.presentationSections);
        await utils.boards.mine.invalidate();
        setCustomizerOpen(false);
        toast.success("تم تحديث بطاقات وضع العرض");
      },
      onError: issue => toast.error(issue.message),
    });
  const togglePresentationSection = (
    section: PresentationSection,
    enabled: boolean
  ) => {
    setDraftSections(current =>
      enabled
        ? presentationSectionOptions
            .map(option => option.id)
            .filter(item => item === section || current.includes(item))
        : current.filter(item => item !== section)
    );
  };
  const changeCustomizerOpen = (open: boolean) => {
    if (open) setDraftSections(visibleSections);
    setCustomizerOpen(open);
  };
  const { data: researchFeed } = trpc.workspace.researchFeed.useQuery(
    undefined,
    { enabled: visibleSections.includes("feeds"), staleTime: 60_000 }
  );
  const completion = useMemo(
    () =>
      calculatePeriodCompletion(
        data.tasks,
        completionPeriod,
        completionReferenceDate
      ),
    [data.tasks, completionPeriod, completionReferenceDate]
  );
  const priorities = sortTasksByPriority(
    data.tasks.filter((task: any) => task.status !== "complete")
  ).slice(0, 5);
  const attentionReasonLabel = {
    due_soon: "اقترب الموعد النهائي",
    overdue: "متأخر",
    needs_support: "يحتاج دعم",
  } as const;
  const attention = sortTasksByPriority(
    data.tasks.filter((task: any) => getTaskAttentionReason(task))
  )
    .map((task: any) => ({
      ...task,
      reason: getTaskAttentionReason(task),
    }))
    .slice(0, 5);
  const presentationToday = new Date();
  presentationToday.setHours(0, 0, 0, 0);
  const upcomingLaunches = [...data.events]
    .filter(
      (event: any) =>
        event.type === "launch" &&
        new Date(event.eventDate) >= presentationToday
    )
    .sort(
      (a: any, b: any) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    )
    .slice(0, 5);
  const ongoingProjects = [...data.projects]
    .filter((project: any) => project.status !== "complete")
    .sort((a: any, b: any) => a.progress - b.progress)
    .slice(0, 5);
  const goals = [...data.goals]
    .sort((a: any, b: any) => a.progress - b.progress)
    .slice(0, 5);
  const members = [...data.members]
    .sort((a: any, b: any) => b.load - a.load)
    .slice(0, 5);
  const supportTasks = sortTasksByPriority(
    data.tasks.filter(
      (task: any) => task.needsSupport && task.status !== "complete"
    )
  ).slice(0, 5);
  const lessons = [...(data.lessons ?? [])]
    .sort(
      (a: any, b: any) =>
        new Date(b.lessonDate).getTime() - new Date(a.lessonDate).getTime()
    )
    .slice(0, 4);
  const feedItems = (researchFeed?.items ?? []).slice(0, 5);
  const cardClass =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";
  const empty = (message: string) => (
    <p className="py-6 text-center text-sm text-[#7C8A9A]">{message}</p>
  );
  const renderSection = (section: PresentationSection) => {
    if (section === "completion")
      return (
        <section key={section} className={cardClass}>
          <p className="text-sm text-[#7C8A9A]">إنجاز مهام الفترة</p>
          <p className="mt-4 text-6xl font-bold text-[#52769F]">
            {completion.total ? `${completion.percentage}%` : "—"}
          </p>
          <Progress
            value={completion.percentage}
            className="mt-6 h-2.5 bg-[#EDF4FA] [&>div]:bg-[#6C8FB8]"
          />
          <p className="mt-4 text-sm leading-6 text-[#7C8A9A]">
            {completion.total
              ? `${completion.completed} من ${completion.total} مهمة مكتملة حسب تاريخ الاستحقاق`
              : `لا توجد مهام مستحقة خلال ${periodLabels[completionPeriod]}`}
          </p>
        </section>
      );
    if (section === "priorities")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">أولويات المهام</h2>
          {priorities.length
            ? priorities.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 text-sm last:border-0"
                >
                  <span>{task.title}</span>
                  <PriorityPill priority={task.priority} />
                </div>
              ))
            : empty("لا توجد مهام مفتوحة")}
        </section>
      );
    if (section === "attention")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">يحتاج انتباه</h2>
          {attention.length
            ? attention.map((task: any) => (
                <div
                  key={task.id}
                  className="border-b border-slate-100 py-3 last:border-0"
                >
                  <p className="text-sm font-medium text-rose-700">
                    {task.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        task.reason === "overdue"
                          ? "bg-rose-50 text-rose-700"
                          : task.reason === "needs_support"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-sky-50 text-sky-700"
                      )}
                    >
                      {
                        attentionReasonLabel[
                          task.reason as keyof typeof attentionReasonLabel
                        ]
                      }
                    </span>
                    <span className="text-xs text-[#7C8A9A]">
                      {task.dueDate ? dateText(task.dueDate) : "بدون موعد"}
                    </span>
                  </div>
                </div>
              ))
            : empty("لا توجد عناصر تحتاج انتباه")}
        </section>
      );
    if (section === "upcoming")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">الإطلاقات القادمة</h2>
          {upcomingLaunches.length
            ? upcomingLaunches.map((event: any) => {
                const project = data.projects.find(
                  (item: any) => item.id === event.projectId
                );
                return (
                  <div
                    key={event.id}
                    className="border-b border-slate-100 py-3 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <Rocket className="mt-0.5 size-4 shrink-0 text-[#52769F]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="mt-1 text-xs text-[#7C8A9A]">
                          {dateText(event.eventDate)} ·{" "}
                          {project?.title ?? "بدون مشروع"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            : empty("لا توجد إطلاقات قادمة")}
        </section>
      );
    if (section === "projects")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">المشاريع</h2>
          {ongoingProjects.length
            ? ongoingProjects.map((project: any) => (
                <div
                  key={project.id}
                  className="border-b border-slate-100 py-3 last:border-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{project.title}</p>
                    <span className="text-xs font-semibold text-[#52769F]">
                      {project.progress}%
                    </span>
                  </div>
                  <Progress
                    value={project.progress}
                    className="mt-2 h-1.5 bg-[#EDF4FA] [&>div]:bg-[#6C8FB8]"
                  />
                </div>
              ))
            : empty("لا توجد مشاريع جارية")}
        </section>
      );
    if (section === "goals")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">الأهداف السنوية</h2>
          {goals.length
            ? goals.map((goal: any) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0"
                >
                  <p className="text-sm font-medium">{goal.title}</p>
                  <span className="text-xs font-semibold text-[#52769F]">
                    {goal.progress}%
                  </span>
                </div>
              ))
            : empty("لم تُضف أهداف سنوية")}
        </section>
      );
    if (section === "team")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">الفريق</h2>
          {members.length
            ? members.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      initials={member.avatarInitials}
                      color={member.color}
                      className="size-7 text-[9px]"
                    />
                    <p className="text-sm font-medium">{member.name}</p>
                  </div>
                  <span className="text-xs text-[#7C8A9A]">
                    {member.activeTaskCount} مهام
                  </span>
                </div>
              ))
            : empty("لا يوجد أعضاء في الفريق")}
        </section>
      );
    if (section === "support")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">طلبات الدعم</h2>
          {supportTasks.length
            ? supportTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="border-b border-slate-100 py-3 last:border-0"
                >
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[#7C8A9A]">
                    {task.supportRequest || "طلب دعم دون تفاصيل"}
                  </p>
                </div>
              ))
            : empty("لا توجد طلبات دعم مفتوحة")}
        </section>
      );
    if (section === "lessons")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">الدروس المستفادة</h2>
          {lessons.length
            ? lessons.map((lesson: any) => (
                <div
                  key={lesson.id}
                  className="border-b border-slate-100 py-3 last:border-0"
                >
                  <p className="text-sm font-medium">{lesson.title}</p>
                  <p className="mt-1 text-xs text-[#7C8A9A]">
                    {lesson.projectTitle}
                  </p>
                </div>
              ))
            : empty("لم تُوثق دروس مستفادة")}
        </section>
      );
    if (section === "feeds")
      return (
        <section key={section} className={cardClass}>
          <h2 className="mb-5 text-lg font-semibold">الخلاصات البحثية</h2>
          {feedItems.length
            ? feedItems.map((item: any) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-b border-slate-100 py-3 text-sm font-medium transition hover:text-[#52769F] last:border-0"
                >
                  {item.title}
                </a>
              ))
            : empty("لا توجد خلاصات بحثية بعد")}
        </section>
      );
    return null;
  };
  return (
    <>
      <div
        dir="rtl"
        className="presentation-shell min-h-screen bg-[#F7F9FC] p-4 pt-20 sm:p-7 sm:pt-20 md:p-12"
      >
        <div
          dir="ltr"
          className="presentation-controls fixed left-4 top-4 z-20 flex items-center gap-2 sm:left-6 sm:top-6"
        >
          <button
            onClick={close}
            aria-label="إغلاق وضع العرض"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <X className="size-5" />
          </button>
          {canManage && (
            <Button
              dir="rtl"
              variant="outline"
              onClick={() => changeCustomizerOpen(true)}
              className="h-10 gap-2 border-slate-200 bg-white px-3 text-[#52657A] shadow-sm hover:bg-slate-50"
            >
              <SlidersHorizontal className="size-4" />
              <span className="hidden sm:inline">إدارة البطاقات</span>
            </Button>
          )}
        </div>
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold text-[#6C8FB8]">
            وضع العرض · {periodLabels[completionPeriod]}
          </p>
          <h1 className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            لوحة {workspaceName}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-[#52657A]">
              فترة قياس الإنجاز
            </span>
            <PeriodSelect
              value={completionPeriod}
              onChange={setCompletionPeriod}
            />
          </div>
          <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleSections.map(renderSection)}
          </div>
        </div>
      </div>
      {canManage && (
        <Sheet open={customizerOpen} onOpenChange={changeCustomizerOpen}>
          <SheetContent
            side="left"
            dir="rtl"
            className="w-full overflow-y-auto sm:max-w-lg"
          >
            <SheetHeader className="text-right">
              <SheetTitle>إدارة بطاقات وضع العرض</SheetTitle>
              <SheetDescription>
                أظهر البطاقات التي تحتاجها في شاشة العرض، وأخفِ البقية. تُطبق
                الخيارات على هذه اللوحة فقط.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-7 space-y-3">
              {presentationSectionOptions.map(option => {
                const selected = draftSections.includes(option.id);
                return (
                  <div
                    key={option.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-[#FCFDFE] p-4"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EDF4FA] text-[#52769F]">
                      <option.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-1 text-xs leading-5 text-[#7C8A9A]">
                        {option.description}
                      </p>
                    </div>
                    <Switch
                      checked={selected}
                      disabled={selected && draftSections.length === 1}
                      onCheckedChange={checked =>
                        togglePresentationSection(option.id, checked)
                      }
                      aria-label={`إظهار ${option.label} في وضع العرض`}
                      className="mt-1 data-[state=checked]:bg-[#52769F]"
                    />
                  </div>
                );
              })}
            </div>
            <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t border-slate-100 bg-white py-4">
              <p className="text-xs text-[#7C8A9A]">
                المختار: {draftSections.length} بطاقات
              </p>
              <Button
                onClick={() =>
                  updatePresentationSections.mutate({
                    presentationSections: draftSections,
                  })
                }
                disabled={updatePresentationSections.isPending}
                className="h-10 bg-[#52769F] px-5 hover:bg-[#46698F]"
              >
                {updatePresentationSections.isPending
                  ? "جارٍ الحفظ..."
                  : "حفظ العرض"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function TaskDrawer({
  open,
  setOpen,
  data,
  submitting,
  onSubmit,
  initialProjectId,
}: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState(todayInputValue);
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("not_started");

  useEffect(() => {
    if (open) setProjectId(initialProjectId ? String(initialProjectId) : "");
  }, [initialProjectId, open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return toast.error("أدخل اسم المهمة");
    if (hasDueDate && startDate && dueDate && dueDate < startDate)
      return toast.error("الموعد النهائي يجب أن يكون بعد تاريخ البداية");
    onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        projectId: projectId ? Number(projectId) : null,
        assigneeMemberId: assigneeId ? Number(assigneeId) : null,
        startDate: startDate ? new Date(`${startDate}T09:00:00`) : null,
        dueDate: hasDueDate && dueDate ? new Date(`${dueDate}T09:00:00`) : null,
        priority,
        status,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setProjectId("");
          setAssigneeId("");
          setStartDate(todayInputValue());
          setHasDueDate(false);
          setDueDate("");
          setPriority("medium");
          setStatus("not_started");
          setOpen(false);
        },
      }
    );
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        dir="rtl"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="text-right">
          <SheetTitle>مهمة جديدة</SheetTitle>
          <SheetDescription>
            أضف المهمة مرة واحدة لتظهر تلقائيًا في الفترات المناسبة.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field label="اسم المهمة">
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: مراجعة دليل الاستخدام"
            />
          </Field>
          <Field label="وصف المهمة">
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#6C8FB8]"
              placeholder="تفاصيل المهمة أو النتيجة المطلوبة (اختياري)"
            />
          </Field>
          <Field label="المشروع">
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="form-select"
            >
              <option value="">غير مرتبط بمشروع</option>
              {data.projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المسؤول">
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="form-select"
            >
              <option value="">غير مسند</option>
              {data.members.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="تاريخ البداية">
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </Field>
          <div className="rounded-lg border border-slate-200 bg-[#FBFDFF] p-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium text-[#52657A]">
                  تحديد موعد نهائي
                </span>
                <span className="mt-1 block text-xs text-[#7C8A9A]">
                  اتركه مغلقًا إذا كانت المهمة بدون موعد محدد.
                </span>
              </span>
              <Switch
                checked={hasDueDate}
                onCheckedChange={checked => {
                  setHasDueDate(checked);
                  if (checked && !dueDate) setDueDate(futureInputValue(3));
                }}
              />
            </label>
            {hasDueDate && (
              <Input
                className="mt-3"
                type="date"
                value={dueDate}
                min={startDate}
                onChange={e => setDueDate(e.target.value)}
                required
              />
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="الأولوية">
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="form-select"
              >
                {Object.entries(priorityLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الحالة">
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
                className="form-select"
              >
                {Object.entries(taskStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button
            disabled={submitting}
            type="submit"
            className="h-10 w-full bg-[#52769F] hover:bg-[#46698F]"
          >
            {submitting ? "جارٍ الحفظ..." : "حفظ المهمة"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ProjectResponsibleSelector({
  members,
  selectedIds,
  onChange,
  idPrefix,
}: any) {
  return (
    <fieldset>
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-medium text-[#52657A]">
          المسؤولون عن المشروع
        </legend>
        <span className="text-[11px] text-[#7C8A9A]">
          {selectedIds.length
            ? `تم اختيار ${selectedIds.length}`
            : "اختر شخصًا أو أكثر"}
        </span>
      </div>
      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
        {members.map((member: any) => {
          const selected = selectedIds.includes(member.id);
          const inputId = `${idPrefix}-${member.id}`;
          return (
            <label
              key={member.id}
              htmlFor={inputId}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
                selected ? "bg-[#EDF4FA]" : "hover:bg-slate-50"
              )}
            >
              <Checkbox
                id={inputId}
                checked={selected}
                onCheckedChange={checked =>
                  onChange(
                    checked === true
                      ? [...selectedIds, member.id]
                      : selectedIds.filter((id: number) => id !== member.id)
                  )
                }
                className="data-[state=checked]:border-[#52769F] data-[state=checked]:bg-[#52769F]"
              />
              <Avatar
                initials={member.avatarInitials}
                color={member.color}
                className="size-7 text-[9px]"
              />
              <span className="text-sm text-[#40556D]">{member.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ProjectDrawer({ open, setOpen, data, submitting, onSubmit }: any) {
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState("");
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  const [summary, setSummary] = useState("");
  const [startDate, setStartDate] = useState(todayInputValue);
  const [endDate, setEndDate] = useState(() => futureInputValue(30));
  const [ongoing, setOngoing] = useState(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !ownerIds.length)
      return toast.error("أدخل اسم المشروع واختر مسؤولًا واحدًا على الأقل");
    if (!startDate) return toast.error("اختر تاريخ بداية المشروع");
    if (!ongoing && !endDate) return toast.error("اختر تاريخ نهاية المشروع");
    if (!ongoing && endDate < startDate)
      return toast.error("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
    onSubmit(
      {
        title: title.trim(),
        summary: summary.trim(),
        annualGoalId: goalId ? Number(goalId) : null,
        ownerMemberId: ownerIds[0],
        responsibleMemberIds: ownerIds,
        startDate: new Date(`${startDate}T12:00:00`),
        endDate: ongoing ? null : new Date(`${endDate}T12:00:00`),
        status: "planned",
      },
      {
        onSuccess: () => {
          setTitle("");
          setGoalId("");
          setOwnerIds([]);
          setSummary("");
          setStartDate(todayInputValue());
          setEndDate(futureInputValue(30));
          setOngoing(false);
          setOpen(false);
        },
      }
    );
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        dir="rtl"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="text-right">
          <SheetTitle>مشروع جديد</SheetTitle>
          <SheetDescription>
            يرتبط المشروع بهدف سنوي ويظهر في تقارير وخطط الفترة تلقائيًا.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field label="اسم المشروع">
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="اسم المشروع"
            />
          </Field>
          <Field label="الهدف المرتبط">
            <select
              value={goalId}
              onChange={e => setGoalId(e.target.value)}
              className="form-select"
            >
              <option value="">بدون هدف مرتبط</option>
              {data.goals.map((goal: any) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </Field>
          <ProjectResponsibleSelector
            members={data.members}
            selectedIds={ownerIds}
            onChange={setOwnerIds}
            idPrefix="new-project-owner"
          />
          <Field label="تاريخ البداية">
            <Input
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
              required
            />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[#52657A]">
              مدة المشروع
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={cn(
                  "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                  ongoing
                    ? "border-[#52769F] bg-[#EEF4FA] ring-1 ring-[#52769F]"
                    : "border-[#DCE7F2] bg-white hover:bg-[#F7FAFD]"
                )}
              >
                <input
                  type="radio"
                  name="project-duration"
                  value="ongoing"
                  checked={ongoing}
                  onChange={() => setOngoing(true)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-[#40556D]">
                  مستمر
                </span>
                <span className="mt-1 block text-xs text-[#7C8A9A]">
                  بدون تاريخ نهاية
                </span>
              </label>
              <label
                className={cn(
                  "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                  !ongoing
                    ? "border-[#52769F] bg-[#EEF4FA] ring-1 ring-[#52769F]"
                    : "border-[#DCE7F2] bg-white hover:bg-[#F7FAFD]"
                )}
              >
                <input
                  type="radio"
                  name="project-duration"
                  value="fixed"
                  checked={!ongoing}
                  onChange={() => setOngoing(false)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-[#40556D]">
                  له تاريخ نهاية
                </span>
                <span className="mt-1 block text-xs text-[#7C8A9A]">
                  ينتهي في تاريخ محدد
                </span>
              </label>
            </div>
          </fieldset>
          {!ongoing && (
            <Field label="تاريخ النهاية">
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={event => setEndDate(event.target.value)}
                required
              />
            </Field>
          )}
          <Field label="وصف مختصر">
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#6C8FB8]"
              placeholder="وصف مختصر للمشروع"
            />
          </Field>
          <Button
            disabled={submitting}
            type="submit"
            className="h-10 w-full bg-[#52769F] hover:bg-[#46698F]"
          >
            {submitting ? "جارٍ الحفظ..." : "حفظ المشروع"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function EditTaskDrawer({ task, setTask, data, submitting, onSubmit }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [hasDueDate, setHasDueDate] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("not_started");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
    setProjectId(task.projectId ? String(task.projectId) : "");
    setAssigneeId(task.assigneeMemberId ? String(task.assigneeMemberId) : "");
    setStartDate(dateInputValue(task.startDate));
    setDueDate(dateInputValue(task.dueDate));
    setHasDueDate(Boolean(task.dueDate));
    setPriority(task.priority ?? "medium");
    setStatus(task.status ?? "not_started");
  }, [task]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!task || !title.trim()) return toast.error("أدخل اسم المهمة");
    if (hasDueDate && startDate && dueDate && dueDate < startDate)
      return toast.error("الموعد النهائي يجب أن يكون بعد تاريخ البداية");
    onSubmit({
      id: task.id,
      title: title.trim(),
      description: description.trim(),
      projectId: projectId ? Number(projectId) : null,
      assigneeMemberId: assigneeId ? Number(assigneeId) : null,
      startDate: startDate ? new Date(`${startDate}T09:00:00`) : null,
      dueDate: hasDueDate && dueDate ? new Date(`${dueDate}T09:00:00`) : null,
      priority,
      status,
    });
  };

  return (
    <Sheet open={Boolean(task)} onOpenChange={open => !open && setTask(null)}>
      <SheetContent
        side="left"
        dir="rtl"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="text-right">
          <SheetTitle>تعديل المهمة</SheetTitle>
          <SheetDescription>
            حدّث بيانات المهمة وسيظهر التغيير لجميع أعضاء اللوحة.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field label="اسم المهمة">
            <Input
              autoFocus
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </Field>
          <Field label="وصف المهمة">
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#6C8FB8]"
              placeholder="تفاصيل المهمة أو النتيجة المطلوبة (اختياري)"
            />
          </Field>
          <Field label="المشروع">
            <select
              value={projectId}
              onChange={event => setProjectId(event.target.value)}
              className="form-select"
            >
              <option value="">غير مرتبط بمشروع</option>
              {data.projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المسؤول">
            <select
              value={assigneeId}
              onChange={event => setAssigneeId(event.target.value)}
              className="form-select"
            >
              <option value="">غير مسند</option>
              {data.members.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="تاريخ البداية">
            <Input
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
            />
          </Field>
          <div className="rounded-lg border border-slate-200 bg-[#FBFDFF] p-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium text-[#52657A]">
                  تحديد موعد نهائي
                </span>
                <span className="mt-1 block text-xs text-[#7C8A9A]">
                  عند إيقافه يظهر الموعد «غير محدد».
                </span>
              </span>
              <Switch
                checked={hasDueDate}
                onCheckedChange={checked => {
                  setHasDueDate(checked);
                  if (checked && !dueDate) setDueDate(futureInputValue(3));
                }}
              />
            </label>
            {hasDueDate && (
              <Input
                className="mt-3"
                type="date"
                value={dueDate}
                min={startDate}
                onChange={event => setDueDate(event.target.value)}
                required
              />
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="الأولوية">
              <select
                value={priority}
                onChange={event => setPriority(event.target.value)}
                className="form-select"
              >
                {Object.entries(priorityLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الحالة">
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
                className="form-select"
              >
                {Object.entries(taskStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button
            disabled={submitting}
            type="submit"
            className="h-10 w-full bg-[#52769F] hover:bg-[#46698F]"
          >
            {submitting ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function EditProjectDrawer({
  project,
  setProject,
  data,
  submitting,
  onSubmit,
}: any) {
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState("");
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  const [summary, setSummary] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ongoing, setOngoing] = useState(false);
  const [status, setStatus] = useState("planned");

  useEffect(() => {
    if (!project) return;
    setTitle(project.title ?? "");
    setGoalId(project.annualGoalId ? String(project.annualGoalId) : "");
    setOwnerIds(
      project.responsibleMemberIds?.length
        ? project.responsibleMemberIds
        : [project.ownerMemberId]
    );
    setSummary(project.summary ?? "");
    setStartDate(dateInputValue(project.startDate));
    setEndDate(dateInputValue(project.endDate));
    setOngoing(!project.endDate);
    setStatus(project.status ?? "planned");
  }, [project]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!project || !title.trim() || !ownerIds.length)
      return toast.error("أدخل اسم المشروع واختر مسؤولًا واحدًا على الأقل");
    if (!startDate) return toast.error("اختر تاريخ بداية المشروع");
    if (!ongoing && !endDate) return toast.error("اختر تاريخ نهاية المشروع");
    if (!ongoing && endDate < startDate)
      return toast.error("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
    onSubmit({
      id: project.id,
      title: title.trim(),
      summary: summary.trim(),
      annualGoalId: goalId ? Number(goalId) : null,
      ownerMemberId: ownerIds[0],
      responsibleMemberIds: ownerIds,
      startDate: new Date(`${startDate}T12:00:00`),
      endDate: ongoing ? null : new Date(`${endDate}T12:00:00`),
      status,
    });
  };

  return (
    <Sheet
      open={Boolean(project)}
      onOpenChange={open => !open && setProject(null)}
    >
      <SheetContent
        side="left"
        dir="rtl"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="text-right">
          <SheetTitle>تعديل المشروع</SheetTitle>
          <SheetDescription>
            حدّث بيانات المشروع والمسؤولين والمدة من مكان واحد.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field label="اسم المشروع">
            <Input
              autoFocus
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </Field>
          <Field label="الهدف المرتبط">
            <select
              value={goalId}
              onChange={event => setGoalId(event.target.value)}
              className="form-select"
            >
              <option value="">بدون هدف مرتبط</option>
              {data.goals.map((goal: any) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </Field>
          <ProjectResponsibleSelector
            members={data.members}
            selectedIds={ownerIds}
            onChange={setOwnerIds}
            idPrefix="edit-project-owner"
          />
          <Field label="تاريخ البداية">
            <Input
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
              required
            />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[#52657A]">
              مدة المشروع
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={cn(
                  "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                  ongoing
                    ? "border-[#52769F] bg-[#EEF4FA] ring-1 ring-[#52769F]"
                    : "border-[#DCE7F2] bg-white hover:bg-[#F7FAFD]"
                )}
              >
                <input
                  type="radio"
                  name="edit-project-duration"
                  checked={ongoing}
                  onChange={() => setOngoing(true)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-[#40556D]">
                  مستمر
                </span>
                <span className="mt-1 block text-xs text-[#7C8A9A]">
                  بدون تاريخ نهاية
                </span>
              </label>
              <label
                className={cn(
                  "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                  !ongoing
                    ? "border-[#52769F] bg-[#EEF4FA] ring-1 ring-[#52769F]"
                    : "border-[#DCE7F2] bg-white hover:bg-[#F7FAFD]"
                )}
              >
                <input
                  type="radio"
                  name="edit-project-duration"
                  checked={!ongoing}
                  onChange={() => setOngoing(false)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-[#40556D]">
                  له تاريخ نهاية
                </span>
                <span className="mt-1 block text-xs text-[#7C8A9A]">
                  ينتهي في تاريخ محدد
                </span>
              </label>
            </div>
          </fieldset>
          {!ongoing && (
            <Field label="تاريخ النهاية">
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={event => setEndDate(event.target.value)}
                required
              />
            </Field>
          )}
          <Field label="الحالة">
            <select
              value={status}
              onChange={event => setStatus(event.target.value)}
              className="form-select"
            >
              {Object.entries(projectStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="وصف مختصر">
            <textarea
              value={summary}
              onChange={event => setSummary(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#6C8FB8]"
            />
          </Field>
          <Button
            disabled={submitting}
            type="submit"
            className="h-10 w-full bg-[#52769F] hover:bg-[#46698F]"
          >
            {submitting ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function GoalDrawer({ open, setOpen, data, submitting, onSubmit }: any) {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !theme.trim() || !ownerId)
      return toast.error("أكمل اسم الهدف والمحور والمسؤول");
    onSubmit(
      {
        title: title.trim(),
        theme: theme.trim(),
        year: Number(year),
        ownerMemberId: Number(ownerId),
      },
      {
        onSuccess: () => {
          setTitle("");
          setTheme("");
          setOwnerId("");
          setOpen(false);
        },
      }
    );
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        dir="rtl"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="text-right">
          <SheetTitle>هدف سنوي جديد</SheetTitle>
          <SheetDescription>
            حدّد الهدف ومسؤوله، وسيُحسب تقدمه تلقائيًا من المشاريع المرتبطة به.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field label="اسم الهدف">
            <Input
              autoFocus
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="مثال: تحسين تجربة المستفيد"
            />
          </Field>
          <Field label="المحور الاستراتيجي">
            <Input
              value={theme}
              onChange={event => setTheme(event.target.value)}
              placeholder="مثال: التحول الرقمي"
            />
          </Field>
          <Field label="مسؤول الهدف">
            <select
              value={ownerId}
              onChange={event => setOwnerId(event.target.value)}
              className="form-select"
            >
              <option value="">اختر المسؤول</option>
              {data.members.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="السنة">
            <Input
              type="number"
              required
              min="2000"
              max="2100"
              value={year}
              onChange={event => setYear(event.target.value)}
            />
          </Field>
          <div className="rounded-lg bg-[#F7F9FC] p-3 text-xs leading-6 text-[#52657A]">
            يبدأ الإنجاز من 0%، ثم يتحدث تلقائيًا حسب تقدم المشاريع المرتبطة
            بهذا الهدف.
          </div>
          <Button
            disabled={submitting}
            type="submit"
            className="h-10 w-full bg-[#52769F] hover:bg-[#46698F]"
          >
            {submitting ? "جارٍ الحفظ..." : "حفظ الهدف"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function LessonDrawer({ open, setOpen, data, submitting, onSubmit }: any) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("improvement");
  const [lessonDate, setLessonDate] = useState(todayInputValue);
  const [lesson, setLesson] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !projectId || !lesson.trim()) {
      toast.error("أكمل عنوان الدرس والمشروع وتفاصيل الدرس");
      return;
    }
    onSubmit(
      {
        title: title.trim(),
        projectId: Number(projectId),
        category,
        lesson: lesson.trim(),
        recommendation: recommendation.trim() || undefined,
        lessonDate: new Date(`${lessonDate}T12:00:00`),
      },
      {
        onSuccess: () => {
          setTitle("");
          setProjectId("");
          setCategory("improvement");
          setLessonDate(todayInputValue());
          setLesson("");
          setRecommendation("");
          setOpen(false);
        },
      }
    );
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        dir="rtl"
        className="w-full overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="text-right">
          <SheetTitle>درس مستفاد جديد</SheetTitle>
          <SheetDescription>
            اربط الخبرة بالمشروع لتصبح جزءًا من ذاكرة الفريق وتقاريره.
          </SheetDescription>
        </SheetHeader>
        {data.projects.length ? (
          <form onSubmit={submit} className="mt-7 space-y-5">
            <Field label="عنوان الدرس">
              <Input
                autoFocus
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="مثال: إشراك المستفيدين مبكرًا حسّن المخرجات"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="المشروع المرتبط">
                <select
                  value={projectId}
                  onChange={event => setProjectId(event.target.value)}
                  className="form-select"
                  required
                >
                  <option value="">اختر المشروع</option>
                  {data.projects.map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="نوع الدرس">
                <select
                  value={category}
                  onChange={event => setCategory(event.target.value)}
                  className="form-select"
                >
                  {Object.entries(lessonCategoryLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="تاريخ الدرس">
              <Input
                type="date"
                value={lessonDate}
                onChange={event => setLessonDate(event.target.value)}
                required
              />
            </Field>
            <Field label="وش تعلمنا؟">
              <textarea
                value={lesson}
                onChange={event => setLesson(event.target.value)}
                className="min-h-32 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-7 outline-none focus:border-[#6C8FB8]"
                placeholder="اشرح الموقف والدرس بوضوح ليكون مفهومًا لمن لم يشارك في المشروع."
                maxLength={5000}
              />
            </Field>
            <Field label="التوصية للمشاريع القادمة (اختياري)">
              <textarea
                value={recommendation}
                onChange={event => setRecommendation(event.target.value)}
                className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-7 outline-none focus:border-[#6C8FB8]"
                placeholder="ما الإجراء العملي الذي ننصح به مستقبلًا؟"
                maxLength={5000}
              />
            </Field>
            <Button
              disabled={submitting}
              type="submit"
              className="h-10 w-full bg-[#52769F] hover:bg-[#46698F]"
            >
              {submitting ? "جارٍ الحفظ..." : "حفظ الدرس المستفاد"}
            </Button>
          </form>
        ) : (
          <div className="mt-8 rounded-xl border border-amber-100 bg-amber-50 p-5 text-sm leading-7 text-amber-800">
            أضف مشروعًا أولًا، وبعدها تقدر تربط به الدروس المستفادة.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InviteDrawer({ open, setOpen, data, submitting, onSubmit }: any) {
  const [name, setName] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [email, setEmail] = useState("");
  const [accessRole, setAccessRole] = useState<"manager" | "member" | "viewer">(
    "member"
  );
  const [projectAccess, setProjectAccess] = useState<"all" | "selected">("all");
  const [allowedProjectIds, setAllowedProjectIds] = useState<number[]>([]);
  const [invitePath, setInvitePath] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !teamRole.trim() || !email.trim())
      return toast.error("أكمل اسم العضو ودوره وبريده الإلكتروني");
    onSubmit(
      { name, teamRole, email, accessRole, projectAccess, allowedProjectIds },
      {
        onSuccess: (result: any) => {
          setInvitePath(`${window.location.origin}${result.invitePath}`);
          setName("");
          setTeamRole("");
          setEmail("");
          setProjectAccess("all");
          setAllowedProjectIds([]);
        },
      }
    );
  };
  return (
    <Sheet
      open={open}
      onOpenChange={value => {
        setOpen(value);
        if (!value) setInvitePath("");
      }}
    >
      <SheetContent
        side="left"
        dir="rtl"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="text-right">
          <SheetTitle>دعوة عضو فريق</SheetTitle>
          <SheetDescription>
            سيُضاف العضو إلى الفريق، ثم يربط حسابه تلقائيًا عند تسجيل الدخول
            بالبريد المدعو.
          </SheetDescription>
        </SheetHeader>
        {invitePath ? (
          <div className="mt-7 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">
              تم إنشاء رابط الدعوة
            </p>
            <p className="mt-2 text-xs leading-6 text-emerald-700">
              أرسله للموظف عبر القناة المناسبة. بعد تسجيل دخوله بالبريد نفسه،
              يصبح عضوًا في الفريق.
            </p>
            <Input
              readOnly
              value={invitePath}
              className="mt-4 h-10 border-emerald-200 bg-white text-left text-xs"
              dir="ltr"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigator.clipboard
                  .writeText(invitePath)
                  .then(() => toast.success("تم نسخ الرابط"))
              }
              className="mt-3 h-9 w-full border-emerald-200 text-emerald-800"
            >
              نسخ رابط الدعوة
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            <Field label="اسم الموظف">
              <Input
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="مثال: مها العتيبي"
              />
            </Field>
            <Field label="الدور في القسم">
              <Input
                value={teamRole}
                onChange={event => setTeamRole(event.target.value)}
                placeholder="مثال: أخصائية مشاريع"
              />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                dir="ltr"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </Field>
            <Field label="صلاحية المستخدم في اللوحة">
              <select
                value={accessRole}
                onChange={event =>
                  setAccessRole(
                    event.target.value as "manager" | "member" | "viewer"
                  )
                }
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="member">عضو — يضيف ويعدل ويسند الأعمال</option>
                <option value="manager">
                  مدير — يدير اللوحة والأعضاء والاعتمادات
                </option>
                <option value="viewer">مشاهد — عرض فقط</option>
              </select>
            </Field>
            {accessRole === "member" && (
              <Field label="المشاريع التي يستطيع رؤيتها">
                <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="invite-project-access"
                      checked={projectAccess === "all"}
                      onChange={() => setProjectAccess("all")}
                    />
                    كل مشاريع اللوحة
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="invite-project-access"
                      checked={projectAccess === "selected"}
                      onChange={() => setProjectAccess("selected")}
                    />
                    مشاريع محددة فقط
                  </label>
                  {projectAccess === "selected" && (
                    <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-2">
                      {data.projects.length ? (
                        data.projects.map((project: any) => (
                          <label
                            key={project.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 text-xs"
                          >
                            <Checkbox
                              checked={allowedProjectIds.includes(project.id)}
                              onCheckedChange={value =>
                                setAllowedProjectIds(current =>
                                  value === true
                                    ? Array.from(
                                        new Set([...current, project.id])
                                      )
                                    : current.filter(id => id !== project.id)
                                )
                              }
                            />
                            {project.title}
                          </label>
                        ))
                      ) : (
                        <p className="py-2 text-center text-xs text-slate-500">
                          لا توجد مشاريع حاليًا، ويمكن تحديدها لاحقًا من إدارة
                          الفريق.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Field>
            )}
            <Button
              disabled={submitting}
              type="submit"
              className="h-10 w-full bg-[#52769F] hover:bg-[#46698F]"
            >
              {submitting ? "جارٍ إنشاء الدعوة..." : "إنشاء رابط الدعوة"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#52657A]">
        {label}
      </span>
      {children}
    </label>
  );
}
function LoadingShell() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F7F9FC] p-4 sm:p-8 xl:mr-[272px]"
    >
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="mt-4 h-9 w-64 rounded bg-slate-200" />
        <div className="mt-10 h-28 max-w-xl rounded-xl bg-white" />
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="h-80 rounded-xl bg-white" />
          <div className="h-80 rounded-xl bg-white" />
        </div>
      </div>
    </div>
  );
}
