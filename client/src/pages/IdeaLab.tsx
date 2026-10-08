import { BrandLogo, BrandMark } from "@/components/Brand";
import { IdeaConsultations } from "@/components/IdeaConsultations";
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
  ArrowRight,
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
  MessageSquare,
  Inbox,
  LayoutGrid,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  initialTaskAssignee,
  matchesIdeaTaskView,
  type IdeaTaskView,
} from "@shared/ideaTaskVisibility";

type LabPage =
  | "portfolio"
  | "inbox"
  | "idea"
  | "my_tasks"
  | "team"
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
type DeletableKind =
  | "problem"
  | "idea"
  | "source"
  | "interview"
  | "experiment"
  | "task"
  | "capture";

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
  const [page, setPage] = useState<LabPage>("portfolio");
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureIdeaId, setCaptureIdeaId] = useState<number | null>(null);
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
  const [taskIdeaId, setTaskIdeaId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: DeletableKind;
    id: number;
    title: string;
    detail?: string;
  } | null>(null);
  const canEdit = board.membershipRole !== "viewer";

  const refresh = () => utils.ideaLab.overview.invalidate();
  const createProblem = trpc.ideaLab.createProblem.useMutation();
  const createIdea = trpc.ideaLab.createIdea.useMutation();
  const createSource = trpc.ideaLab.createSource.useMutation();
  const createInterview = trpc.ideaLab.createInterview.useMutation();
  const createExperiment = trpc.ideaLab.createExperiment.useMutation();
  const createTask = trpc.ideaLab.createTask.useMutation();
  const createCapture = trpc.ideaLab.createCapture.useMutation();
  const updateCapture = trpc.ideaLab.updateCapture.useMutation();
  const deleteProblem = trpc.ideaLab.deleteProblem.useMutation();
  const deleteIdea = trpc.ideaLab.deleteIdea.useMutation();
  const deleteSource = trpc.ideaLab.deleteSource.useMutation();
  const deleteInterview = trpc.ideaLab.deleteInterview.useMutation();
  const deleteExperiment = trpc.ideaLab.deleteExperiment.useMutation();
  const deleteTask = trpc.ideaLab.deleteTask.useMutation();
  const deleteCapture = trpc.ideaLab.deleteCapture.useMutation();
  const updateProblem = trpc.ideaLab.updateProblem.useMutation({
    onSuccess: refresh,
    onError: issue => toast.error(issue.message),
  });
  const updateIdea = trpc.ideaLab.updateIdea.useMutation({
    onSuccess: refresh,
    onError: issue => toast.error(issue.message),
  });
  const updateInterview = trpc.ideaLab.updateInterview.useMutation({
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
  const selectedIdea = data?.ideas.find(idea => idea.id === selectedIdeaId);
  const deleting =
    deleteProblem.isPending ||
    deleteIdea.isPending ||
    deleteSource.isPending ||
    deleteInterview.isPending ||
    deleteExperiment.isPending ||
    deleteTask.isPending ||
    deleteCapture.isPending;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "problem")
        await deleteProblem.mutateAsync({ id: deleteTarget.id });
      if (deleteTarget.kind === "idea")
        await deleteIdea.mutateAsync({ id: deleteTarget.id });
      if (deleteTarget.kind === "source")
        await deleteSource.mutateAsync({ id: deleteTarget.id });
      if (deleteTarget.kind === "interview")
        await deleteInterview.mutateAsync({ id: deleteTarget.id });
      if (deleteTarget.kind === "experiment")
        await deleteExperiment.mutateAsync({ id: deleteTarget.id });
      if (deleteTarget.kind === "task")
        await deleteTask.mutateAsync({ id: deleteTarget.id });
      if (deleteTarget.kind === "capture")
        await deleteCapture.mutateAsync({ id: deleteTarget.id });
      if (deleteTarget.kind === "problem") {
        setSelectedProblemId(null);
        setPage("problems");
      }
      if (deleteTarget.kind === "task" && editingTask?.id === deleteTarget.id) {
        setTaskDialogOpen(false);
        setEditingTask(null);
      }
      await refresh();
      setDeleteTarget(null);
      toast.success("تم الحذف");
    } catch (issue) {
      toast.error(issue instanceof Error ? issue.message : "تعذر الحذف");
    }
  };

  const navItems: Array<{
    id: LabPage;
    label: string;
    icon: typeof Compass;
  }> = [
    { id: "portfolio", label: "محفظة الأفكار", icon: LayoutGrid },
    { id: "inbox", label: "صندوق الالتقاط", icon: Inbox },
    { id: "my_tasks", label: "مهامي", icon: ListTodo },
    { id: "team", label: "الفريق", icon: Users },
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
              page === item.id || (item.id === "portfolio" && page === "idea");
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
              ابحث في الأفكار وما جمعه الفريق...
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                onClick={() => {
                  if (page === "inbox") {
                    setCaptureIdeaId(null);
                    setCaptureOpen(true);
                  } else setComposerKind("idea");
                }}
                className="gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">
                  {page === "inbox" ? "التقاط جديد" : "فكرة جديدة"}
                </span>
              </Button>
            )}
            <BrandMark className="size-9 lg:hidden" />
          </div>
        </header>

        <div className="mx-auto max-w-[1450px] px-4 py-7 lg:px-8 lg:py-9">
          {page === "portfolio" && (
            <IdeaPortfolioPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setComposerKind("idea")}
              onOpen={(id: number) => {
                setSelectedIdeaId(id);
                setPage("idea");
              }}
            />
          )}
          {page === "inbox" && (
            <CaptureInboxPage
              data={data}
              canEdit={canEdit}
              onAdd={() => {
                setCaptureIdeaId(null);
                setCaptureOpen(true);
              }}
              onAttach={async (captureId: number, ideaId: number) => {
                await updateCapture.mutateAsync({ id: captureId, ideaId });
                await refresh();
                toast.success("أُضيف العنصر إلى مساحة الفكرة");
              }}
              onAttachProblem={async (problemId: number, ideaId: number) => {
                await updateIdea.mutateAsync({ id: ideaId, problemId });
                await refresh();
                toast.success("أُضيفت المشكلة إلى مساحة الفكرة");
              }}
              onAttachInterview={async (
                interviewId: number,
                ideaId: number
              ) => {
                await updateInterview.mutateAsync({ id: interviewId, ideaId });
                await refresh();
                toast.success("أُضيفت المقابلة إلى مساحة الفكرة");
              }}
              onDelete={(capture: any) =>
                setDeleteTarget({
                  kind: "capture",
                  id: capture.id,
                  title: capture.title,
                })
              }
            />
          )}
          {page === "idea" && selectedIdea && (
            <IdeaWorkspacePage
              idea={selectedIdea}
              data={data}
              canEdit={canEdit}
              aiConfigured={Boolean(aiSettings?.configured)}
              onBack={() => setPage("portfolio")}
              onStage={(stage: any) =>
                updateIdea.mutate({ id: selectedIdea.id, stage })
              }
              onUpdateDetails={(values: any) =>
                updateIdea.mutate({ id: selectedIdea.id, ...values })
              }
              onDecision={(decision: any, decisionRationale?: string) =>
                updateIdea.mutate({
                  id: selectedIdea.id,
                  decision,
                  decisionRationale,
                  stage:
                    decision === "stop"
                      ? "archived"
                      : decision === "approved"
                        ? "promising"
                        : undefined,
                })
              }
              onAddCapture={() => {
                setCaptureIdeaId(selectedIdea.id);
                setCaptureOpen(true);
              }}
              onAddSource={() =>
                setSourceTarget({ kind: "idea", id: selectedIdea.id })
              }
              onAddInterview={() => setInterviewOpen(true)}
              onAddExperiment={() => setExperimentOpen(true)}
              onAddTask={() => {
                setEditingTask(null);
                setTaskIdeaId(selectedIdea.id);
                setTaskDialogOpen(true);
              }}
              onOpenTask={(task: any) => {
                setEditingTask(task);
                setTaskDialogOpen(true);
              }}
              onAnalyze={(sourceId: number) =>
                analyzeSource.mutate({ sourceId })
              }
              onApprove={(sourceId: number) =>
                approveSource.mutate({ sourceId })
              }
              onOpenSettings={() => setPage("settings")}
            />
          )}
          {page === "idea" && !selectedIdea && (
            <IdeaPortfolioPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setComposerKind("idea")}
              onOpen={(id: number) => {
                setSelectedIdeaId(id);
                setPage("idea");
              }}
            />
          )}
          {page === "my_tasks" && (
            <MyIdeaTasksPage
              data={data}
              userId={user.id}
              canEdit={canEdit}
              onAdd={() => {
                setEditingTask(null);
                setTaskDialogOpen(true);
              }}
              onOpen={(task: any) => {
                setEditingTask(task);
                setTaskDialogOpen(true);
              }}
              onStatus={(id: number, status: any) =>
                updateTask.mutate({ id, status })
              }
            />
          )}
          {page === "team" && <IdeaTeamPage data={data} />}
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
              onDelete={() =>
                setDeleteTarget({
                  kind: "problem",
                  id: selectedProblem.id,
                  title: selectedProblem.title,
                  detail:
                    "ستُحذف الروابط الداعمة المرتبطة بهذه المشكلة، وستبقى الأفكار والمقابلات والمهام من دون هذا الارتباط.",
                })
              }
              onDeleteSource={(source: any) =>
                setDeleteTarget({
                  kind: "source",
                  id: source.id,
                  title: source.title || "المصدر الداعم",
                })
              }
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
              onDeleteIdea={(idea: any) =>
                setDeleteTarget({
                  kind: "idea",
                  id: idea.id,
                  title: idea.title,
                  detail:
                    "ستُحذف مصادر هذه الفكرة وتجاربها، وستبقى المقابلات والمهام من دون هذا الارتباط.",
                })
              }
              onDeleteSource={(source: any) =>
                setDeleteTarget({
                  kind: "source",
                  id: source.id,
                  title: source.title || "المصدر الداعم",
                })
              }
            />
          )}
          {page === "interviews" && (
            <InterviewsPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setInterviewOpen(true)}
              onDelete={(interview: any) =>
                setDeleteTarget({
                  kind: "interview",
                  id: interview.id,
                  title: interview.participantLabel,
                  detail: "ستبقى المهام المرتبطة من دون ارتباط بالمقابلة.",
                })
              }
            />
          )}
          {page === "experiments" && (
            <ExperimentsPage
              data={data}
              canEdit={canEdit}
              onAdd={() => setExperimentOpen(true)}
              onDelete={(experiment: any) =>
                setDeleteTarget({
                  kind: "experiment",
                  id: experiment.id,
                  title: experiment.title,
                  detail: "ستبقى المهام المرتبطة من دون ارتباط بالتجربة.",
                })
              }
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
              onDelete={(task: any) =>
                setDeleteTarget({
                  kind: "task",
                  id: task.id,
                  title: task.title,
                })
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
            if (input.kind === "idea") {
              setSelectedIdeaId(created.id);
              setPage("idea");
            }
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
        initialIdeaId={page === "idea" ? selectedIdeaId : null}
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
        initialIdeaId={page === "idea" ? selectedIdeaId : null}
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
        canEdit={canEdit}
        userId={user.id}
        open={taskDialogOpen}
        task={editingTask}
        initialIdeaId={taskIdeaId}
        data={data}
        pending={createTask.isPending || updateTask.isPending}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
          setTaskIdeaId(null);
        }}
        onDelete={() => {
          if (!editingTask) return;
          setDeleteTarget({
            kind: "task",
            id: editingTask.id,
            title: editingTask.title,
            detail: "حذف المهمة سيحذف خطواتها الفرعية أيضًا.",
          });
        }}
        onSubmit={async (input: any) => {
          try {
            if (editingTask)
              await updateTask.mutateAsync({ id: editingTask.id, ...input });
            else {
              const created = await createTask.mutateAsync(input);
              setEditingTask({ id: created.id, ...input });
              await refresh();
              toast.success("تم حفظ المهمة، يمكنك الآن إضافة خطواتها الفرعية");
              return;
            }
            await refresh();
            setTaskDialogOpen(false);
            setEditingTask(null);
            setTaskIdeaId(null);
            toast.success(editingTask ? "تم تحديث المهمة" : "تمت إضافة المهمة");
          } catch (issue) {
            toast.error(
              issue instanceof Error ? issue.message : "تعذر حفظ المهمة"
            );
          }
        }}
      />

      <CaptureDialog
        open={captureOpen}
        ideaId={captureIdeaId}
        pending={createCapture.isPending}
        onClose={() => {
          setCaptureOpen(false);
          setCaptureIdeaId(null);
        }}
        onSubmit={async (input: any) => {
          try {
            await createCapture.mutateAsync({
              ...input,
              ideaId: captureIdeaId ?? undefined,
            });
            await refresh();
            setCaptureOpen(false);
            setCaptureIdeaId(null);
            toast.success(
              captureIdeaId
                ? "أُضيف العنصر إلى مساحة الفكرة"
                : "حُفظ العنصر في صندوق الالتقاط"
            );
          } catch (issue) {
            toast.error(
              issue instanceof Error ? issue.message : "تعذر حفظ العنصر"
            );
          }
        }}
      />

      <DeleteConfirmationDialog
        target={deleteTarget}
        pending={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
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

const journeyStages = [
  { id: "seed", label: "تحديد المشكلة" },
  { id: "exploration", label: "جمع الأدلة" },
  { id: "interviews", label: "فهم العملاء" },
  { id: "experiment", label: "اختبار الحل" },
  { id: "promising", label: "اتخاذ القرار" },
] as const;

const captureTypeLabels: Record<string, string> = {
  problem: "مشكلة",
  idea: "فكرة أولية",
  link: "رابط",
  note: "ملاحظة",
  feedback: "رأي عميل",
  statistic: "رقم أو إحصائية",
  competitor: "منافس",
};

function IdeaPortfolioPage({ data, canEdit, onAdd, onOpen }: any) {
  const active = data.ideas.filter((idea: any) => idea.stage !== "archived");
  const archived = data.ideas.filter((idea: any) => idea.stage === "archived");

  return (
    <div>
      <PageHeading
        eyebrow="من الاستكشاف إلى القرار"
        title="محفظة الأفكار"
        description="كل فكرة هنا مساحة عمل متكاملة تجمع المشكلة والأدلة والمقابلات والتجارب والمهام والقرار في مكان واحد."
        action={
          canEdit ? (
            <Button onClick={onAdd} className="gap-2 bg-[#1E3A8A]">
              <Plus className="size-4" /> فكرة جديدة
            </Button>
          ) : undefined
        }
      />
      {active.length === 0 ? (
        <EmptyLabState
          icon={Lightbulb}
          title="ابدأ بأول فكرة"
          description="يمكنك البدء من مشكلة واضحة أو من فكرة مباشرة، ثم جمع كل ما يدعمها داخل مساحتها."
          action={
            canEdit ? <Button onClick={onAdd}>إنشاء مساحة فكرة</Button> : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((idea: any) => {
            const stageIndex = Math.max(
              0,
              journeyStages.findIndex(step => step.id === idea.stage)
            );
            const sourceCount = data.sources.filter(
              (item: any) =>
                item.ideaId === idea.id ||
                (idea.problemId && item.problemId === idea.problemId)
            ).length;
            const interviewCount = data.interviews.filter(
              (item: any) =>
                item.ideaId === idea.id ||
                (idea.problemId && item.problemId === idea.problemId)
            ).length;
            const taskCount = data.tasks.filter(
              (item: any) => item.ideaId === idea.id && item.status !== "done"
            ).length;
            return (
              <button
                key={idea.id}
                onClick={() => onOpen(idea.id)}
                className="group rounded-3xl border border-[#D9DDE7] bg-white p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-[#9EABD0] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-[#E9EDF7] text-[#1E3A8A]">
                    <Lightbulb className="size-5" />
                  </span>
                  <Pill tone={idea.confidence === "high" ? "green" : "navy"}>
                    {confidenceLabels[idea.confidence]}
                  </Pill>
                </div>
                <h2 className="mt-5 text-lg font-extrabold leading-7 group-hover:text-[#1E3A8A]">
                  {idea.title}
                </h2>
                <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-[#696D75]">
                  {idea.description || "مساحة جاهزة لصياغة الفكرة وجمع أدلتها."}
                </p>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#E9EDF2]">
                  <div
                    className="h-full rounded-full bg-[#F6B801]"
                    style={{
                      width: `${((stageIndex + 1) / journeyStages.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#696D75]">
                  <span>
                    {journeyStages[stageIndex]?.label || "تحديد المشكلة"}
                  </span>
                  <span>
                    {stageIndex + 1} من {journeyStages.length}
                  </span>
                </div>
                <div className="mt-5 flex gap-4 border-t border-[#ECEDEB] pt-4 text-xs text-[#5E6470]">
                  <span>{sourceCount} أدلة</span>
                  <span>{interviewCount} مقابلات</span>
                  <span>{taskCount} مهام مفتوحة</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {archived.length > 0 && (
        <div className="mt-8 rounded-2xl border border-[#DEDFDC] bg-white/60 p-5">
          <p className="text-sm font-bold">أفكار متوقفة أو مؤرشفة</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {archived.map((idea: any) => (
              <button
                key={idea.id}
                onClick={() => onOpen(idea.id)}
                className="rounded-full border bg-white px-4 py-2 text-xs hover:border-[#1E3A8A]"
              >
                {idea.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CaptureInboxPage({
  data,
  canEdit,
  onAdd,
  onAttach,
  onAttachProblem,
  onAttachInterview,
  onDelete,
}: any) {
  const inbox = data.captures.filter((item: any) => item.status === "inbox");
  const linkedProblemIds = new Set(
    data.ideas.map((idea: any) => idea.problemId).filter(Boolean)
  );
  const orphanProblems = data.problems.filter(
    (problem: any) => !linkedProblemIds.has(problem.id)
  );
  const orphanInterviews = data.interviews.filter(
    (interview: any) => !interview.ideaId && !interview.problemId
  );
  return (
    <div>
      <PageHeading
        eyebrow="التقط الآن ورتّب لاحقًا"
        title="صندوق الالتقاط"
        description="احفظ أي مشكلة أو رابط أو ملاحظة بسرعة، ثم اربطها بالفكرة المناسبة عندما تتضح الصورة."
        action={
          canEdit ? (
            <Button onClick={onAdd} className="gap-2 bg-[#1E3A8A]">
              <Plus className="size-4" /> التقاط جديد
            </Button>
          ) : undefined
        }
      />
      {inbox.length === 0 &&
      orphanProblems.length === 0 &&
      orphanInterviews.length === 0 ? (
        <EmptyLabState
          icon={Inbox}
          title="صندوقك مرتب"
          description="لا توجد عناصر تنتظر التصنيف. يمكنك التقاط أي شيء جديد من هنا."
        />
      ) : (
        <div className="space-y-3">
          {inbox.map((capture: any) => (
            <InboxRow
              key={`capture-${capture.id}`}
              label={captureTypeLabels[capture.captureType] || "ملاحظة"}
              title={capture.title}
              description={capture.content}
              url={capture.url}
              ideas={data.ideas}
              canEdit={canEdit}
              onAttach={(ideaId: number) => onAttach(capture.id, ideaId)}
              onDelete={() => onDelete(capture)}
            />
          ))}
          {orphanProblems.map((problem: any) => (
            <InboxRow
              key={`problem-${problem.id}`}
              label="مشكلة محفوظة سابقًا"
              title={problem.title}
              description={problem.description}
              ideas={data.ideas}
              canEdit={canEdit && Boolean(onAttachProblem)}
              onAttach={(ideaId: number) =>
                onAttachProblem?.(problem.id, ideaId)
              }
            />
          ))}
          {orphanInterviews.map((interview: any) => (
            <InboxRow
              key={`interview-${interview.id}`}
              label="مقابلة محفوظة سابقًا"
              title={interview.participantLabel}
              description={interview.summary || interview.transcript}
              ideas={data.ideas}
              canEdit={canEdit && Boolean(onAttachInterview)}
              onAttach={(ideaId: number) =>
                onAttachInterview?.(interview.id, ideaId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InboxRow({
  label,
  title,
  description,
  url,
  ideas,
  canEdit,
  onAttach,
  onDelete,
}: any) {
  const [ideaId, setIdeaId] = useState("");
  return (
    <div className="rounded-2xl border border-[#DEDFDC] bg-white p-4 md:flex md:items-center md:gap-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3CC] text-[#806000]">
        <Inbox className="size-4" />
      </span>
      <div className="mt-3 min-w-0 flex-1 md:mt-0">
        <p className="text-[11px] font-bold text-[#7A2E5C]">{label}</p>
        <p className="mt-1 font-bold">{title}</p>
        {description && (
          <p className="mt-1 line-clamp-2 text-xs leading-6 text-[#696D75]">
            {description}
          </p>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-[#1E3A8A]"
          >
            فتح الرابط <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {canEdit && (
        <div className="mt-4 flex items-center gap-2 md:mt-0">
          <select
            value={ideaId}
            onChange={e => setIdeaId(e.target.value)}
            className="h-9 max-w-48 rounded-lg border bg-white px-2 text-xs"
          >
            <option value="">اختر فكرة...</option>
            {ideas.map((idea: any) => (
              <option key={idea.id} value={idea.id}>
                {idea.title}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!ideaId}
            onClick={() => onAttach(Number(ideaId))}
          >
            ربط
          </Button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IdeaWorkspacePage({
  idea,
  data,
  canEdit,
  aiConfigured,
  onBack,
  onStage,
  onUpdateDetails,
  onDecision,
  onAddCapture,
  onAddSource,
  onAddInterview,
  onAddExperiment,
  onAddTask,
  onOpenTask,
  onAnalyze,
  onApprove,
  onOpenSettings,
}: any) {
  const [workspaceTab, setWorkspaceTab] = useState("overview");
  const problem = data.problems.find((item: any) => item.id === idea.problemId);
  const belongs = (item: any) =>
    item.ideaId === idea.id ||
    (idea.problemId && item.problemId === idea.problemId);
  const captures = data.captures.filter(
    (item: any) => item.ideaId === idea.id && item.status !== "archived"
  );
  const sources = data.sources.filter(belongs);
  const interviews = data.interviews.filter(belongs);
  const experiments = data.experiments.filter(
    (item: any) => item.ideaId === idea.id
  );
  const relatedInterviewIds = new Set(interviews.map((item: any) => item.id));
  const relatedExperimentIds = new Set(experiments.map((item: any) => item.id));
  const tasks = data.tasks.filter(
    (item: any) =>
      item.ideaId === idea.id ||
      (idea.problemId && item.problemId === idea.problemId) ||
      relatedInterviewIds.has(item.interviewId) ||
      relatedExperimentIds.has(item.experimentId)
  );
  const stageIndex =
    idea.stage === "archived"
      ? -1
      : journeyStages.findIndex(step => step.id === idea.stage);
  const [decisionNote, setDecisionNote] = useState(
    idea.decisionRationale || ""
  );

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#1E3A8A]"
      >
        <ArrowRight className="size-4" /> محفظة الأفكار
      </button>
      <div className="rounded-3xl bg-[#14285F] p-6 text-white md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="yellow">{stageLabels[idea.stage]}</Pill>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px]">
                {confidenceLabels[idea.confidence]}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
              {idea.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/70">
              {idea.description ||
                "ابدأ بصياغة الفكرة ثم اجمع ما يدعمها خطوة بخطوة."}
            </p>
          </div>
          {canEdit && (
            <Button
              onClick={onAddCapture}
              className="gap-2 bg-[#F6B801] text-[#14285F] hover:bg-[#FFD044]"
            >
              <Plus className="size-4" /> أضف لهذه الفكرة
            </Button>
          )}
        </div>
        <div className="mt-7 grid gap-2 sm:grid-cols-5">
          {journeyStages.map((step, index) => (
            <button
              key={step.id}
              disabled={!canEdit}
              onClick={() => onStage(step.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-right text-xs transition",
                index <= stageIndex
                  ? "border-[#F6B801]/50 bg-[#F6B801]/15 text-white"
                  : "border-white/10 bg-white/5 text-white/45",
                canEdit && "hover:border-white/40"
              )}
            >
              <span className="mb-1 block text-[10px]">{index + 1}</span>
              {step.label}
            </button>
          ))}
        </div>
      </div>

      <nav
        className="mt-5 flex gap-6 border-b border-[#DEDFDC]"
        aria-label="أقسام الفكرة"
      >
        <button
          aria-pressed={workspaceTab === "overview"}
          onClick={() => setWorkspaceTab("overview")}
          className={cn(
            "border-b-2 py-3 text-sm",
            workspaceTab === "overview"
              ? "border-[#1E3A8A] font-bold text-[#1E3A8A]"
              : "border-transparent text-[#696D75]"
          )}
        >
          مساحة الفكرة
        </button>
        <button
          aria-pressed={workspaceTab === "consultations"}
          onClick={() => setWorkspaceTab("consultations")}
          className={cn(
            "flex items-center gap-2 border-b-2 py-3 text-sm",
            workspaceTab === "consultations"
              ? "border-[#1E3A8A] font-bold text-[#1E3A8A]"
              : "border-transparent text-[#696D75]"
          )}
        >
          <MessageSquare className="size-4" />
          الاستشارات
        </button>
      </nav>
      <div hidden={workspaceTab !== "consultations"}>
        <IdeaConsultations
          key={idea.id}
          ideaId={idea.id}
          consultations={data.consultations || []}
          canEdit={canEdit}
          aiConfigured={aiConfigured}
          onOpenSettings={onOpenSettings}
          onOpenTask={onOpenTask}
        />
      </div>
      <div hidden={workspaceTab !== "overview"}>
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          {[
            [sources.length + captures.length, "دليل ومعلومة", Link2],
            [interviews.length, "مقابلات", MessageSquare],
            [experiments.length, "تجارب", FlaskConical],
            [
              tasks.filter((item: any) => item.status !== "done").length,
              "مهام مفتوحة",
              ListTodo,
            ],
          ].map(([value, label, Icon]: any) => (
            <div
              key={label}
              className="rounded-2xl border border-[#DEDFDC] bg-white p-4"
            >
              <Icon className="size-4 text-[#7A2E5C]" />
              <p className="mt-3 text-2xl font-extrabold">{value}</p>
              <p className="text-xs text-[#696D75]">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-5">
            <WorkspaceSection
              icon={Target}
              title="1. المشكلة التي نعمل عليها"
              action={null}
            >
              {problem ? (
                <div>
                  <h3 className="font-bold">{problem.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#62635F]">
                    {problem.description || "لم يُضف وصف بعد."}
                  </p>
                  {problem.audience && (
                    <div className="mt-3">
                      <Pill tone="navy">الفئة: {problem.audience}</Pill>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm leading-7 text-[#696D75]">
                  بدأت هذه المساحة من فكرة مباشرة. أضف ملاحظة تصف المشكلة أو
                  اربطها بمشكلة محفوظة من صندوق الالتقاط.
                </p>
              )}
            </WorkspaceSection>

            <WorkspaceSection
              icon={Link2}
              title="2. الأدلة وما جمعناه"
              action={
                canEdit ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={onAddCapture}>
                      ملاحظة
                    </Button>
                    <Button size="sm" onClick={onAddSource}>
                      رابط
                    </Button>
                  </div>
                ) : null
              }
            >
              {captures.length + sources.length === 0 ? (
                <WorkspaceEmpty text="أضف رابطًا أو ملاحظة أو رأي عميل يدعم الفكرة أو يعارضها." />
              ) : (
                <div className="space-y-3">
                  {captures.map((item: any) => (
                    <div
                      key={`c-${item.id}`}
                      className="rounded-xl bg-[#F7F7F5] p-3"
                    >
                      <Pill tone="gray">
                        {captureTypeLabels[item.captureType]}
                      </Pill>
                      <p className="mt-2 text-sm font-bold">{item.title}</p>
                      {item.content && (
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-[#696D75]">
                          {item.content}
                        </p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-[#1E3A8A]"
                        >
                          فتح الرابط <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  ))}
                  {sources.map((source: any) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      aiConfigured={aiConfigured}
                      canEdit={canEdit}
                      pending={false}
                      onAnalyze={() => onAnalyze(source.id)}
                      onApprove={() => onApprove(source.id)}
                      onOpenSettings={onOpenSettings}
                    />
                  ))}
                </div>
              )}
            </WorkspaceSection>

            <WorkspaceSection
              icon={MessageSquare}
              title="3. فهم العملاء"
              action={
                canEdit ? (
                  <Button size="sm" onClick={onAddInterview}>
                    إضافة مقابلة
                  </Button>
                ) : null
              }
            >
              {interviews.length === 0 ? (
                <WorkspaceEmpty text="خطط مقابلاتك أو أضف التفريغ والنتائج هنا؛ ستظل كلها مرتبطة بهذه الفكرة." />
              ) : (
                <div className="space-y-3">
                  {interviews.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#E3E4E1] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold">
                          {item.participantLabel}
                        </p>
                        <Pill tone="gray">
                          {interviewStatusLabels[item.status]}
                        </Pill>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-[#696D75]">
                        {item.summary ||
                          item.insights ||
                          item.transcript ||
                          "مقابلة مخططة — لم تُضف النتائج بعد."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </WorkspaceSection>

            <WorkspaceSection
              icon={FlaskConical}
              title="4. الاختبارات والتجارب"
              action={
                canEdit ? (
                  <Button size="sm" onClick={onAddExperiment}>
                    تجربة جديدة
                  </Button>
                ) : null
              }
            >
              {experiments.length === 0 ? (
                <WorkspaceEmpty text="حوّل أهم افتراض إلى تجربة لها فرضية ومقياس نجاح واضح." />
              ) : (
                <div className="space-y-3">
                  {experiments.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#E3E4E1] p-3"
                    >
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-bold">{item.title}</p>
                        <Pill
                          tone={item.status === "complete" ? "green" : "yellow"}
                        >
                          {experimentStatusLabels[item.status]}
                        </Pill>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-[#696D75]">
                        {item.hypothesis}
                      </p>
                      {item.result && (
                        <p className="mt-2 rounded-lg bg-[#E9EDE4] p-2 text-xs text-[#45613F]">
                          النتيجة: {item.result}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </WorkspaceSection>
          </div>

          <div className="space-y-5">
            <WorkspaceSection icon={Sparkles} title="صياغة الحل" action={null}>
              <IdeaStrategyForm
                idea={idea}
                canEdit={canEdit}
                onSave={onUpdateDetails}
              />
            </WorkspaceSection>
            <WorkspaceSection
              icon={ListTodo}
              title="مهام الفكرة"
              action={
                canEdit ? (
                  <Button size="sm" onClick={onAddTask}>
                    مهمة جديدة
                  </Button>
                ) : null
              }
            >
              {tasks.length === 0 ? (
                <WorkspaceEmpty text="لا توجد مهام لهذه الفكرة بعد." />
              ) : (
                <div className="space-y-2">
                  {tasks.map((task: any) => (
                    <button
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#E3E4E1] p-3 text-right"
                    >
                      <div>
                        <p
                          className={cn(
                            "text-sm font-bold",
                            task.status === "done" &&
                              "line-through text-slate-400"
                          )}
                        >
                          {task.title}
                        </p>
                        <p className="mt-1 text-[11px] text-[#696D75]">
                          {dateLabel(task.dueDate)}
                        </p>
                        <SubtaskProgress
                          taskId={task.id}
                          subtasks={data.subtasks}
                        />
                      </div>
                      <Pill
                        tone={
                          task.status === "done"
                            ? "green"
                            : task.priority === "urgent"
                              ? "burgundy"
                              : "gray"
                        }
                      >
                        {taskStatusLabels[task.status]}
                      </Pill>
                    </button>
                  ))}
                </div>
              )}
            </WorkspaceSection>
            <WorkspaceSection icon={Check} title="5. قرار الفريق" action={null}>
              <p className="text-sm leading-7 text-[#696D75]">
                سجّل سبب القرار كي يفهم الفريق لاحقًا لماذا استمررتم أو غيّرتم
                الاتجاه.
              </p>
              <Textarea
                className="mt-3"
                rows={4}
                value={decisionNote}
                onChange={e => setDecisionNote(e.target.value)}
                placeholder="ما الذي تعلمناه؟ وما القرار؟"
                disabled={!canEdit}
              />
              {canEdit && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onDecision("test_more", decisionNote)}
                  >
                    نحتاج اختبارًا آخر
                  </Button>
                  <Button
                    onClick={() => onDecision("approved", decisionNote)}
                    className="bg-[#45613F] hover:bg-[#354C30]"
                  >
                    اعتماد الفكرة
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onDecision("pivot", decisionNote)}
                  >
                    تغيير الاتجاه
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onDecision("stop", decisionNote)}
                    className="text-red-700"
                  >
                    إيقاف الفكرة
                  </Button>
                </div>
              )}
            </WorkspaceSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSection({ icon: Icon, title, action, children }: any) {
  return (
    <section className="rounded-2xl border border-[#DEDFDC] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#E9EDF7] text-[#1E3A8A]">
            <Icon className="size-4" />
          </span>
          <h2 className="font-extrabold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function WorkspaceEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D7D9D5] bg-[#FAFAF8] p-4 text-center text-xs leading-6 text-[#696D75]">
      {text}
    </div>
  );
}

function IdeaStrategyForm({ idea, canEdit, onSave }: any) {
  const [valueProposition, setValueProposition] = useState(
    idea.valueProposition || ""
  );
  const [proposedSolution, setProposedSolution] = useState(
    idea.proposedSolution || ""
  );
  const [differentiator, setDifferentiator] = useState(
    idea.differentiator || ""
  );
  const [mvpScope, setMvpScope] = useState(idea.mvpScope || "");
  if (
    !canEdit &&
    !valueProposition &&
    !proposedSolution &&
    !differentiator &&
    !mvpScope
  )
    return <WorkspaceEmpty text="لم تُصغ تفاصيل الحل بعد." />;
  return (
    <div className="space-y-3">
      <Field label="القيمة التي نقدمها">
        <Textarea
          rows={2}
          value={valueProposition}
          onChange={e => setValueProposition(e.target.value)}
          disabled={!canEdit}
          placeholder="ما القيمة التي سيحصل عليها العميل؟"
        />
      </Field>
      <Field label="الحل المقترح">
        <Textarea
          rows={2}
          value={proposedSolution}
          onChange={e => setProposedSolution(e.target.value)}
          disabled={!canEdit}
          placeholder="كيف سنحل المشكلة؟"
        />
      </Field>
      <Field label="ما الذي يميزنا؟">
        <Textarea
          rows={2}
          value={differentiator}
          onChange={e => setDifferentiator(e.target.value)}
          disabled={!canEdit}
        />
      </Field>
      <Field label="أصغر نسخة قابلة للاختبار">
        <Textarea
          rows={2}
          value={mvpScope}
          onChange={e => setMvpScope(e.target.value)}
          disabled={!canEdit}
        />
      </Field>
      {canEdit && (
        <Button
          className="w-full bg-[#1E3A8A]"
          onClick={() =>
            onSave({
              valueProposition,
              proposedSolution,
              differentiator,
              mvpScope,
            })
          }
        >
          حفظ صياغة الحل
        </Button>
      )}
    </div>
  );
}

function MyIdeaTasksPage({
  data,
  userId,
  canEdit,
  onAdd,
  onOpen,
  onStatus,
}: any) {
  const [view, setView] = useState<IdeaTaskView>("mine");
  const mine = data.tasks.filter((task: any) =>
    matchesIdeaTaskView(task, data.subtasks ?? [], userId, view)
  );
  return (
    <div>
      <PageHeading
        eyebrow="ما يحتاج انتباهك"
        title="مهامي"
        description="مهامك من كل الأفكار، مع بقاء كل مهمة داخل سياق الفكرة التي تنتمي إليها."
        action={
          canEdit ? (
            <Button onClick={onAdd} className="gap-2 bg-[#1E3A8A]">
              <Plus className="size-4" /> مهمة جديدة
            </Button>
          ) : undefined
        }
      />
      <div
        className="mb-5 flex flex-wrap gap-2"
        role="group"
        aria-label="عرض المهام"
      >
        {(
          [
            ["mine", "المسندة لي"],
            ["unassigned", "غير المسندة"],
            ["all", "كل مهام الفريق"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={view === value ? "default" : "outline"}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {mine.length === 0 ? (
        <EmptyLabState
          icon={ListTodo}
          title={
            view === "mine"
              ? "لا توجد مهام مسندة لك"
              : "لا توجد مهام في هذا العرض"
          }
          description="يمكنك تغيير العرض للوصول إلى مهام الفريق والمهام غير المسندة."
        />
      ) : (
        <div className="space-y-3">
          {mine.map((task: any) => {
            const idea = data.ideas.find(
              (item: any) => item.id === task.ideaId
            );
            return (
              <div
                key={task.id}
                className="rounded-2xl border border-[#DEDFDC] bg-white p-4 md:flex md:items-center md:justify-between"
              >
                <button onClick={() => onOpen(task)} className="text-right">
                  <p className="font-bold">{task.title}</p>
                  {view === "mine" && task.assigneeUserId !== userId && (
                    <p className="mt-1 text-xs text-blue-700">
                      لديك خطوات مسندة لك داخل هذه المهمة
                    </p>
                  )}
                  <SubtaskProgress taskId={task.id} subtasks={data.subtasks} />
                  <p className="mt-1 text-xs text-[#696D75]">
                    {idea?.title || "مهمة عامة"} · {dateLabel(task.dueDate)}
                  </p>
                </button>
                {canEdit && (
                  <select
                    value={task.status}
                    onChange={e => onStatus(task.id, e.target.value)}
                    className="mt-3 h-9 rounded-lg border bg-white px-2 text-xs md:mt-0"
                  >
                    {Object.entries(taskStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IdeaTeamPage({ data }: any) {
  return (
    <div>
      <PageHeading
        eyebrow="العمل معًا"
        title="الفريق"
        description="أعضاء مساحة مختبر الأفكار. يظهر مالك كل فكرة والمسؤول عن كل مهمة داخل سياقها."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.members.map((member: any) => (
          <div
            key={member.id}
            className="rounded-2xl border border-[#DEDFDC] bg-white p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#E9EDF7] font-extrabold text-[#1E3A8A]">
                {member.avatarInitials || initials(member.name)}
              </span>
              <div>
                <p className="font-bold">{member.name}</p>
                <p className="text-xs text-[#696D75]">{member.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
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
  onDelete,
  onDeleteSource,
}: any) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-xs font-bold text-[#1E3A8A]">
          بنك المشكلات ←
        </button>
        {canEdit && onDelete && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onDelete}
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <Trash2 className="ml-2 size-4" />
              حذف المشكلة
            </Button>
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
                onDelete={() => onDeleteSource(source)}
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
  onDelete,
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
        {canEdit && onDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
            aria-label="حذف المصدر"
          >
            <Trash2 className="size-3" />
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
  onDelete,
  onDeleteSource,
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
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#696D75]">
            {sources.length} مصادر
          </span>
          {canEdit && (
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
              aria-label={`حذف ${idea.title}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <h3 className="mt-3 font-bold leading-7">{idea.title}</h3>
      <p className="mt-2 line-clamp-3 text-xs leading-6 text-[#696D75]">
        {idea.description || "لا يوجد وصف إضافي."}
      </p>
      {sources.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {sources.map((source: any) => (
            <div
              key={source.id}
              className="flex items-center gap-2 rounded-lg bg-[#F4F5F8] px-2.5 py-2"
            >
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#1E3A8A]"
              >
                {source.title || "مصدر داعم"}
              </a>
              {canEdit && (
                <button
                  onClick={() => onDeleteSource(source)}
                  className="text-red-600 hover:text-red-800"
                  aria-label="حذف المصدر"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
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

function IdeasPage({
  data,
  canEdit,
  onAdd,
  onStage,
  onAddSource,
  onDeleteIdea,
  onDeleteSource,
}: any) {
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
                      onDelete={() => onDeleteIdea(idea)}
                      onDeleteSource={onDeleteSource}
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

function InterviewsPage({ data, canEdit, onAdd, onDelete }: any) {
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
              <div className="flex items-center justify-end gap-3">
                <span className="text-xs text-[#696D75]">
                  {interview.ideaId
                    ? "مرتبطة بفكرة"
                    : interview.problemId
                      ? "مرتبطة بمشكلة"
                      : "مقابلة عامة"}
                </span>
                {canEdit && (
                  <button
                    onClick={() => onDelete(interview)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    aria-label={`حذف مقابلة ${interview.participantLabel}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
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

function ExperimentsPage({ data, canEdit, onAdd, onDelete }: any) {
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
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#E9EDF7] text-[#1E3A8A]">
                    <FlaskConical className="size-5" />
                  </span>
                  <div className="flex items-center gap-2">
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
                    {canEdit && (
                      <button
                        onClick={() => onDelete(experiment)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        aria-label={`حذف ${experiment.title}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
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

function TasksPage({ data, canEdit, onAdd, onOpen, onStatus, onDelete }: any) {
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
                            <div className="flex items-center gap-1">
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
                              <button
                                onClick={event => {
                                  event.stopPropagation();
                                  onDelete(task);
                                }}
                                className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                                aria-label={`حذف ${task.title}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
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

function CaptureDialog({ open, ideaId, pending, onClose, onSubmit }: any) {
  const [captureType, setCaptureType] = useState("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!open) return;
    setCaptureType("note");
    setTitle("");
    setContent("");
    setUrl("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent dir="rtl" className="bg-[#F5F2EE] sm:max-w-xl">
        <DialogHeader className="text-right">
          <DialogTitle>
            {ideaId ? "أضف لهذه الفكرة" : "التقاط جديد"}
          </DialogTitle>
          <DialogDescription>
            {ideaId
              ? "احفظ معلومة أو ملاحظة داخل مساحة الفكرة."
              : "احفظها الآن في الصندوق، ثم اربطها بفكرة عندما تكون جاهزًا."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="نوع العنصر">
            <select
              value={captureType}
              onChange={e => setCaptureType(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              {Object.entries(captureTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="العنوان">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="وصف مختصر وواضح"
            />
          </Field>
          <Field label="التفاصيل">
            <Textarea
              rows={5}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="ماذا لاحظت؟ ولماذا قد يكون مهمًا؟"
            />
          </Field>
          <Field label="رابط داعم — اختياري">
            <Input
              dir="ltr"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            disabled={
              pending ||
              title.trim().length < 2 ||
              Boolean(url && !/^https?:\/\//i.test(url.trim()))
            }
            onClick={() =>
              onSubmit({
                captureType,
                title: title.trim(),
                content: content.trim() || undefined,
                url: url.trim() || undefined,
              })
            }
            className="bg-[#1E3A8A]"
          >
            {pending && <Loader2 className="ml-2 size-4 animate-spin" />}حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InterviewDialog({
  open,
  data,
  initialIdeaId,
  pending,
  onClose,
  onSubmit,
}: any) {
  const [participantLabel, setParticipantLabel] = useState("");
  const [ideaId, setIdeaId] = useState("");
  const [problemId, setProblemId] = useState("");
  const [date, setDate] = useState("");
  const [transcript, setTranscript] = useState("");
  useEffect(() => {
    if (open && initialIdeaId) {
      setIdeaId(String(initialIdeaId));
      setProblemId("");
    }
  }, [open, initialIdeaId]);
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

function ExperimentDialog({
  open,
  ideas,
  initialIdeaId,
  pending,
  onClose,
  onSubmit,
}: any) {
  const [ideaId, setIdeaId] = useState("");
  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [metric, setMetric] = useState("");
  const [target, setTarget] = useState("");
  useEffect(() => {
    if (open && initialIdeaId) setIdeaId(String(initialIdeaId));
  }, [open, initialIdeaId]);
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

function TaskDialog({
  canEdit,
  userId,
  open,
  task,
  initialIdeaId,
  data,
  pending,
  onClose,
  onSubmit,
  onDelete,
}: any) {
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
    const assignee = initialTaskAssignee(task, userId);
    setAssigneeUserId(assignee ? String(assignee) : "");
    const linked = task?.problemId
      ? ["problem", task.problemId]
      : task?.ideaId
        ? ["idea", task.ideaId]
        : task?.interviewId
          ? ["interview", task.interviewId]
          : task?.experimentId
            ? ["experiment", task.experimentId]
            : initialIdeaId
              ? ["idea", initialIdeaId]
              : ["", ""];
    setLinkType(String(linked[0]));
    setLinkId(linked[1] ? String(linked[1]) : "");
  }, [open, task, initialIdeaId, userId]);

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
          <DialogTitle>{task ? "تفاصيل المهمة" : "إضافة مهمة"}</DialogTitle>
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
            <Field label="تفاصيل المهمة والنتيجة المطلوبة">
              <Textarea
                rows={5}
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
        <TaskSubtasks task={task} data={data} canEdit={canEdit} />
        <DialogFooter>
          {task && canEdit && (
            <Button
              variant="outline"
              onClick={onDelete}
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 sm:ml-auto"
            >
              <Trash2 className="ml-2 size-4" />
              حذف المهمة
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            disabled={
              pending ||
              !canEdit ||
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

function SubtaskProgress({ taskId, subtasks = [] }: any) {
  const items = subtasks.filter((item: any) => item.taskId === taskId);
  if (!items.length) return null;
  return (
    <p className="mt-1 text-xs text-slate-500">
      {items.filter((item: any) => item.status === "done").length} /{" "}
      {items.length} خطوات مكتملة
    </p>
  );
}

function TaskSubtasks({ task, data, canEdit }: any) {
  const utils = trpc.useUtils();
  const create = trpc.ideaLab.createSubtask.useMutation();
  const update = trpc.ideaLab.updateSubtask.useMutation();
  const remove = trpc.ideaLab.deleteSubtask.useMutation();
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("todo");
  const items = (data.subtasks || []).filter(
    (item: any) => item.taskId === task?.id
  );
  const completed = items.filter((item: any) => item.status === "done").length;
  const pending =
    !canEdit || create.isPending || update.isPending || remove.isPending;
  useEffect(() => {
    setEditing(null);
  }, [task?.id]);
  const start = (item: any = {}) => {
    setEditing(item);
    setTitle(item.title || "");
    setDescription(item.description || "");
    setAssignee(item.assigneeUserId ? String(item.assigneeUserId) : "");
    setStatus(item.status || "todo");
    const date = item.dueDate ? new Date(item.dueDate) : null;
    setDueDate(
      date
        ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : ""
    );
  };
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await utils.ideaLab.overview.invalidate();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذر حفظ المهمة الفرعية"
      );
      return false;
    }
  };
  return (
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">
          المهام الفرعية{" "}
          <span className="text-sm font-normal text-slate-500">
            {completed} / {items.length} مكتملة
          </span>
        </h3>
        <Button
          size="sm"
          variant="outline"
          disabled={!task?.id || pending}
          onClick={() => start()}
        >
          إضافة خطوة
        </Button>
      </div>
      {items.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${(completed / items.length) * 100}%` }}
          />
        </div>
      )}
      {!task?.id && (
        <p className="text-sm text-slate-500">
          احفظ المهمة أولًا، ثم أضف خطواتها الفرعية هنا.
        </p>
      )}
      {task?.id && !items.length && !editing && (
        <p className="text-sm text-slate-500">
          قسّم المهمة إلى خطوات صغيرة وواضحة.
        </p>
      )}
      {items.map((item: any) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-lg border p-3"
        >
          <input
            type="checkbox"
            aria-label={`إنجاز ${item.title}`}
            checked={item.status === "done"}
            disabled={pending}
            className="mt-1 size-4"
            onChange={event => {
              void run(() =>
                update.mutateAsync({
                  id: item.id,
                  status: event.target.checked ? "done" : "todo",
                })
              );
            }}
          />
          <button
            type="button"
            onClick={() => start(item)}
            className="flex-1 text-right"
          >
            <p
              className={`font-medium ${item.status === "done" ? "text-slate-400 line-through" : ""}`}
            >
              {item.title}
            </p>
            {item.description && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">
                {item.description}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {taskStatusLabels[item.status as keyof typeof taskStatusLabels]} ·{" "}
              {data.members.find(
                (member: any) => member.userId === item.assigneeUserId
              )?.name || "غير مسندة"}
              {item.dueDate
                ? ` · ${new Date(item.dueDate).toLocaleDateString("ar-SA")}`
                : ""}
            </p>
          </button>
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            aria-label={`حذف ${item.title}`}
            onClick={() => setDeleting(item)}
          >
            <Trash2 className="size-4 text-red-600" />
          </Button>
        </div>
      ))}
      {editing && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <Field label="عنوان الخطوة">
            <Input
              maxLength={280}
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </Field>
          <Field label="تفاصيل الخطوة">
            <Textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="المسؤول">
              <select
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                value={assignee}
                onChange={event => setAssignee(event.target.value)}
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
            <Field label="الحالة">
              <select
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                {Object.entries(taskStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !title.trim()}
              onClick={async () => {
                const values = {
                  title: title.trim(),
                  description: description.trim() || null,
                  status: status as "todo" | "in_progress" | "blocked" | "done",
                  assigneeUserId: assignee ? Number(assignee) : null,
                  dueDate: dueDate ? new Date(dueDate) : null,
                };
                if (
                  await run(() =>
                    editing.id
                      ? update.mutateAsync({ id: editing.id, ...values })
                      : create.mutateAsync({ taskId: task.id, ...values })
                  )
                )
                  setEditing(null);
              }}
            >
              حفظ الخطوة
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
      <DeleteConfirmationDialog
        target={deleting}
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await run(() => remove.mutateAsync({ id: deleting.id }))) {
            setDeleting(null);
            setEditing(null);
          }
        }}
      />
    </section>
  );
}

function DeleteConfirmationDialog({
  target,
  pending,
  onClose,
  onConfirm,
}: any) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={value => !value && onClose()}>
      <DialogContent dir="rtl" className="bg-[#F5F2EE] sm:max-w-md">
        <DialogHeader className="text-right">
          <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-red-100 text-red-700">
            <Trash2 className="size-5" />
          </span>
          <DialogTitle>تأكيد الحذف</DialogTitle>
          <DialogDescription className="leading-7">
            هل تريد حذف «{target?.title}»؟ لا يمكن التراجع عن هذه الخطوة.
          </DialogDescription>
        </DialogHeader>
        {target?.detail && (
          <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-6 text-red-800">
            {target.detail}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="ml-2 size-4 animate-spin" />}
            حذف نهائي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
