import { BrandLogo, BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  Beaker,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Compass,
  ExternalLink,
  FileText,
  FlaskConical,
  KeyRound,
  Lightbulb,
  Link2,
  ListTodo,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type LabPage =
  | "compass"
  | "problems"
  | "problem"
  | "ideas"
  | "interviews"
  | "experiments"
  | "tasks"
  | "compare"
  | "settings";

type EntityKind = "problem" | "idea";

type IdeaLabProps = {
  user: { id: number; name?: string | null; role?: string | null };
  board: {
    id: number;
    name: string;
    joinCode: string;
    inviteToken: string;
    membershipRole: string;
  };
  boards: Array<{ id: number; name: string }>;
  switchingBoard: boolean;
  onSelectBoard: (boardId: number) => void;
};

const stageLabels: Record<string, string> = {
  seed: "بذرة",
  exploration: "استكشاف",
  interviews: "مقابلات",
  experiment: "تجربة",
  promising: "فرصة واعدة",
  archived: "مؤرشفة",
};

const confidenceLabels: Record<string, string> = {
  low: "ثقة منخفضة",
  medium: "ثقة متوسطة",
  high: "ثقة مرتفعة",
};

const evidenceLabels: Record<string, string> = {
  none: "لا توجد أدلة",
  low: "ضعيفة",
  medium: "متوسطة",
  high: "قوية",
};

const interviewStatusLabels: Record<string, string> = {
  planned: "مخططة",
  completed: "أُجريت",
  transcribed: "مفرّغة",
  analyzed: "مُحللة",
};

const experimentStatusLabels: Record<string, string> = {
  planned: "مخططة",
  running: "جارية",
  review: "تحتاج قرارًا",
  complete: "مكتملة",
};

const taskStatusLabels: Record<string, string> = {
  todo: "جديدة",
  in_progress: "قيد التنفيذ",
  blocked: "متوقفة",
  done: "مكتملة",
};

const taskPriorityLabels: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "مرتفعة",
  urgent: "عاجلة",
};

const sourceStatusLabels: Record<string, string> = {
  not_requested: "لم تُحلل",
  draft: "ملخص للمراجعة",
  approved: "ملخص معتمد",
  failed: "تعذر التحليل",
};

function detectSourceType(url: string) {
  const value = url.toLowerCase();
  if (value.includes("tiktok.com")) return "tiktok";
  if (value.includes("youtube.com") || value.includes("youtu.be"))
    return "youtube";
  if (value.includes("instagram.com")) return "instagram";
  if (value.includes("spotify.com") || value.includes("podcasts"))
    return "podcast";
  return "website";
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "دون موعد";
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function initials(name?: string | null) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join("") || "و"
  );
}

function Pill({
  children,
  tone = "navy",
}: {
  children: React.ReactNode;
  tone?: "navy" | "green" | "yellow" | "burgundy" | "gray";
}) {
  const tones = {
    navy: "bg-[#E9EDF7] text-[#1E3A8A]",
    green: "bg-[#E9EDE4] text-[#45613F]",
    yellow: "bg-[#FFF3CC] text-[#806000]",
    burgundy: "bg-[#F5EAF0] text-[#7A2E5C]",
    gray: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function EmptyLabState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Lightbulb;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#CCD4E6] bg-white px-6 py-14 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#E9EDF7] text-[#1E3A8A]">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#62635F]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default function IdeaLab({
  user,
  board,
  boards,
  switchingBoard,
  onSelectBoard,
}: IdeaLabProps) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.ideaLab.overview.useQuery(undefined, {
    staleTime: 15_000,
  });
  const { data: aiSettings } = trpc.ideaLab.aiSettings.useQuery();
  const [page, setPage] = useState<LabPage>("compass");
  const [mobileNav, setMobileNav] = useState(false);
  const [composerKind, setComposerKind] = useState<EntityKind | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(
    null
  );
  const [sourceTarget, setSourceTarget] = useState<{
    kind: EntityKind;
    id: number;
  } | null>(null);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const canEdit = board.membershipRole !== "viewer";

  const refresh = () => utils.ideaLab.overview.invalidate();
  const createProblem = trpc.ideaLab.createProblem.useMutation();
  const createIdea = trpc.ideaLab.createIdea.useMutation();
  const createSource = trpc.ideaLab.createSource.useMutation();
  const createInterview = trpc.ideaLab.createInterview.useMutation();
  const createExperiment = trpc.ideaLab.createExperiment.useMutation();
  const createTask = trpc.ideaLab.createTask.useMutation();
  const updateProblem = trpc.ideaLab.updateProblem.useMutation({
    onSuccess: refresh,
    onError: issue => toast.error(issue.message),
  });
  const updateIdea = trpc.ideaLab.updateIdea.useMutation({
    onSuccess: refresh,
    onError: issue => toast.error(issue.message),
  });
  const updateTask = trpc.ideaLab.updateTask.useMutation({
    onSuccess: refresh,
    onError: issue => toast.error(issue.message),
  });
  const analyzeSource = trpc.ideaLab.analyzeSource.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("الملخص جاهز للمراجعة");
    },
    onError: issue => toast.error(issue.message),
  });
  const approveSource = trpc.ideaLab.approveSourceAnalysis.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("تم اعتماد الملخص");
    },
    onError: issue => toast.error(issue.message),
  });

  const selectedProblem = data?.problems.find(
    problem => problem.id === selectedProblemId
  );
  const selectedProblemSources =
    data?.sources.filter(source => source.problemId === selectedProblemId) ??
    [];

  const navItems: Array<{
    id: LabPage;
    label: string;
    icon: typeof Compass;
  }> = [
    { id: "compass", label: "بوصلة الفرص", icon: Compass },
    { id: "problems", label: "بنك المشكلات", icon: AlertTriangle },
    { id: "ideas", label: "الأفكار", icon: Lightbulb },
    { id: "interviews", label: "مقابلات العملاء", icon: ClipboardList },
    { id: "experiments", label: "التجارب", icon: FlaskConical },
    { id: "tasks", label: "المهام", icon: ListTodo },
    { id: "compare", label: "مقارنة الفرص", icon: Beaker },
    { id: "settings", label: "الإعدادات", icon: Settings },
  ];

  const navigate = (next: LabPage) => {
    setPage(next);
    setMobileNav(false);
  };

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2EE]">
        <Loader2 className="size-7 animate-spin text-[#1E3A8A]" />
      </div>
    );

  if (error || !data)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F2EE] p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto size-8 text-amber-600" />
          <h1 className="mt-4 font-bold">تعذر تحميل مختبر الأفكار</h1>
          <p className="mt-2 text-sm text-slate-500">{error?.message}</p>
        </div>
      </div>
    );

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F2EE] text-[#1F2328]">
      {mobileNav && (
        <button
          aria-label="إغلاق القائمة"
          onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-40 bg-slate-950/25 lg:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col bg-[#14285F] px-4 py-6 text-white transition-transform lg:translate-x-0",
          mobileNav ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-2">
          <BrandLogo light tagline />
          <button className="lg:hidden" onClick={() => setMobileNav(false)}>
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-white/55">مختبر الأفكار</p>
          <div className="relative mt-1">
            <select
              aria-label="اختيار اللوحة"
              value={board.id}
              disabled={switchingBoard}
              onChange={event => onSelectBoard(Number(event.target.value))}
              className="w-full appearance-none bg-transparent py-1 pl-6 text-sm font-bold outline-none"
            >
              {boards.map(item => (
                <option
                  key={item.id}
                  value={item.id}
                  className="text-slate-900"
                >
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1 left-0 size-4 text-white/60" />
          </div>
        </div>
        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const active =
              page === item.id ||
              (item.id === "problems" && page === "problem");
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition",
                  active
                    ? "bg-white font-bold text-[#14285F]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="flex size-7 items-center justify-center rounded-lg border border-current/40">
                  <item.icon className="size-4" />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#F6B801] text-xs font-extrabold text-[#14285F]">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">
                {user.name || "مستخدم وجهة"}
              </p>
              <p className="mt-0.5 text-[10px] text-white/55">
                {board.membershipRole === "manager"
                  ? "مدير المساحة"
                  : board.membershipRole === "viewer"
                    ? "مشاهد"
                    : "عضو"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:mr-[280px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#DEDFDC] bg-[#F5F2EE]/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNav(true)}
              className="rounded-xl border border-[#DEDFDC] bg-white p-2 lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden w-80 items-center gap-2 rounded-xl border border-[#DEDFDC] bg-white px-3 py-2.5 text-xs text-[#696D75] md:flex">
              <Search className="size-4" />
              ابحث في المشكلات والأفكار والمقابلات والمهام...
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                onClick={() => setComposerKind("problem")}
                className="gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">إضافة مشكلة أو فكرة</span>
              </Button>
            )}
            <BrandMark className="size-9 lg:hidden" />
          </div>
        </header>

        <div className="mx-auto max-w-[1450px] px-4 py-7 lg:px-8 lg:py-9">
          {page === "compass" && (
            <CompassPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setComposerKind("problem")}
              onNavigate={navigate}
              onProblem={(id: number) => {
                setSelectedProblemId(id);
                setPage("problem");
              }}
            />
          )}
          {page === "problems" && (
            <ProblemsPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setComposerKind("problem")}
              onOpen={(id: number) => {
                setSelectedProblemId(id);
                setPage("problem");
              }}
              onUpdate={(
                id: number,
                evidenceStrength: "none" | "low" | "medium" | "high"
              ) => updateProblem.mutate({ id, evidenceStrength })}
            />
          )}
          {page === "problem" && selectedProblem && (
            <ProblemPage
              problem={selectedProblem}
              sources={selectedProblemSources}
              ideas={data.ideas.filter(
                idea => idea.problemId === selectedProblem.id
              )}
              interviews={data.interviews.filter(
                interview => interview.problemId === selectedProblem.id
              )}
              canEdit={canEdit}
              aiConfigured={Boolean(aiSettings?.configured)}
              analyzingId={analyzeSource.variables?.sourceId}
              onBack={() => setPage("problems")}
              onAddSource={() =>
                setSourceTarget({ kind: "problem", id: selectedProblem.id })
              }
              onCreateIdea={() => setComposerKind("idea")}
              onAnalyze={(sourceId: number) =>
                analyzeSource.mutate({ sourceId })
              }
              onApprove={(sourceId: number) =>
                approveSource.mutate({ sourceId })
              }
              onOpenSettings={() => setPage("settings")}
            />
          )}
          {page === "ideas" && (
            <IdeasPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setComposerKind("idea")}
              onStage={(
                id: number,
                stage:
                  | "seed"
                  | "exploration"
                  | "interviews"
                  | "experiment"
                  | "promising"
                  | "archived"
              ) => updateIdea.mutate({ id, stage })}
              onAddSource={(id: number) =>
                setSourceTarget({ kind: "idea", id })
              }
            />
          )}
          {page === "interviews" && (
            <InterviewsPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setInterviewOpen(true)}
            />
          )}
          {page === "experiments" && (
            <ExperimentsPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setExperimentOpen(true)}
            />
          )}
          {page === "tasks" && (
            <TasksPage
              data={data}
              canEdit={canEdit}
              onAdd={() => {
                setEditingTask(null);
                setTaskDialogOpen(true);
              }}
              onOpen={(task: any) => {
                setEditingTask(task);
                setTaskDialogOpen(true);
              }}
              onStatus={(id: number, status: string) =>
                updateTask.mutate({ id, status: status as any })
              }
            />
          )}
          {page === "compare" && <ComparePage data={data} />}
          {page === "settings" && (
            <SettingsPage
              board={board}
              aiSettings={aiSettings}
              canManage={
                board.membershipRole === "manager" || user.role === "admin"
              }
            />
          )}
        </div>
      </main>

      <EntityComposer
        open={composerKind !== null}
        initialKind={composerKind ?? "problem"}
        problems={data.problems}
        pending={
          createProblem.isPending ||
          createIdea.isPending ||
          createSource.isPending
        }
        onClose={() => setComposerKind(null)}
        onSubmit={async (input: any) => {
          try {
            const created =
              input.kind === "problem"
                ? await createProblem.mutateAsync({
                    title: input.title,
                    description: input.description,
                    category: input.category,
                    audience: input.audience,
                  })
                : await createIdea.mutateAsync({
                    problemId: input.problemId,
                    title: input.title,
                    description: input.description,
                    category: input.category,
                    audience: input.audience,
                  });
            if (input.sourceUrl)
              await createSource.mutateAsync({
                problemId: input.kind === "problem" ? created.id : undefined,
                ideaId: input.kind === "idea" ? created.id : undefined,
                url: input.sourceUrl,
                sourceType: detectSourceType(input.sourceUrl),
                title: input.sourceTitle,
                notes: input.sourceNotes,
              });
            await refresh();
            setComposerKind(null);
            toast.success(
              input.kind === "problem"
                ? "تمت إضافة المشكلة"
                : "تمت إضافة الفكرة"
            );
          } catch (issue) {
            toast.error(
              issue instanceof Error ? issue.message : "تعذر حفظ السجل"
            );
          }
        }}
      />

      <SourceDialog
        target={sourceTarget}
        pending={createSource.isPending}
        onClose={() => setSourceTarget(null)}
        onSubmit={async (input: any) => {
          if (!sourceTarget) return;
          try {
            await createSource.mutateAsync({
              problemId:
                sourceTarget.kind === "problem" ? sourceTarget.id : undefined,
              ideaId:
                sourceTarget.kind === "idea" ? sourceTarget.id : undefined,
              url: input.url,
              sourceType: detectSourceType(input.url),
              title: input.title,
              notes: input.notes,
            });
            await refresh();
            setSourceTarget(null);
            toast.success("تمت إضافة الرابط الداعم");
          } catch (issue) {
            toast.error(
              issue instanceof Error ? issue.message : "تعذر إضافة الرابط"
            );
          }
        }}
      />

      <InterviewDialog
        open={interviewOpen}
        data={data}
        pending={createInterview.isPending}
        onClose={() => setInterviewOpen(false)}
        onSubmit={async (input: any) => {
          try {
            await createInterview.mutateAsync(input);
            await refresh();
            setInterviewOpen(false);
            toast.success("تمت إضافة المقابلة");
          } catch (issue) {
            toast.error(
              issue instanceof Error ? issue.message : "تعذر إضافة المقابلة"
            );
          }
        }}
      />

      <ExperimentDialog
        open={experimentOpen}
        ideas={data.ideas}
        pending={createExperiment.isPending}
        onClose={() => setExperimentOpen(false)}
        onSubmit={async (input: any) => {
          try {
            await createExperiment.mutateAsync(input);
            await refresh();
            setExperimentOpen(false);
            toast.success("تمت إضافة التجربة");
          } catch (issue) {
            toast.error(
              issue instanceof Error ? issue.message : "تعذر إضافة التجربة"
            );
          }
        }}
      />

      <TaskDialog
        open={taskDialogOpen}
        task={editingTask}
        data={data}
        pending={createTask.isPending || updateTask.isPending}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
        }}
        onSubmit={async (input: any) => {
          try {
            if (editingTask)
              await updateTask.mutateAsync({ id: editingTask.id, ...input });
            else await createTask.mutateAsync(input);
            await refresh();
            setTaskDialogOpen(false);
            setEditingTask(null);
            toast.success(editingTask ? "تم تحديث المهمة" : "تمت إضافة المهمة");
          } catch (issue) {
            toast.error(
              issue instanceof Error ? issue.message : "تعذر حفظ المهمة"
            );
          }
        }}
      />
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div>
        <p className="text-xs font-bold text-[#7A2E5C]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[#696D75]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function CompassPage({ data, canEdit, onAdd, onNavigate, onProblem }: any) {
  const activeIdeas = data.ideas.filter(
    (idea: any) => idea.stage !== "archived"
  );
  const nextProblem =
    data.problems.find((problem: any) => problem.evidenceStrength === "none") ??
    data.problems[0];
  const metrics = [
    ["أفكار نشطة", activeIdeas.length, Lightbulb, "navy"],
    ["مقابلات", data.interviews.length, ClipboardList, "green"],
    [
      "تجارب جارية",
      data.experiments.filter((item: any) => item.status === "running").length,
      FlaskConical,
      "yellow",
    ],
    ["مصادر داعمة", data.sources.length, Link2, "burgundy"],
  ] as const;
  return (
    <>
      <PageHeading
        eyebrow="بوصلة الفرص"
        title="إلى أين وصل الفريق؟"
        description="تابعوا ما تعلمتموه، وما يحتاج إلى دليل، والخطوة الأقرب لاتخاذ قرار أفضل."
        action={
          canEdit ? (
            <Button
              onClick={onAdd}
              className="gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
            >
              <Plus className="size-4" />
              إضافة مشكلة أو فكرة
            </Button>
          ) : undefined
        }
      />
      <div className="rounded-2xl border border-[#DEDFDC] bg-white p-5">
        <h2 className="font-bold">رحلة الأفكار</h2>
        <div className="mt-5 grid min-w-[560px] grid-cols-5 gap-2 overflow-hidden">
          {["seed", "exploration", "interviews", "experiment", "promising"].map(
            (stage, index) => (
              <div key={stage} className="relative text-center">
                {index > 0 && (
                  <span className="absolute top-3 right-[-50%] h-0.5 w-full bg-[#DEDFDC]" />
                )}
                <span
                  className={cn(
                    "relative mx-auto flex size-7 items-center justify-center rounded-full border-2 bg-white text-[10px] font-bold",
                    data.ideas.some((idea: any) => idea.stage === stage)
                      ? "border-[#1E3A8A] text-[#1E3A8A]"
                      : "border-[#DEDFDC] text-slate-400"
                  )}
                >
                  {
                    data.ideas.filter((idea: any) => idea.stage === stage)
                      .length
                  }
                </span>
                <p className="relative mt-2 text-xs font-semibold">
                  {stageLabels[stage]}
                </p>
              </div>
            )
          )}
        </div>
      </div>
      {nextProblem ? (
        <button
          onClick={() => onProblem(nextProblem.id)}
          className="mt-4 w-full rounded-2xl bg-[#1E3A8A] p-6 text-right text-white shadow-sm transition hover:bg-[#172E6E]"
        >
          <p className="text-xs font-bold text-white/65">الخطوة الأهم الآن</p>
          <h2 className="mt-3 text-xl font-bold leading-9">
            اجمعوا دليلًا إضافيًا حول: {nextProblem.title}
          </h2>
          <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#F6B801] px-4 py-2 text-xs font-bold text-[#14285F]">
            فتح المشكلة <ArrowLeft className="size-4" />
          </span>
        </button>
      ) : (
        <EmptyLabState
          icon={Compass}
          title="ابدأوا بمشكلة أو إشارة"
          description="لا تحتاجون إلى صياغة مثالية. اكتبوا ما لاحظتموه وأضيفوا الأدلة لاحقًا."
          action={
            canEdit ? (
              <Button onClick={onAdd}>إضافة أول مشكلة</Button>
            ) : undefined
          }
        />
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon, tone]) => (
          <div
            key={label}
            className="rounded-2xl border border-[#DEDFDC] bg-white p-5"
          >
            <div className="flex items-center justify-between text-xs text-[#696D75]">
              <span>{label}</span>
              <Icon className="size-4 text-[#1E3A8A]" />
            </div>
            <p className="mt-3 text-3xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold">أحدث الأفكار</h2>
        <button
          onClick={() => onNavigate("ideas")}
          className="text-xs font-bold text-[#1E3A8A]"
        >
          عرض جميع الأفكار ←
        </button>
      </div>
      {activeIdeas.length ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {activeIdeas.slice(0, 3).map((idea: any) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              sources={data.sources.filter((s: any) => s.ideaId === idea.id)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-white p-6 text-sm text-slate-500">
          لا توجد أفكار بعد.
        </p>
      )}
    </>
  );
}

function ProblemsPage({ data, canEdit, onAdd, onOpen, onUpdate }: any) {
  return (
    <>
      <PageHeading
        eyebrow="من الإشارة إلى الفرصة"
        title="بنك المشكلات"
        description="اجمعوا ما تلاحظونه، وافصلوا بين المشكلة الحقيقية والانطباع الأولي."
        action={
          canEdit ? (
            <Button
              onClick={onAdd}
              className="gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
            >
              <Plus className="size-4" />
              إضافة مشكلة
            </Button>
          ) : undefined
        }
      />
      {data.problems.length ? (
        <div className="space-y-3">
          {data.problems.map((problem: any) => {
            const sourceCount = data.sources.filter(
              (source: any) => source.problemId === problem.id
            ).length;
            const interviewCount = data.interviews.filter(
              (interview: any) => interview.problemId === problem.id
            ).length;
            return (
              <article
                key={problem.id}
                className="rounded-2xl border border-[#DEDFDC] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <button
                    onClick={() => onOpen(problem.id)}
                    className="flex-1 text-right"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill
                        tone={
                          problem.stage === "validated"
                            ? "green"
                            : problem.stage === "understanding"
                              ? "yellow"
                              : "burgundy"
                        }
                      >
                        {problem.stage === "validated"
                          ? "مشكلة واضحة"
                          : problem.stage === "understanding"
                            ? "قيد الفهم"
                            : "إشارة أولية"}
                      </Pill>
                      {problem.category && (
                        <Pill tone="gray">{problem.category}</Pill>
                      )}
                    </div>
                    <h2 className="mt-3 text-lg font-bold leading-8">
                      {problem.title}
                    </h2>
                    <p className="mt-1 text-xs text-[#696D75]">
                      {problem.audience || "لم تُحدد الفئة بعد"} · {sourceCount}{" "}
                      مصادر · {interviewCount} مقابلات
                    </p>
                  </button>
                  <div className="min-w-48 border-t border-[#EEE] pt-4 md:border-t-0 md:border-r md:pr-5 md:pt-0">
                    <label className="text-[10px] text-[#696D75]">
                      قوة الأدلة
                    </label>
                    {canEdit ? (
                      <select
                        value={problem.evidenceStrength}
                        onChange={event =>
                          onUpdate(problem.id, event.target.value)
                        }
                        className="mt-1 block w-full rounded-lg border border-[#DEDFDC] bg-white px-2 py-2 text-xs font-bold"
                      >
                        <option value="none">لا توجد</option>
                        <option value="low">ضعيفة</option>
                        <option value="medium">متوسطة</option>
                        <option value="high">قوية</option>
                      </select>
                    ) : (
                      <p className="mt-1 font-bold">
                        {evidenceLabels[problem.evidenceStrength]}
                      </p>
                    )}
                    <button
                      onClick={() => onOpen(problem.id)}
                      className="mt-3 text-xs font-bold text-[#1E3A8A]"
                    >
                      فتح المشكلة ←
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyLabState
          icon={AlertTriangle}
          title="لا توجد مشكلات بعد"
          description="ابدؤوا بمشكلة مباشرة أو سجلوا ملاحظة أولية ثم اجمعوا الأدلة حولها."
          action={
            canEdit ? (
              <Button onClick={onAdd}>إضافة أول مشكلة</Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

function ProblemPage({
  problem,
  sources,
  ideas,
  interviews,
  canEdit,
  aiConfigured,
  analyzingId,
  onBack,
  onAddSource,
  onCreateIdea,
  onAnalyze,
  onApprove,
  onOpenSettings,
}: any) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-xs font-bold text-[#1E3A8A]">
          بنك المشكلات ←
        </button>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onAddSource}>
              <Link2 className="ml-2 size-4" />
              إضافة دليل أو رابط
            </Button>
            <Button
              onClick={onCreateIdea}
              className="bg-[#1E3A8A] hover:bg-[#172E6E]"
            >
              <Lightbulb className="ml-2 size-4" />
              إنشاء فكرة منها
            </Button>
          </div>
        )}
      </div>
      <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-[#DEDFDC] bg-white p-6 shadow-sm">
          <Pill tone={problem.stage === "validated" ? "green" : "yellow"}>
            {problem.stage === "validated" ? "مشكلة واضحة" : "قيد الفهم"}
          </Pill>
          <h1 className="mt-4 text-2xl font-extrabold leading-10">
            {problem.title}
          </h1>
          <p className="mt-3 text-sm leading-8 text-[#696D75]">
            {problem.description || "لا يوجد وصف إضافي حتى الآن."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {problem.category && <Pill>{problem.category}</Pill>}
            {problem.audience && <Pill>{problem.audience}</Pill>}
          </div>
        </div>
        <div className="rounded-2xl bg-[#E9EDE4] p-6">
          <p className="text-xs text-[#45613F]">قوة الأدلة</p>
          <p className="mt-2 text-xl font-extrabold text-[#45613F]">
            {evidenceLabels[problem.evidenceStrength]}
          </p>
          <p className="mt-3 text-xs leading-6 text-[#536051]">
            {sources.length} مصادر · {interviews.length} مقابلات ·{" "}
            {ideas.length} أفكار مرتبطة
          </p>
        </div>
      </section>
      <section className="mt-5 rounded-2xl border border-[#DEDFDC] bg-white p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-bold">المصادر والروابط الداعمة</h2>
            <p className="mt-1 text-xs leading-6 text-[#696D75]">
              يبقى المصدر الأصلي محفوظًا، ويظهر ملخص الذكاء الاصطناعي كمسودة
              تحتاج اعتمادك.
            </p>
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onAddSource}>
              <Plus className="ml-2 size-4" />
              إضافة رابط
            </Button>
          )}
        </div>
        {sources.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {sources.map((source: any) => (
              <SourceCard
                key={source.id}
                source={source}
                aiConfigured={aiConfigured}
                pending={analyzingId === source.id}
                canEdit={canEdit}
                onAnalyze={() => onAnalyze(source.id)}
                onApprove={() => onApprove(source.id)}
                onOpenSettings={onOpenSettings}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[#CCD4E6] p-8 text-center text-sm text-[#696D75]">
            لا توجد روابط داعمة بعد.
          </div>
        )}
      </section>
    </>
  );
}

function SourceCard({
  source,
  aiConfigured,
  pending,
  canEdit,
  onAnalyze,
  onApprove,
  onOpenSettings,
}: any) {
  const tones: any = {
    not_requested: "gray",
    draft: "yellow",
    approved: "green",
    failed: "burgundy",
  };
  return (
    <article className="flex min-h-56 flex-col rounded-xl border border-[#DEDFDC] p-4">
      <div className="flex items-center justify-between gap-2">
        <Pill>{source.sourceType}</Pill>
        <Pill tone={tones[source.aiStatus]}>
          {sourceStatusLabels[source.aiStatus]}
        </Pill>
      </div>
      <h3 className="mt-3 font-bold leading-7">
        {source.title || "مصدر داعم"}
      </h3>
      {source.aiSummary ? (
        <p className="mt-2 whitespace-pre-line text-xs leading-6 text-[#62635F]">
          {source.aiSummary}
        </p>
      ) : (
        <p className="mt-2 line-clamp-4 text-xs leading-6 text-[#696D75]">
          {source.notes || "لم يُضف نص أو ملخص لهذا المصدر."}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#1E3A8A]"
        >
          المصدر <ExternalLink className="size-3" />
        </a>
        {canEdit &&
          source.aiStatus !== "approved" &&
          (aiConfigured ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onAnalyze}
            >
              {pending ? (
                <Loader2 className="ml-2 size-3 animate-spin" />
              ) : (
                <Sparkles className="ml-2 size-3" />
              )}
              {source.aiStatus === "draft" ? "إعادة التحليل" : "تلخيص بحسابي"}
            </Button>
          ) : (
            <button
              onClick={onOpenSettings}
              className="text-[11px] font-bold text-[#7A2E5C]"
            >
              أضف مفتاحك للتحليل
            </button>
          ))}
        {canEdit && source.aiStatus === "draft" && (
          <Button
            size="sm"
            onClick={onApprove}
            className="bg-[#45613F] hover:bg-[#354B31]"
          >
            <Check className="ml-1 size-3" />
            اعتماد
          </Button>
        )}
      </div>
    </article>
  );
}

function IdeaCard({
  idea,
  sources,
  onStage,
  onAddSource,
  canEdit = false,
}: any) {
  return (
    <article className="rounded-2xl border border-[#DEDFDC] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Pill
          tone={
            idea.confidence === "high"
              ? "green"
              : idea.confidence === "medium"
                ? "yellow"
                : "burgundy"
          }
        >
          {confidenceLabels[idea.confidence]}
        </Pill>
        <span className="text-[10px] text-[#696D75]">
          {sources.length} مصادر
        </span>
      </div>
      <h3 className="mt-3 font-bold leading-7">{idea.title}</h3>
      <p className="mt-2 line-clamp-3 text-xs leading-6 text-[#696D75]">
        {idea.description || "لا يوجد وصف إضافي."}
      </p>
      {canEdit && (
        <div className="mt-4 flex gap-2">
          <select
            value={idea.stage}
            onChange={event => onStage(idea.id, event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[#DEDFDC] bg-white px-2 py-2 text-xs font-bold"
          >
            {Object.entries(stageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddSource(idea.id)}
            aria-label="إضافة مصدر"
          >
            <Link2 className="size-4" />
          </Button>
        </div>
      )}
    </article>
  );
}

function IdeasPage({ data, canEdit, onAdd, onStage, onAddSource }: any) {
  const stages = [
    "seed",
    "exploration",
    "interviews",
    "experiment",
    "promising",
  ];
  return (
    <>
      <PageHeading
        eyebrow="محفظة الفريق"
        title="الأفكار"
        description="تابعوا كل فكرة بحسب ما تعلمتموه عنها، لا بحسب نسبة إنجاز وهمية."
        action={
          canEdit ? (
            <Button
              onClick={onAdd}
              className="gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
            >
              <Plus className="size-4" />
              إضافة فكرة
            </Button>
          ) : undefined
        }
      />
      {data.ideas.length ? (
        <div
          className="grid items-start gap-3 overflow-x-auto pb-4"
          style={{ gridTemplateColumns: "repeat(5,minmax(220px,1fr))" }}
        >
          {stages.map(stage => (
            <section
              key={stage}
              className="min-h-[420px] rounded-2xl bg-[#EDEAE5] p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">{stageLabels[stage]}</h2>
                <span className="rounded-lg bg-white px-2 py-1 text-[10px]">
                  {
                    data.ideas.filter((idea: any) => idea.stage === stage)
                      .length
                  }
                </span>
              </div>
              <div className="space-y-3">
                {data.ideas
                  .filter((idea: any) => idea.stage === stage)
                  .map((idea: any) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      sources={data.sources.filter(
                        (s: any) => s.ideaId === idea.id
                      )}
                      canEdit={canEdit}
                      onStage={onStage}
                      onAddSource={onAddSource}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyLabState
          icon={Lightbulb}
          title="لا توجد أفكار بعد"
          description="يمكن إنشاء فكرة مباشرة أو ربطها بمشكلة موجودة لتبقى الأدلة في سياقها."
          action={
            canEdit ? (
              <Button onClick={onAdd}>إضافة أول فكرة</Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

function InterviewsPage({ data, canEdit, onAdd }: any) {
  return (
    <>
      <PageHeading
        eyebrow="استمع قبل أن تبني"
        title="مقابلات العملاء"
        description="خططوا للمقابلات، وثقوا النص والملخص، واربطوا ما تعلمتموه بالمشكلة أو الفكرة."
        action={
          canEdit ? (
            <Button
              onClick={onAdd}
              className="gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
            >
              <Plus className="size-4" />
              إنشاء مقابلة
            </Button>
          ) : undefined
        }
      />
      {data.interviews.length ? (
        <div className="overflow-hidden rounded-2xl border border-[#DEDFDC] bg-white">
          {data.interviews.map((interview: any) => (
            <article
              key={interview.id}
              className="grid gap-3 border-b border-[#EEE] p-5 last:border-b-0 md:grid-cols-[150px_1fr_auto] md:items-center"
            >
              <div>
                <p className="text-xs text-[#696D75]">
                  {dateLabel(interview.interviewDate)}
                </p>
                <Pill
                  tone={
                    interview.status === "analyzed"
                      ? "green"
                      : interview.status === "transcribed"
                        ? "yellow"
                        : "navy"
                  }
                >
                  {interviewStatusLabels[interview.status]}
                </Pill>
              </div>
              <div>
                <h3 className="font-bold">{interview.participantLabel}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-[#696D75]">
                  {interview.summary ||
                    interview.insights ||
                    interview.transcript ||
                    "بانتظار إجراء المقابلة وتوثيقها."}
                </p>
              </div>
              <span className="text-xs text-[#696D75]">
                {interview.ideaId
                  ? "مرتبطة بفكرة"
                  : interview.problemId
                    ? "مرتبطة بمشكلة"
                    : "مقابلة عامة"}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <EmptyLabState
          icon={ClipboardList}
          title="لا توجد مقابلات بعد"
          description="أنشئوا مقابلة واربطوها بالفكرة أو المشكلة التي تريدون فهمها."
          action={
            canEdit ? (
              <Button onClick={onAdd}>إنشاء أول مقابلة</Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

function ExperimentsPage({ data, canEdit, onAdd }: any) {
  return (
    <>
      <PageHeading
        eyebrow="حوّل الافتراض إلى دليل"
        title="التجارب"
        description="حدّدوا معيار النجاح قبل التنفيذ، ثم سجّلوا ما حدث فعلًا."
        action={
          canEdit ? (
            <Button
              onClick={onAdd}
              disabled={!data.ideas.length}
              className="gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
            >
              <Plus className="size-4" />
              إنشاء تجربة
            </Button>
          ) : undefined
        }
      />
      {data.experiments.length ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {data.experiments.map((experiment: any) => {
            const idea = data.ideas.find(
              (item: any) => item.id === experiment.ideaId
            );
            const progress = experiment.targetValue
              ? Math.min(
                  100,
                  Math.round(
                    ((experiment.currentValue || 0) / experiment.targetValue) *
                      100
                  )
                )
              : 0;
            return (
              <article
                key={experiment.id}
                className="rounded-2xl border border-[#DEDFDC] bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#E9EDF7] text-[#1E3A8A]">
                    <FlaskConical className="size-5" />
                  </span>
                  <Pill
                    tone={
                      experiment.status === "complete"
                        ? "green"
                        : experiment.status === "review"
                          ? "burgundy"
                          : "yellow"
                    }
                  >
                    {experimentStatusLabels[experiment.status]}
                  </Pill>
                </div>
                <h3 className="mt-4 font-bold leading-7">{experiment.title}</h3>
                <p className="mt-2 rounded-xl bg-[#F7F7F5] p-3 text-xs leading-6 text-[#696D75]">
                  {experiment.hypothesis}
                </p>
                {experiment.targetValue !== null && (
                  <>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-[#1E3A8A]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-[#696D75]">
                      {experiment.currentValue || 0} من {experiment.targetValue}{" "}
                      · {progress}%
                    </p>
                  </>
                )}
                <p className="mt-3 text-[10px] font-semibold text-[#1E3A8A]">
                  {idea?.title || "فكرة محذوفة"}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyLabState
          icon={FlaskConical}
          title="لا توجد تجارب بعد"
          description={
            data.ideas.length
              ? "اختاروا أكثر افتراض قد يغيّر قراركم وصمموا تجربة صغيرة حوله."
              : "أضيفوا فكرة أولًا، ثم حوّلوا أخطر افتراض فيها إلى تجربة."
          }
          action={
            canEdit && data.ideas.length ? (
              <Button onClick={onAdd}>إنشاء أول تجربة</Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

function TasksPage({ data, canEdit, onAdd, onOpen, onStatus }: any) {
  const columns = ["todo", "in_progress", "blocked", "done"];
  const priorityTones: Record<string, "gray" | "navy" | "yellow" | "burgundy"> =
    {
      low: "gray",
      medium: "navy",
      high: "yellow",
      urgent: "burgundy",
    };
  const linkedLabel = (task: any) => {
    if (task.problemId)
      return `مشكلة: ${data.problems.find((item: any) => item.id === task.problemId)?.title || "غير متاحة"}`;
    if (task.ideaId)
      return `فكرة: ${data.ideas.find((item: any) => item.id === task.ideaId)?.title || "غير متاحة"}`;
    if (task.interviewId)
      return `مقابلة: ${data.interviews.find((item: any) => item.id === task.interviewId)?.participantLabel || "غير متاحة"}`;
    if (task.experimentId)
      return `تجربة: ${data.experiments.find((item: any) => item.id === task.experimentId)?.title || "غير متاحة"}`;
    return null;
  };
  const memberName = (userId: number | null) =>
    data.members.find((member: any) => member.userId === userId)?.name ||
    "غير مسندة";
  return (
    <>
      <PageHeading
        eyebrow="حوّل التعلم إلى خطوة"
        title="المهام"
        description="رتّبوا الخطوات العملية التي تحرّك المشكلة أو الفكرة أو المقابلة أو التجربة إلى الأمام."
        action={
          canEdit ? (
            <Button
              onClick={onAdd}
              className="gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
            >
              <Plus className="size-4" />
              إضافة مهمة
            </Button>
          ) : undefined
        }
      />
      {data.tasks.length ? (
        <div
          className="grid items-start gap-3 overflow-x-auto pb-4"
          style={{ gridTemplateColumns: "repeat(4,minmax(250px,1fr))" }}
        >
          {columns.map(status => {
            const tasks = data.tasks.filter(
              (task: any) => task.status === status
            );
            return (
              <section
                key={status}
                className="min-h-[430px] rounded-2xl bg-[#EDEAE5] p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold">
                    {taskStatusLabels[status]}
                  </h2>
                  <span className="rounded-lg bg-white px-2 py-1 text-[10px]">
                    {tasks.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {tasks.map((task: any) => {
                    const link = linkedLabel(task);
                    const overdue =
                      task.status !== "done" &&
                      task.dueDate &&
                      new Date(task.dueDate).getTime() < Date.now();
                    return (
                      <article
                        key={task.id}
                        onClick={() => onOpen(task)}
                        className="cursor-pointer rounded-2xl border border-[#DEDFDC] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Pill tone={priorityTones[task.priority]}>
                            {taskPriorityLabels[task.priority]}
                          </Pill>
                          {task.dueDate && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[10px] font-semibold",
                                overdue ? "text-[#A23842]" : "text-[#696D75]"
                              )}
                            >
                              <CalendarDays className="size-3" />
                              {dateLabel(task.dueDate)}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 font-bold leading-7">
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-6 text-[#696D75]">
                            {task.description}
                          </p>
                        )}
                        {link && (
                          <p className="mt-3 line-clamp-2 rounded-lg bg-[#F4F5F8] px-2.5 py-2 text-[10px] font-semibold leading-5 text-[#1E3A8A]">
                            {link}
                          </p>
                        )}
                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EEE] pt-3">
                          <span className="text-[10px] text-[#696D75]">
                            {memberName(task.assigneeUserId)}
                          </span>
                          {canEdit && (
                            <select
                              aria-label={`حالة ${task.title}`}
                              value={task.status}
                              onClick={event => event.stopPropagation()}
                              onChange={event => {
                                event.stopPropagation();
                                onStatus(task.id, event.target.value);
                              }}
                              className="rounded-lg border border-[#DEDFDC] bg-white px-2 py-1 text-[10px] font-bold"
                            >
                              {columns.map(value => (
                                <option key={value} value={value}>
                                  {taskStatusLabels[value]}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyLabState
          icon={ListTodo}
          title="لا توجد مهام بعد"
          description="أضيفوا أول خطوة عملية، واربطوها بالسجل الذي تخدمه ليبقى العمل في سياقه."
          action={
            canEdit ? (
              <Button onClick={onAdd}>إضافة أول مهمة</Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

function ComparePage({ data }: any) {
  const rows = data.ideas.filter((idea: any) => idea.stage !== "archived");
  return (
    <>
      <PageHeading
        eyebrow="قرار مبني على الأدلة"
        title="مقارنة الفرص"
        description="قارنوا المرحلة والثقة وحجم الأدلة قبل اختيار الفكرة التي تستحق التقدم."
      />
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-[#DEDFDC] bg-white">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="p-4">الفكرة</th>
                <th className="p-4">المرحلة</th>
                <th className="p-4">الثقة</th>
                <th className="p-4">المصادر</th>
                <th className="p-4">المقابلات</th>
                <th className="p-4">التجارب</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((idea: any) => (
                <tr
                  key={idea.id}
                  className="border-b border-[#EEE] last:border-b-0"
                >
                  <td className="p-4 font-bold">{idea.title}</td>
                  <td className="p-4">{stageLabels[idea.stage]}</td>
                  <td className="p-4">
                    <Pill
                      tone={
                        idea.confidence === "high"
                          ? "green"
                          : idea.confidence === "medium"
                            ? "yellow"
                            : "burgundy"
                      }
                    >
                      {confidenceLabels[idea.confidence]}
                    </Pill>
                  </td>
                  <td className="p-4">
                    {
                      data.sources.filter((s: any) => s.ideaId === idea.id)
                        .length
                    }
                  </td>
                  <td className="p-4">
                    {
                      data.interviews.filter((i: any) => i.ideaId === idea.id)
                        .length
                    }
                  </td>
                  <td className="p-4">
                    {
                      data.experiments.filter((e: any) => e.ideaId === idea.id)
                        .length
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyLabState
          icon={Beaker}
          title="لا توجد فرص للمقارنة"
          description="أضيفوا فكرتين أو أكثر، ثم اجمعوا الأدلة حول كل واحدة."
        />
      )}
    </>
  );
}

function SettingsPage({ board, aiSettings, canManage }: any) {
  const utils = trpc.useUtils();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(aiSettings?.model || "gpt-4.1-mini");
  const mcpConnections = trpc.auth.mcpConnections.useQuery(undefined, {
    retry: false,
  });
  const save = trpc.ideaLab.saveAiSettings.useMutation({
    onSuccess: async () => {
      setApiKey("");
      await utils.ideaLab.aiSettings.invalidate();
      toast.success("تم حفظ مفتاحك مشفرًا");
    },
    onError: issue => toast.error(issue.message),
  });
  const remove = trpc.ideaLab.deleteAiSettings.useMutation({
    onSuccess: async () => {
      await utils.ideaLab.aiSettings.invalidate();
      toast.success("تم حذف المفتاح");
    },
    onError: issue => toast.error(issue.message),
  });
  const inviteUrl = `${window.location.origin}/join/${board.inviteToken}`;
  const mcpEndpoint = `${window.location.origin}/mcp`;
  return (
    <>
      <PageHeading
        eyebrow="حسابك ومساحتك"
        title="الإعدادات"
        description="إعدادات الذكاء الاصطناعي تخص حسابك وحدك، ولا يدفع مدير المساحة تكلفة استخدام الأعضاء."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#DEDFDC] bg-white p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[#E9EDF7] text-[#1E3A8A]">
              <KeyRound className="size-5" />
            </span>
            <div>
              <h2 className="font-bold">OpenAI API</h2>
              <p className="mt-1 text-xs leading-6 text-[#696D75]">
                يُحفظ المفتاح مشفرًا ويستخدم فقط عندما تطلب التحليل.
              </p>
            </div>
          </div>
          {aiSettings?.configured && (
            <div className="mt-4 rounded-xl bg-[#E9EDE4] p-3 text-xs text-[#45613F]">
              مفتاح متصل ينتهي بـ <strong>{aiSettings.lastFour}</strong> ·
              النموذج {aiSettings.model}
            </div>
          )}
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold">
              مفتاح API
              <Input
                dir="ltr"
                type="password"
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                placeholder="sk-..."
                className="mt-2"
              />
            </label>
            <label className="block text-xs font-bold">
              النموذج
              <Input
                dir="ltr"
                value={model}
                onChange={event => setModel(event.target.value)}
                className="mt-2"
              />
            </label>
            <div className="flex gap-2">
              <Button
                disabled={save.isPending || apiKey.trim().length < 20}
                onClick={() =>
                  save.mutate({ apiKey: apiKey.trim(), model: model.trim() })
                }
                className="bg-[#1E3A8A] hover:bg-[#172E6E]"
              >
                {save.isPending && (
                  <Loader2 className="ml-2 size-4 animate-spin" />
                )}
                حفظ المفتاح
              </Button>
              {aiSettings?.configured && (
                <Button
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  حذف الاتصال
                </Button>
              )}
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-[#DEDFDC] bg-white p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[#FFF3CC] text-[#806000]">
              <Users className="size-5" />
            </span>
            <div>
              <h2 className="font-bold">دعوة الفريق</h2>
              <p className="mt-1 text-xs leading-6 text-[#696D75]">
                كل عضو يستطيع إضافة مفتاحه الخاص وتشغيل التحليل على حسابه.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-[#F7F7F5] p-4">
            <p className="text-[10px] text-[#696D75]">رمز الانضمام</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-widest">
              {board.joinCode}
            </p>
          </div>
          {canManage && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                toast.success("تم نسخ رابط الدعوة");
              }}
            >
              <Link2 className="ml-2 size-4" />
              نسخ رابط الدعوة
            </Button>
          )}
        </section>
        <section className="rounded-2xl border border-[#CCD4E6] bg-[#F8FAFD] p-6 lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#14285F] text-[#F6B801]">
                <Bot className="size-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold">ربط المساعد الذكي</h2>
                  <Pill tone="green">MCP جاهز</Pill>
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-6 text-[#696D75]">
                  اربط مختبر الأفكار مع ChatGPT أو Claude أو أي مساعد يدعم
                  Remote MCP. يستطيع المساعد قراءة المشكلات والأفكار والمصادر
                  والمقابلات والتجارب والمهام، والتعديل ضمن صلاحيات حسابك.
                </p>
              </div>
            </div>
            <div className="text-xs text-[#696D75]">
              {mcpConnections.isLoading
                ? "جارٍ التحقق من الاتصالات…"
                : `${mcpConnections.data?.length ?? 0} اتصال نشط`}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Input
              dir="ltr"
              readOnly
              value={mcpEndpoint}
              className="bg-white font-mono text-xs"
            />
            <Button
              variant="outline"
              className="shrink-0 border-[#CCD4E6] text-[#14285F]"
              onClick={async () => {
                await navigator.clipboard.writeText(mcpEndpoint);
                toast.success("تم نسخ رابط MCP");
              }}
            >
              <Link2 className="ml-2 size-4" />
              نسخ الرابط
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[#696D75]">
            تحليل المصادر لا يعمل تلقائيًا؛ يستخدم مفتاح API الخاص بالعضو فقط
            بعد أن يطلب التحليل صراحة، ويحفظ النتيجة كمسودة للمراجعة.
          </p>
        </section>
      </div>
    </>
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
    <label className="block text-xs font-bold text-[#30343A]">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function EntityComposer({
  open,
  initialKind,
  problems,
  pending,
  onClose,
  onSubmit,
}: any) {
  const [kind, setKind] = useState<EntityKind>(initialKind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [problemId, setProblemId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setAudience("");
    setProblemId("");
    setSourceUrl("");
    setSourceTitle("");
    setSourceNotes("");
  };
  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (!value) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] overflow-y-auto bg-[#F5F2EE] sm:max-w-2xl"
      >
        <DialogHeader className="text-right">
          <DialogTitle>
            {kind === "problem" ? "إضافة مشكلة" : "إضافة فكرة"}
          </DialogTitle>
          <DialogDescription>
            ابدئي بما لديك الآن، ويمكن إضافة الأدلة والمقابلات لاحقًا.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#E8E5DF] p-1">
          <button
            onClick={() => setKind("problem")}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-bold",
              kind === "problem" && "bg-white text-[#1E3A8A] shadow-sm"
            )}
          >
            مشكلة
          </button>
          <button
            onClick={() => setKind("idea")}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-bold",
              kind === "idea" && "bg-white text-[#1E3A8A] shadow-sm"
            )}
          >
            فكرة
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label={
                kind === "problem" ? "المشكلة كما فهمتها" : "الفكرة باختصار"
              }
            >
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={
                  kind === "problem"
                    ? "مثال: العثور على مورد موثوق يستغرق وقتًا طويلًا"
                    : "مثال: رادار يجمع تجارب الشركات مع الموردين"
                }
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="وصف إضافي">
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </div>
          <Field label="الفئة أو المجال">
            <Input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="مثال: المشتريات"
            />
          </Field>
          <Field label="من يواجهها؟">
            <Input
              value={audience}
              onChange={e => setAudience(e.target.value)}
              placeholder="مثال: الشركات الصغيرة"
            />
          </Field>
          {kind === "idea" && (
            <div className="sm:col-span-2">
              <Field label="مشكلة مرتبطة (اختياري)">
                <select
                  value={problemId}
                  onChange={e => setProblemId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  <option value="">فكرة مستقلة</option>
                  {problems.map((problem: any) => (
                    <option key={problem.id} value={problem.id}>
                      {problem.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="sm:col-span-2 rounded-2xl border border-[#DEDFDC] bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">رابط داعم</h3>
                <p className="mt-1 text-[11px] text-[#696D75]">
                  TikTok أو YouTube أو مقال أو أي رابط ويب.
                </p>
              </div>
              <Pill tone="gray">اختياري</Pill>
            </div>
            <div className="mt-4 space-y-3">
              <Input
                dir="ltr"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://..."
              />
              <Input
                value={sourceTitle}
                onChange={e => setSourceTitle(e.target.value)}
                placeholder="عنوان المصدر"
              />
              <Textarea
                value={sourceNotes}
                onChange={e => setSourceNotes(e.target.value)}
                placeholder="الصق نص المقطع أو ملاحظاتك إذا كان المحتوى غير متاح للقراءة."
                rows={3}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            disabled={pending || title.trim().length < 3}
            onClick={() =>
              onSubmit({
                kind,
                title: title.trim(),
                description: description.trim() || undefined,
                category: category.trim() || undefined,
                audience: audience.trim() || undefined,
                problemId: problemId ? Number(problemId) : undefined,
                sourceUrl: sourceUrl.trim() || undefined,
                sourceTitle: sourceTitle.trim() || undefined,
                sourceNotes: sourceNotes.trim() || undefined,
              })
            }
            className="bg-[#1E3A8A] hover:bg-[#172E6E]"
          >
            {pending && <Loader2 className="ml-2 size-4 animate-spin" />}حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceDialog({ target, pending, onClose, onSubmit }: any) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={Boolean(target)} onOpenChange={value => !value && onClose()}>
      <DialogContent dir="rtl" className="bg-[#F5F2EE] sm:max-w-xl">
        <DialogHeader className="text-right">
          <DialogTitle>إضافة دليل أو رابط</DialogTitle>
          <DialogDescription>
            سيبقى الرابط الأصلي محفوظًا بجانب أي ملخص لاحق.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="الرابط">
            <Input
              dir="ltr"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/..."
            />
          </Field>
          <Field label="عنوان المصدر">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="وصف يساعد الفريق على تمييز المصدر"
            />
          </Field>
          <Field label="نص المقطع أو ملاحظاتك">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder="مهم خصوصًا إذا كان TikTok أو الموقع يمنع استخراج النص تلقائيًا."
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            disabled={pending || !/^https?:\/\//i.test(url.trim())}
            onClick={() =>
              onSubmit({
                url: url.trim(),
                title: title.trim() || undefined,
                notes: notes.trim() || undefined,
              })
            }
            className="bg-[#1E3A8A] hover:bg-[#172E6E]"
          >
            {pending && <Loader2 className="ml-2 size-4 animate-spin" />}إضافة
            المصدر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InterviewDialog({ open, data, pending, onClose, onSubmit }: any) {
  const [participantLabel, setParticipantLabel] = useState("");
  const [ideaId, setIdeaId] = useState("");
  const [problemId, setProblemId] = useState("");
  const [date, setDate] = useState("");
  const [transcript, setTranscript] = useState("");
  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] overflow-y-auto bg-[#F5F2EE] sm:max-w-xl"
      >
        <DialogHeader className="text-right">
          <DialogTitle>إنشاء مقابلة</DialogTitle>
          <DialogDescription>
            يمكن التخطيط لها الآن أو إضافة النص مباشرة بعد انتهائها.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="المشارك أو صفته">
            <Input
              value={participantLabel}
              onChange={e => setParticipantLabel(e.target.value)}
              placeholder="مثال: مديرة موارد بشرية في شركة متوسطة"
            />
          </Field>
          <Field label="التاريخ">
            <Input
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </Field>
          <Field label="الفكرة المرتبطة">
            <select
              value={ideaId}
              onChange={e => {
                setIdeaId(e.target.value);
                if (e.target.value) setProblemId("");
              }}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">لا توجد</option>
              {data.ideas.map((idea: any) => (
                <option key={idea.id} value={idea.id}>
                  {idea.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المشكلة المرتبطة">
            <select
              value={problemId}
              onChange={e => {
                setProblemId(e.target.value);
                if (e.target.value) setIdeaId("");
              }}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">لا توجد</option>
              {data.problems.map((problem: any) => (
                <option key={problem.id} value={problem.id}>
                  {problem.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="التفريغ أو الملاحظات">
            <Textarea
              rows={7}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="ألصق نص المقابلة هنا، أو اتركه فارغًا إذا كانت المقابلة قادمة."
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            disabled={pending || participantLabel.trim().length < 2}
            onClick={() =>
              onSubmit({
                participantLabel: participantLabel.trim(),
                interviewDate: date ? new Date(date) : undefined,
                ideaId: ideaId ? Number(ideaId) : undefined,
                problemId: problemId ? Number(problemId) : undefined,
                transcript: transcript.trim() || undefined,
              })
            }
            className="bg-[#1E3A8A] hover:bg-[#172E6E]"
          >
            {pending && <Loader2 className="ml-2 size-4 animate-spin" />}حفظ
            المقابلة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExperimentDialog({ open, ideas, pending, onClose, onSubmit }: any) {
  const [ideaId, setIdeaId] = useState("");
  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [metric, setMetric] = useState("");
  const [target, setTarget] = useState("");
  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent dir="rtl" className="bg-[#F5F2EE] sm:max-w-xl">
        <DialogHeader className="text-right">
          <DialogTitle>إنشاء تجربة</DialogTitle>
          <DialogDescription>
            حدد الفرضية ومعيار النجاح قبل بدء التجربة.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="الفكرة">
            <select
              value={ideaId}
              onChange={e => setIdeaId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">اختر فكرة</option>
              {ideas.map((idea: any) => (
                <option key={idea.id} value={idea.id}>
                  {idea.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="اسم التجربة">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: اختبار استعداد العميل للدفع"
            />
          </Field>
          <Field label="الفرضية">
            <Textarea
              value={hypothesis}
              onChange={e => setHypothesis(e.target.value)}
              rows={4}
              placeholder="إذا عرضنا... فسيقوم... لأن..."
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="مقياس النجاح">
              <Input
                value={metric}
                onChange={e => setMetric(e.target.value)}
                placeholder="عدد طلبات التواصل"
              />
            </Field>
            <Field label="القيمة المستهدفة">
              <Input
                type="number"
                min="0"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="20"
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            disabled={
              pending ||
              !ideaId ||
              title.trim().length < 3 ||
              hypothesis.trim().length < 3
            }
            onClick={() =>
              onSubmit({
                ideaId: Number(ideaId),
                title: title.trim(),
                hypothesis: hypothesis.trim(),
                successMetric: metric.trim() || undefined,
                targetValue: target ? Number(target) : undefined,
              })
            }
            className="bg-[#1E3A8A] hover:bg-[#172E6E]"
          >
            {pending && <Loader2 className="ml-2 size-4 animate-spin" />}حفظ
            التجربة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ open, task, data, pending, onClose, onSubmit }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [linkType, setLinkType] = useState("");
  const [linkId, setLinkId] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title || "");
    setDescription(task?.description || "");
    setStatus(task?.status || "todo");
    setPriority(task?.priority || "medium");
    if (task?.dueDate) {
      const value = new Date(task.dueDate);
      const localValue = new Date(
        value.getTime() - value.getTimezoneOffset() * 60_000
      )
        .toISOString()
        .slice(0, 16);
      setDueDate(localValue);
    } else setDueDate("");
    setAssigneeUserId(task?.assigneeUserId ? String(task.assigneeUserId) : "");
    const linked = task?.problemId
      ? ["problem", task.problemId]
      : task?.ideaId
        ? ["idea", task.ideaId]
        : task?.interviewId
          ? ["interview", task.interviewId]
          : task?.experimentId
            ? ["experiment", task.experimentId]
            : ["", ""];
    setLinkType(String(linked[0]));
    setLinkId(linked[1] ? String(linked[1]) : "");
  }, [open, task]);

  const linkOptions =
    linkType === "problem"
      ? data.problems.map((item: any) => ({ id: item.id, label: item.title }))
      : linkType === "idea"
        ? data.ideas.map((item: any) => ({ id: item.id, label: item.title }))
        : linkType === "interview"
          ? data.interviews.map((item: any) => ({
              id: item.id,
              label: item.participantLabel,
            }))
          : linkType === "experiment"
            ? data.experiments.map((item: any) => ({
                id: item.id,
                label: item.title,
              }))
            : [];

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] overflow-y-auto bg-[#F5F2EE] sm:max-w-2xl"
      >
        <DialogHeader className="text-right">
          <DialogTitle>{task ? "تعديل المهمة" : "إضافة مهمة"}</DialogTitle>
          <DialogDescription>
            اربط المهمة بما تخدمه، وحدد من يتولاها ومتى تحتاج إلى إنجاز.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="عنوان المهمة">
              <Input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="مثال: إعداد أسئلة مقابلة العملاء"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="التفاصيل">
              <Textarea
                rows={3}
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="النتيجة المطلوبة أو أي ملاحظات تساعد المنفذ."
              />
            </Field>
          </div>
          <Field label="الحالة">
            <select
              value={status}
              onChange={event => setStatus(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              {Object.entries(taskStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الأولوية">
            <select
              value={priority}
              onChange={event => setPriority(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              {Object.entries(taskPriorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المسند إليه">
            <select
              value={assigneeUserId}
              onChange={event => setAssigneeUserId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">غير مسندة</option>
              {data.members
                .filter((member: any) => member.userId)
                .map((member: any) => (
                  <option key={member.id} value={member.userId}>
                    {member.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="موعد الإنجاز">
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={event => setDueDate(event.target.value)}
            />
          </Field>
          <Field label="نوع الارتباط">
            <select
              value={linkType}
              onChange={event => {
                setLinkType(event.target.value);
                setLinkId("");
              }}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">مهمة عامة</option>
              <option value="problem">مشكلة</option>
              <option value="idea">فكرة</option>
              <option value="interview">مقابلة</option>
              <option value="experiment">تجربة</option>
            </select>
          </Field>
          <Field label="السجل المرتبط">
            <select
              value={linkId}
              disabled={!linkType}
              onChange={event => setLinkId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm disabled:bg-slate-100"
            >
              <option value="">
                {linkType ? "اختر سجلًا" : "اختر نوع الارتباط أولًا"}
              </option>
              {linkOptions.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            disabled={
              pending ||
              title.trim().length < 3 ||
              (Boolean(linkType) && !linkId)
            }
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description.trim() || (task ? null : undefined),
                status,
                priority,
                dueDate: dueDate ? new Date(dueDate) : null,
                assigneeUserId: assigneeUserId ? Number(assigneeUserId) : null,
                problemId:
                  linkType === "problem" && linkId ? Number(linkId) : null,
                ideaId: linkType === "idea" && linkId ? Number(linkId) : null,
                interviewId:
                  linkType === "interview" && linkId ? Number(linkId) : null,
                experimentId:
                  linkType === "experiment" && linkId ? Number(linkId) : null,
              })
            }
            className="bg-[#1E3A8A] hover:bg-[#172E6E]"
          >
            {pending && <Loader2 className="ml-2 size-4 animate-spin" />}
            {task ? "حفظ التعديلات" : "إضافة المهمة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
