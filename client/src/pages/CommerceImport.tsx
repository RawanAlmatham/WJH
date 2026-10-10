import { BrandLogo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  commerceStatusLabels,
  matchesCommerceTask,
  type CommerceChecklist,
} from "@shared/commerce";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Folder,
  ListTodo,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  Route,
  Users,
  X,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type Overview = inferRouterOutputs<AppRouter>["commerce"]["overview"];
type Task = Overview["tasks"][number];
type Props = {
  user: { id: number; name?: string | null };
  board: {
    id: number;
    name: string;
    joinCode: string;
    inviteToken: string;
    membershipRole: string;
  };
  boards: Array<{ id: number; name: string }>;
  switchingBoard: boolean;
  onSelectBoard: (id: number) => void;
};
const selectClass =
  "rounded-lg border border-[#DEDFDC] bg-white px-3 py-2 text-sm text-[#1F2328]";
const navItems = [
  { id: "journey", label: "رحلة المشروع", icon: Route },
  { id: "tasks", label: "كل المهام", icon: ListTodo },
  { id: "files", label: "الملفات والروابط", icon: Folder },
  { id: "team", label: "الفريق", icon: Users },
  { id: "archives", label: "الأقسام المؤرشفة", icon: Archive },
];
function taskFields(task: Task) {
  return {
    id: task.id,
    version: task.version,
    title: task.title,
    sectionId: task.sectionId,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    assigneeUserId: task.assigneeUserId,
    dueDate: task.dueDate,
    waitingReason: task.waitingReason ?? "",
    checklist: task.checklist ?? [],
  };
}

export default function CommerceImport({
  user,
  board,
  boards,
  switchingBoard,
  onSelectBoard,
}: Props) {
  const utils = trpc.useUtils();
  const query = trpc.commerce.overview.useQuery();
  const [page, setPage] = useState("journey");
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [view, setView] = useState("open");
  const [mobile, setMobile] = useState(false);
  const [manage, setManage] = useState(false);
  const [sectionEditor, setSectionEditor] = useState<{
    id?: number;
    name: string;
  } | null>(null);
  const [taskEditor, setTaskEditor] = useState<Task | "new" | null>(null);
  const [resourceEditor, setResourceEditor] = useState(false);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceNotes, setResourceNotes] = useState("");
  const [showArchivedFiles, setShowArchivedFiles] = useState(false);
  const canEdit = board.membershipRole !== "viewer";
  const canManage = board.membershipRole === "manager";
  const refresh = async () => {
    await utils.commerce.overview.invalidate();
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const saveSection = trpc.commerce.saveSection.useMutation({
    onSuccess: async result => {
      setSectionId(result.id);
      setPage("journey");
      setSectionEditor(null);
      await refresh();
    },
    onError,
  });
  const archiveSection = trpc.commerce.archiveSection.useMutation({
    onSuccess: refresh,
    onError,
  });
  const moveSection = trpc.commerce.moveSection.useMutation({
    onSuccess: refresh,
    onError,
  });
  const archiveTask = trpc.commerce.archiveTask.useMutation({
    onSuccess: refresh,
    onError,
  });
  const quickSave = trpc.commerce.saveTask.useMutation({
    onSuccess: refresh,
    onError,
  });
  const saveResource = trpc.commerce.saveResource.useMutation({
    onSuccess: async () => {
      setResourceEditor(false);
      setResourceTitle("");
      setResourceUrl("");
      setResourceNotes("");
      await refresh();
    },
    onError,
  });
  const archiveResource = trpc.commerce.archiveResource.useMutation({
    onSuccess: refresh,
    onError,
  });
  const data = query.data;
  const activeSections = data?.sections.filter(s => !s.archived) ?? [];
  const section =
    activeSections.find(s => s.id === sectionId) ?? activeSections[0];
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const activeSectionIds = new Set(activeSections.map(s => s.id));
  const liveTasks =
    data?.tasks.filter(t => activeSectionIds.has(t.sectionId)) ?? [];
  const tasks = liveTasks.filter(
    t =>
      (page !== "journey" || t.sectionId === section?.id) &&
      matchesCommerceTask(t, view, user.id, today)
  );
  useEffect(() => {
    setManage(false);
  }, [section?.id, page]);
  const navigate = (value: string) => {
    setPage(value);
    setMobile(false);
    setView("open");
  };
  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F2EE] text-[#1F2328]">
      {mobile && (
        <button
          aria-label="إغلاق القائمة"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col bg-[#14285F] px-4 py-6 text-white transition-transform lg:translate-x-0",
          mobile ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-2">
          <BrandLogo light tagline />
          <button
            aria-label="إغلاق القائمة"
            className="lg:hidden"
            onClick={() => setMobile(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs text-white/60">تأسيس تجارة واستيراد</p>
          <div className="relative mt-1">
            <select
              aria-label="اختيار اللوحة"
              value={board.id}
              disabled={switchingBoard}
              onChange={e => onSelectBoard(Number(e.target.value))}
              className="w-full appearance-none bg-transparent py-1 pl-6 text-sm font-bold outline-none"
            >
              {boards.map(b => (
                <option key={b.id} value={b.id} className="text-slate-900">
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-0 top-1 size-4" />
          </div>
        </div>
        <nav
          className="mt-5 flex-1 space-y-1 overflow-y-auto"
          aria-label="قائمة المشروع"
        >
          {navItems.map(item => (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => navigate(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm",
                  page === item.id && item.id !== "journey"
                    ? "bg-white font-bold text-[#14285F]"
                    : "text-white/75 hover:bg-white/10"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
              {item.id === "journey" && (
                <>
                  <div className="mr-3 space-y-1 border-r border-white/15 pr-3">
                    {activeSections.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSectionId(s.id);
                          navigate("journey");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-xs",
                          page === "journey" && section?.id === s.id
                            ? "bg-white font-bold text-[#14285F]"
                            : "text-white/70 hover:bg-white/10"
                        )}
                      >
                        <span>{s.name}</span>
                        <span>
                          {
                            data?.tasks.filter(
                              t =>
                                t.sectionId === s.id &&
                                !t.archived &&
                                t.status !== "done"
                            ).length
                          }
                        </span>
                      </button>
                    ))}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => setSectionEditor({ name: "" })}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-white/65"
                    >
                      <Plus className="size-4" />
                      إضافة قسم
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          <a
            href="/boards/new"
            className="mt-4 flex items-center gap-2 rounded-xl border border-white/20 px-3 py-3 text-xs"
          >
            <Plus className="size-4" />
            لوحة جديدة / القوالب
          </a>
        </nav>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-sm font-bold">{user.name || "مستخدم وجهة"}</p>
          <p className="mt-1 text-xs text-white/55">
            {canManage ? "مدير المساحة" : canEdit ? "عضو الفريق" : "مشاهد"}
          </p>
        </div>
      </aside>
      <div className="lg:mr-[280px]">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[#DEDFDC] px-5">
          <button
            aria-label="فتح القائمة"
            className="lg:hidden"
            onClick={() => setMobile(true)}
          >
            <Menu className="size-5" />
          </button>
          <p className="text-sm text-[#696D75]">
            {board.name} / من اختيار المنتج إلى أول بيع
          </p>
          {canEdit && ["journey", "tasks"].includes(page) && (
            <Button
              disabled={!section}
              onClick={() => setTaskEditor("new")}
              className="gap-2 bg-[#1E3A8A]"
            >
              <Plus className="size-4" />
              إضافة مهمة
            </Button>
          )}
        </header>
        <main className="mx-auto max-w-6xl p-5 md:p-8">
          {query.isLoading ? (
            <Loader2 className="mx-auto mt-16 size-7 animate-spin text-[#1E3A8A]" />
          ) : query.error ? (
            <div role="alert" className="rounded-xl bg-white p-6">
              {query.error.message}
              <Button className="mr-4" onClick={() => query.refetch()}>
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            data && (
              <>
                <p className="text-xs font-semibold text-[#7A2E5C]">
                  تأسيس تجارة واستيراد
                </p>
                <h1 className="mt-2 text-3xl font-bold">
                  {page === "journey"
                    ? (section?.name ?? "رحلة المشروع")
                    : navItems.find(i => i.id === page)?.label}
                </h1>
                {["journey", "tasks"].includes(page) && (
                  <>
                    <div className="my-6 flex flex-wrap gap-3">
                      {[
                        ["today", "اليوم"],
                        ["overdue", "متأخرة"],
                        ["waiting", "بانتظار"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          aria-pressed={page === "tasks" && view === key}
                          onClick={() => {
                            setPage("tasks");
                            setView(key);
                          }}
                          className="rounded-xl border border-[#DEDFDC] bg-white px-4 py-3 text-sm"
                        >
                          <b className="ml-2 text-[#1E3A8A]">
                            {
                              liveTasks.filter(t =>
                                matchesCommerceTask(t, key, user.id, today)
                              ).length
                            }
                          </b>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-[#DEDFDC] bg-white p-5 md:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-[#696D75]">
                          {page === "journey"
                            ? "مهام هذا القسم — يمكن العمل على أكثر من قسم معًا"
                            : "مهام المشروع من جميع الأقسام النشطة"}
                        </p>
                        {canManage && page === "journey" && section && (
                          <Button
                            variant="outline"
                            onClick={() => setManage(!manage)}
                            aria-expanded={manage}
                          >
                            <MoreHorizontal className="ml-2 size-4" />
                            إدارة القسم
                          </Button>
                        )}
                      </div>
                      {manage && section && (
                        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                          <Button
                            variant="outline"
                            onClick={() =>
                              setSectionEditor({
                                id: section.id,
                                name: section.name,
                              })
                            }
                          >
                            تعديل الاسم
                          </Button>
                          <Button
                            variant="outline"
                            disabled={
                              moveSection.isPending ||
                              activeSections[0]?.id === section.id
                            }
                            onClick={() =>
                              moveSection.mutate({
                                id: section.id,
                                direction: "up",
                              })
                            }
                          >
                            <ArrowUp className="ml-1 size-4" />
                            تقديم
                          </Button>
                          <Button
                            variant="outline"
                            disabled={
                              moveSection.isPending ||
                              activeSections.at(-1)?.id === section.id
                            }
                            onClick={() =>
                              moveSection.mutate({
                                id: section.id,
                                direction: "down",
                              })
                            }
                          >
                            <ArrowDown className="ml-1 size-4" />
                            تأخير
                          </Button>
                          <Button
                            variant="outline"
                            disabled={archiveSection.isPending}
                            onClick={() =>
                              archiveSection.mutate({
                                id: section.id,
                                archived: true,
                              })
                            }
                          >
                            <Archive className="ml-1 size-4" />
                            أرشفة مع حفظ المهام
                          </Button>
                        </div>
                      )}
                      <div
                        className="my-5 flex flex-wrap gap-2"
                        aria-label="تصفية المهام"
                      >
                        {[
                          ["open", "المفتوحة"],
                          ["mine", "مهامي"],
                          ["unassigned", "غير المسندة"],
                          ["done", "المكتملة"],
                          ["archived", "المؤرشفة"],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            aria-pressed={view === key}
                            onClick={() => setView(key)}
                            className={cn(
                              "rounded-lg px-3 py-2 text-xs",
                              view === key
                                ? "bg-[#1E3A8A] text-white"
                                : "bg-[#F5F2EE] text-[#62635F]"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {!tasks.length && (
                        <div className="py-10 text-center text-sm text-[#696D75]">
                          {!section && page === "journey"
                            ? "أضف قسمًا أو استعد قسمًا مؤرشفًا للبدء."
                            : "لا توجد مهام في هذا العرض."}
                        </div>
                      )}
                      {tasks.map(task => (
                        <div
                          key={task.id}
                          className="flex flex-wrap items-start gap-3 border-t border-[#ECECE9] py-4"
                        >
                          <input
                            aria-label={`إكمال ${task.title}`}
                            type="checkbox"
                            checked={task.status === "done"}
                            disabled={
                              !canEdit || quickSave.isPending || task.archived
                            }
                            onChange={e =>
                              quickSave.mutate({
                                ...taskFields(task),
                                status: e.target.checked ? "done" : "todo",
                              })
                            }
                            className="mt-2 size-4 accent-[#1E3A8A]"
                          />
                          <button
                            className="min-w-0 flex-1 text-right"
                            onClick={() => setTaskEditor(task)}
                          >
                            <p
                              className={cn(
                                "font-semibold",
                                task.status === "done" &&
                                  "text-[#696D75] line-through"
                              )}
                            >
                              {task.title}
                              {task.priority === "urgent" && (
                                <span className="mr-2 text-xs text-[#7A2E5C]">
                                  عاجلة
                                </span>
                              )}
                            </p>
                            <p className="mt-1 text-xs leading-6 text-[#696D75]">
                              {page === "tasks" &&
                                `${data.sections.find(s => s.id === task.sectionId)?.name} · `}
                              {data.members.find(
                                m => m.userId === task.assigneeUserId
                              )?.name ?? "غير مسندة"}{" "}
                              ·{" "}
                              {task.dueDate
                                ? new Date(
                                    task.dueDate + "T12:00:00"
                                  ).toLocaleDateString("ar-SA", {
                                    calendar: "gregory",
                                  })
                                : "بدون موعد"}
                              {Boolean(task.checklist?.length) &&
                                ` · ${task.checklist?.filter(c => c.done).length}/${task.checklist?.length} خطوات`}
                            </p>
                            {task.status === "blocked" &&
                              task.waitingReason && (
                                <p className="mt-1 text-xs text-[#896400]">
                                  بانتظار: {task.waitingReason}
                                </p>
                              )}
                          </button>
                          <span className="shrink-0 rounded-lg bg-[#E9EDF7] px-2 py-1 text-xs text-[#1E3A8A]">
                            {commerceStatusLabels[task.status]}
                          </span>
                          {task.archived && canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={archiveTask.isPending}
                              onClick={() =>
                                archiveTask.mutate({
                                  id: task.id,
                                  archived: false,
                                })
                              }
                            >
                              استعادة
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {page === "archives" && (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm text-[#696D75]">
                      الأقسام ومهامها محفوظة. استعادة القسم تعيده إلى رحلة
                      المشروع.
                    </p>
                    {data.sections
                      .filter(s => s.archived)
                      .map(s => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-5"
                        >
                          <div>
                            <b>{s.name}</b>
                            <p className="mt-1 text-xs text-[#696D75]">
                              {
                                data.tasks.filter(t => t.sectionId === s.id)
                                  .length
                              }{" "}
                              مهام محفوظة
                            </p>
                          </div>
                          {canManage && (
                            <Button
                              disabled={archiveSection.isPending}
                              onClick={() =>
                                archiveSection.mutate({
                                  id: s.id,
                                  archived: false,
                                })
                              }
                            >
                              استعادة القسم
                            </Button>
                          )}
                        </div>
                      ))}
                    {!data.sections.some(s => s.archived) && (
                      <p className="py-10 text-center text-sm text-[#696D75]">
                        لا توجد أقسام مؤرشفة.
                      </p>
                    )}
                  </div>
                )}
                {page === "files" && (
                  <div className="mt-6">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[#696D75]">
                        روابط عروض الأسعار والمواصفات والعينات في مكان واحد.
                      </p>
                      {canEdit && (
                        <Button
                          className="bg-[#1E3A8A]"
                          onClick={() => setResourceEditor(true)}
                        >
                          إضافة رابط ملف
                        </Button>
                      )}
                    </div>
                    <label className="mb-4 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showArchivedFiles}
                        onChange={e => setShowArchivedFiles(e.target.checked)}
                      />
                      عرض المؤرشفة
                    </label>
                    <div className="space-y-3">
                      {data.resources
                        .filter(r => r.archived === showArchivedFiles)
                        .map(r => (
                          <div
                            key={r.id}
                            className="rounded-2xl border bg-white p-5"
                          >
                            <div className="flex justify-between gap-3">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 font-bold text-[#1E3A8A]"
                              >
                                {r.title}
                                <ExternalLink className="size-4" />
                              </a>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={archiveResource.isPending}
                                  onClick={() =>
                                    archiveResource.mutate({
                                      id: r.id,
                                      archived: !r.archived,
                                    })
                                  }
                                >
                                  {r.archived ? "استعادة" : "أرشفة"}
                                </Button>
                              )}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-[#696D75]">
                              {r.notes}
                            </p>
                          </div>
                        ))}
                      {!data.resources.some(
                        r => r.archived === showArchivedFiles
                      ) && (
                        <p className="py-10 text-center text-sm text-[#696D75]">
                          لا توجد روابط ملفات في هذا العرض.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {page === "team" && (
                  <div className="mt-6">
                    {canManage && (
                      <div className="mb-5 rounded-2xl border bg-white p-5">
                        <h2 className="font-bold">دعوة شريكتك أو فريقك</h2>
                        <p className="mt-2 text-sm text-[#696D75]">
                          شارك رابط الانضمام مع الشخص الذي تريد إضافته للمشروع.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                `${window.location.origin}/join/${board.inviteToken}`
                              );
                              toast.success("تم نسخ رابط الدعوة");
                            } catch {
                              toast.error("تعذر النسخ");
                            }
                          }}
                        >
                          نسخ رابط الدعوة
                        </Button>
                        <p className="mt-3 text-xs text-[#696D75]">
                          رمز الانضمام: <span dir="ltr">{board.joinCode}</span>
                        </p>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {data.members.map(m => (
                        <div
                          key={m.id}
                          className="rounded-2xl border bg-white p-5"
                        >
                          <p className="font-bold">{m.name}</p>
                          <p className="mt-1 text-xs text-[#696D75]">
                            {m.role}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </main>
      </div>
      <Dialog
        open={sectionEditor !== null}
        onOpenChange={open => {
          if (!open && !saveSection.isPending) setSectionEditor(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {sectionEditor?.id ? "تعديل اسم القسم" : "إضافة قسم"}
            </DialogTitle>
            <DialogDescription>
              الأقسام تنظّم رحلة المشروع ويمكن تعديل ترتيبها لاحقًا.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (sectionEditor) saveSection.mutate(sectionEditor);
            }}
          >
            <label className="text-sm">
              اسم القسم
              <Input
                required
                maxLength={180}
                value={sectionEditor?.name ?? ""}
                onChange={e =>
                  setSectionEditor(s =>
                    s ? { ...s, name: e.target.value } : s
                  )
                }
                className="mt-2"
              />
            </label>
            <DialogFooter className="mt-5">
              <Button
                disabled={saveSection.isPending || !sectionEditor?.name.trim()}
                type="submit"
              >
                حفظ القسم
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {taskEditor && data && section && (
        <TaskDialog
          key={typeof taskEditor === "string" ? "new" : taskEditor.id}
          task={taskEditor === "new" ? null : taskEditor}
          data={data}
          defaultSection={section.id}
          userId={user.id}
          canEdit={canEdit}
          close={() => setTaskEditor(null)}
          refresh={refresh}
        />
      )}
      <Dialog open={resourceEditor} onOpenChange={setResourceEditor}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة رابط ملف</DialogTitle>
            <DialogDescription>
              أضف رابطًا إلى ملف محفوظ أو عرض سعر أو صفحة مورد.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              saveResource.mutate({
                title: resourceTitle,
                url: resourceUrl,
                notes: resourceNotes,
              });
            }}
          >
            <label className="block text-sm">
              الاسم
              <Input
                required
                maxLength={280}
                value={resourceTitle}
                onChange={e => setResourceTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              الرابط
              <Input
                required
                type="url"
                dir="ltr"
                value={resourceUrl}
                maxLength={2000}
                onChange={e => setResourceUrl(e.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="block text-sm">
              ملاحظات
              <Textarea
                value={resourceNotes}
                maxLength={5000}
                onChange={e => setResourceNotes(e.target.value)}
              />
            </label>
            <DialogFooter>
              <Button disabled={saveResource.isPending} type="submit">
                حفظ الرابط
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskDialog({
  task,
  data,
  defaultSection,
  userId,
  canEdit,
  close,
  refresh,
}: {
  task: Task | null;
  data: Overview;
  defaultSection: number;
  userId: number;
  canEdit: boolean;
  close: () => void;
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [sectionId, setSectionId] = useState(task?.sectionId ?? defaultSection);
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<Task["status"]>(task?.status ?? "todo");
  const [priority, setPriority] = useState<Task["priority"]>(
    task?.priority ?? "normal"
  );
  const [assignee, setAssignee] = useState<number | null>(
    task ? task.assigneeUserId : userId
  );
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [waitingReason, setWaitingReason] = useState(task?.waitingReason ?? "");
  const [checklist, setChecklist] = useState<CommerceChecklist>(
    task?.checklist ?? []
  );
  const [step, setStep] = useState("");
  const [details, setDetails] = useState(Boolean(task));
  const save = trpc.commerce.saveTask.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("تم حفظ المهمة");
      close();
    },
    onError: error => toast.error(error.message),
  });
  const archive = trpc.commerce.archiveTask.useMutation({
    onSuccess: async () => {
      await refresh();
      close();
    },
    onError: error => toast.error(error.message),
  });
  const disabled = !canEdit || save.isPending || archive.isPending;
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !save.isPending) close();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{task ? "تفاصيل المهمة" : "إضافة مهمة"}</DialogTitle>
          <DialogDescription>
            العنوان فقط مطلوب؛ نحدد القسم والمسؤول تلقائيًا ويمكن تغييرهما.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            save.mutate({
              id: task?.id,
              version: task?.version,
              title,
              sectionId,
              description,
              status,
              priority,
              assigneeUserId: assignee,
              dueDate: dueDate || null,
              waitingReason,
              checklist,
            });
          }}
        >
          <label className="block text-sm">
            عنوان المهمة
            <Input
              required
              maxLength={280}
              disabled={disabled}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="mt-2"
              autoFocus
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              القسم
              <select
                className={selectClass}
                value={sectionId}
                disabled={disabled}
                onChange={e => setSectionId(Number(e.target.value))}
              >
                {data.sections
                  .filter(s => !s.archived)
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              المسؤول
              <select
                className={selectClass}
                value={assignee ?? ""}
                disabled={disabled}
                onChange={e =>
                  setAssignee(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">غير مسندة</option>
                {data.members
                  .filter(m => m.userId)
                  .map(m => (
                    <option key={m.id} value={m.userId!}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              الموعد
              <Input
                type="date"
                value={dueDate}
                disabled={disabled}
                onChange={e => setDueDate(e.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              الحالة
              <select
                className={selectClass}
                value={status}
                disabled={disabled}
                onChange={e => setStatus(e.target.value as Task["status"])}
              >
                {Object.entries(commerceStatusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {status === "blocked" && (
            <label className="block text-sm">
              بانتظار ماذا؟
              <Input
                value={waitingReason}
                maxLength={1000}
                disabled={disabled}
                onChange={e => setWaitingReason(e.target.value)}
                className="mt-2"
                placeholder="مثال: عرض الشحن من المورد"
              />
            </label>
          )}
          <button
            type="button"
            className="text-sm font-semibold text-[#1E3A8A]"
            onClick={() => setDetails(!details)}
            aria-expanded={details}
          >
            {details ? "إخفاء التفاصيل" : "＋ تفاصيل وخطوات إضافية"}
          </button>
          {details && (
            <>
              <label className="block text-sm">
                الوصف والملاحظات
                <Textarea
                  value={description}
                  maxLength={20_000}
                  disabled={disabled}
                  onChange={e => setDescription(e.target.value)}
                  className="mt-2"
                />
              </label>
              <label className="grid gap-2 text-sm">
                الأولوية
                <select
                  className={selectClass}
                  value={priority}
                  disabled={disabled}
                  onChange={e =>
                    setPriority(e.target.value as Task["priority"])
                  }
                >
                  <option value="normal">عادية</option>
                  <option value="urgent">عاجلة</option>
                </select>
              </label>
              <div>
                <p className="mb-2 text-sm font-semibold">خطوات المهمة</p>
                {checklist.map((item, index) => (
                  <div key={item.id} className="mb-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`إكمال ${item.text}`}
                      checked={item.done}
                      disabled={disabled}
                      onChange={e =>
                        setChecklist(list =>
                          list.map((v, i) =>
                            i === index ? { ...v, done: e.target.checked } : v
                          )
                        )
                      }
                    />
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        item.done && "line-through"
                      )}
                    >
                      {item.text}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={`حذف خطوة ${item.text}`}
                        onClick={() =>
                          setChecklist(list =>
                            list.filter((_, i) => i !== index)
                          )
                        }
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="خطوة جديدة"
                      aria-label="خطوة جديدة"
                      value={step}
                      maxLength={500}
                      disabled={disabled}
                      onChange={e => setStep(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        disabled || !step.trim() || checklist.length >= 100
                      }
                      onClick={() => {
                        setChecklist(list => [
                          ...list,
                          {
                            id: crypto.randomUUID(),
                            text: step.trim(),
                            done: false,
                          },
                        ]);
                        setStep("");
                      }}
                    >
                      إضافة
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
          <DialogFooter className="gap-2">
            {task && canEdit && (
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  archive.mutate({ id: task.id, archived: !task.archived })
                }
              >
                {task.archived ? "استعادة المهمة" : "أرشفة المهمة"}
              </Button>
            )}
            {canEdit && (
              <Button
                type="submit"
                disabled={disabled || !title.trim()}
                className="bg-[#1E3A8A]"
              >
                {save.isPending && (
                  <Loader2 className="ml-2 size-4 animate-spin" />
                )}
                حفظ المهمة
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={save.isPending}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
