import BoardAssistant from "@/components/BoardAssistant";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Sun, Sparkles, Plus, Pencil, Loader2, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { personalToday, suggestPersonalTasks } from "@shared/personal";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
type Task =
  inferRouterOutputs<AppRouter>["personal"]["overview"]["tasks"][number];
type Props = {
  user: { id: number; name?: string | null };
  board: { id: number; name: string; membershipRole: string };
  boards: Array<{ id: number; name: string }>;
  switchingBoard: boolean;
  onSelectBoard: (id: number) => void;
};
const control =
  "w-full rounded-lg border border-[#DEDFDC] bg-white px-3 py-2 text-sm";
export default function PersonalBoard({
  user,
  board,
  boards,
  switchingBoard,
  onSelectBoard,
}: Props) {
  const utils = trpc.useUtils();
  const query = trpc.personal.overview.useQuery();
  const [filter, setFilter] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [today, setToday] = useState(personalToday());
  useEffect(() => {
    const timer = setInterval(() => setToday(personalToday()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [editor, setEditor] = useState<Task | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [executionDate, setExecutionDate] = useState("");
  const [executionTime, setExecutionTime] = useState("");
  const [catEditor, setCatEditor] = useState<{
    id?: number;
    name: string;
  } | null>(null);
  const refresh = () => utils.personal.overview.invalidate();
  const onError = (e: { message: string }) => {
    toast.error(e.message);
    void refresh();
  };
  const save = trpc.personal.saveTask.useMutation({
    onSuccess: async () => {
      setEditor(null);
      await refresh();
      toast.success("حُفظت المهمة");
    },
    onError,
  });
  const state = trpc.personal.setState.useMutation({
    onSuccess: refresh,
    onError,
  });
  const category = trpc.personal.saveCategory.useMutation({
    onSuccess: async () => {
      setCatEditor(null);
      await refresh();
    },
    onError,
  });
  const canEdit = board.membershipRole !== "viewer";
  const data = query.data;
  const tasks = data?.tasks ?? [];
  const categories = data?.categories ?? [];
  const focus = tasks.filter(t => t.focusDate === today);
  const suggestions = suggestPersonalTasks(tasks, today);
  function open(task: Task | "new") {
    setEditor(task);
    setTitle(task === "new" ? "" : task.title);
    setCategoryId(task === "new" ? "" : String(task.categoryId ?? ""));
    setDueDate(task === "new" ? "" : (task.dueDate ?? ""));
    setExecutionDate(task === "new" ? "" : (task.executionDate ?? ""));
    setExecutionTime(task === "new" ? "" : (task.executionTime ?? ""));
  }
  function dateLabel(value: string | null) {
    if (!value) return "بدون موعد";
    if (value < today) return "متأخرة · " + value;
    if (value === today) return "موعدها اليوم";
    return (
      "موعدها " +
      new Intl.DateTimeFormat("ar-SA", {
        month: "short",
        day: "numeric",
        calendar: "gregory",
      }).format(new Date(value + "T12:00:00"))
    );
  }
  function change(t: Task, fields: { done?: boolean; focus?: boolean }) {
    state.mutate({ id: t.id, version: t.version, ...fields });
  }
  function row(t: Task, inToday = false) {
    return (
      <div
        key={t.id}
        className="flex flex-wrap items-center gap-3 border-b border-[#E8E5DF] py-3 last:border-0"
      >
        <input
          aria-label={`إنجاز ${t.title}`}
          type="checkbox"
          checked={t.done}
          disabled={!canEdit || state.isPending}
          onChange={e => change(t, { done: e.target.checked })}
          className="size-5 accent-[#1E3A8A]"
        />
        <div className="min-w-0 flex-1">
          <button
            disabled={!canEdit}
            onClick={() => open(t)}
            className={`text-right break-words ${t.done ? "text-[#77786F] line-through" : ""}`}
          >
            {t.title}
          </button>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#77786F]">
            <span className="text-[#7A2E5C]">
              {categories.find(c => c.id === t.categoryId)?.name ??
                "بدون تصنيف"}
            </span>
            <span>{dateLabel(t.dueDate)}</span>
            {t.executionDate && (
              <span>
                التنفيذ: {t.executionDate}
                {t.executionTime ? " · " + t.executionTime : ""}
              </span>
            )}
          </div>
        </div>
        {inToday ? (
          <button
            disabled={!canEdit || state.isPending}
            onClick={() => change(t, { focus: false })}
            aria-label={`إزالة ${t.title} من اليوم`}
            className="p-2 text-[#77786F]"
          >
            <X className="size-4" />
          </button>
        ) : !t.done && t.focusDate !== today ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit || state.isPending}
            onClick={() => change(t, { focus: true })}
          >
            لليوم ＋
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F5F2EE] text-[#1F2328] md:grid md:grid-cols-[210px_minmax(0,1fr)]"
    >
      <aside
        className={`${mobile ? "block" : "hidden"} border-l border-[#E8E5DF] bg-white p-5 md:block`}
      >
        <BrandLogo tagline />
        <label className="mt-8 block text-xs text-[#77786F]">
          لوحاتي
          <select
            aria-label="اختيار اللوحة"
            className={control + " mt-2"}
            value={board.id}
            disabled={switchingBoard}
            onChange={e => onSelectBoard(Number(e.target.value))}
          >
            {boards.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#E9EDF7] px-3 py-3 text-sm text-[#1E3A8A]">
          <Sun className="size-4" />
          اللوحة الشخصية
        </div>
        <a
          href="/boards/new"
          className="mt-4 block px-3 text-sm text-[#1E3A8A]"
        >
          ＋ لوحة جديدة
        </a>
        <div className="mt-12 border-t pt-4 text-sm">
          {user.name}
          <p className="mt-1 text-xs text-[#77786F]">لكل طموح، وجهة.</p>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl p-5 sm:p-8">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              aria-label="القائمة"
              onClick={() => setMobile(!mobile)}
              className="mb-2 md:hidden"
            >
              <Menu />
            </button>
            <p className="text-xs text-[#77786F]">
              {new Intl.DateTimeFormat("ar-SA", {
                weekday: "long",
                day: "numeric",
                month: "long",
                calendar: "gregory",
              }).format(new Date(today + "T12:00:00"))}
            </p>
            <h1 className="mt-2 text-2xl font-bold">{board.name}</h1>
            <p className="mt-2 text-sm text-[#77786F]">
              رتّب مهامك، واختر ما يستحق تركيزك اليوم.
            </p>
          </div>
          <BoardAssistant
            key={board.id}
            boardId={board.id}
            boardName={board.name}
            canEdit={canEdit}
            onSaved={refresh}
          />
          <Button
            disabled={!canEdit}
            onClick={() => open("new")}
            className="gap-2 bg-[#1E3A8A]"
          >
            <Plus className="size-4" />
            مهمة جديدة
          </Button>
        </header>
        {query.isLoading ? (
          <div className="py-16">
            <Loader2 className="mx-auto animate-spin" />
          </div>
        ) : query.error ? (
          <div role="alert" className="rounded-xl bg-white p-5">
            {query.error.message}
            <Button
              onClick={() => query.refetch()}
              variant="outline"
              className="mr-3"
            >
              حاول مجددًا
            </Button>
          </div>
        ) : (
          <>
            <section className="mb-5 rounded-2xl border border-[#E8E5DF] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[#1E3A8A]">
                  <Sun className="size-5" />
                  تركيزي اليوم
                </h2>
                <span className="text-xs text-[#77786F]">
                  {focus.filter(t => t.done).length} من {focus.length} أُنجزت
                </span>
              </div>
              {focus.length ? (
                focus.map(t => row(t, true))
              ) : (
                <p className="py-6 text-sm text-[#77786F]">
                  اختر مهامك لليوم من القائمة أو الاقتراحات أدناه.
                </p>
              )}
              <div className="mt-4 rounded-xl bg-[#E9EDF7] p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#1E3A8A]">
                  <Sparkles className="size-4" />
                  أقرب ٣ مهام لموعدها
                </h3>
                {suggestions.length ? (
                  suggestions.map(t => (
                    <div
                      key={t.id}
                      className="mt-3 flex flex-wrap items-center gap-3"
                    >
                      <div className="min-w-0 flex-1 text-sm break-words">
                        {t.title}
                        <p className="mt-1 text-xs text-[#62635F]">
                          {dateLabel(t.dueDate)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || state.isPending}
                        onClick={() => change(t, { focus: true })}
                      >
                        أضف لليوم ＋
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="mt-3 text-xs text-[#62635F]">
                    لا توجد مهام أخرى لها موعد إنجاز محدد.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-[#E8E5DF] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">كل مهامي</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => setCatEditor({ name: "" })}
                >
                  ＋ جانب جديد
                </Button>
              </div>
              <div className="my-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter(null)}
                  className={`rounded-full px-3 py-1.5 text-sm ${filter === null ? "bg-[#E9EDF7] text-[#1E3A8A]" : "text-[#62635F]"}`}
                >
                  الكل
                </button>
                {categories.map(c => (
                  <div
                    key={c.id}
                    className={`flex items-center rounded-full text-sm ${filter === c.id ? "bg-[#E9EDF7] text-[#1E3A8A]" : "text-[#62635F]"}`}
                  >
                    <button
                      onClick={() => setFilter(c.id)}
                      className="px-3 py-1.5"
                    >
                      {c.name}
                    </button>
                    {filter === c.id && canEdit && (
                      <button
                        aria-label={`تعديل ${c.name}`}
                        onClick={() => setCatEditor({ id: c.id, name: c.name })}
                        className="pl-3"
                      >
                        <Pencil className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <label className="mb-3 flex items-center gap-2 text-xs text-[#77786F]">
                <input
                  type="checkbox"
                  checked={showDone}
                  onChange={e => setShowDone(e.target.checked)}
                />
                إظهار المهام المنجزة
              </label>
              {tasks
                .filter(
                  t =>
                    (showDone || !t.done) &&
                    (filter === null || t.categoryId === filter)
                )
                .map(t => row(t))}
              {!tasks.filter(
                t =>
                  (showDone || !t.done) &&
                  (filter === null || t.categoryId === filter)
              ).length && (
                <p className="py-8 text-center text-sm text-[#77786F]">
                  {tasks.length
                    ? "لا توجد مهام غير منجزة في هذا العرض."
                    : "قائمتك جاهزة. أضف أول مهمة."}
                </p>
              )}
            </section>
          </>
        )}
      </main>
      <Dialog open={editor !== null} onOpenChange={v => !v && setEditor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editor === "new" ? "مهمة جديدة" : "تعديل المهمة"}
            </DialogTitle>
            <DialogDescription>
              العنوان فقط مطلوب. اختر المواعيد والتصنيف إذا احتجت.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              save.mutate({
                ...(editor && editor !== "new"
                  ? { id: editor.id, version: editor.version }
                  : {}),
                title,
                categoryId: categoryId ? Number(categoryId) : null,
                dueDate: String(values.get("dueDate") || "") || null,
                executionDate:
                  String(values.get("executionDate") || "") || null,
                executionTime:
                  String(values.get("executionTime") || "") || null,
              });
            }}
            className="space-y-4"
          >
            <label className="block text-sm">
              وش تبي تنجز؟
              <Input
                required
                maxLength={280}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="mt-2"
              />
            </label>
            <label className="block text-sm">
              جانب حياتك
              <select
                className={control + " mt-2"}
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">بدون تصنيف</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              موعد الإنجاز
              <Input
                type="date"
                name="dueDate"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="mt-2"
              />
            </label>
            <details open={Boolean(executionDate)}>
              <summary className="text-sm text-[#1E3A8A]">
                تخصيص وقت للتنفيذ (اختياري)
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-sm">
                  اليوم
                  <Input
                    type="date"
                    name="executionDate"
                    value={executionDate}
                    onChange={e => {
                      setExecutionDate(e.target.value);
                      if (!e.target.value) setExecutionTime("");
                    }}
                  />
                </label>
                <label className="text-sm">
                  الساعة
                  <Input
                    type="time"
                    name="executionTime"
                    value={executionTime}
                    disabled={!executionDate}
                    onChange={e => setExecutionTime(e.target.value)}
                  />
                </label>
              </div>
            </details>
            <Button
              type="submit"
              disabled={save.isPending || !title.trim()}
              className="w-full bg-[#1E3A8A]"
            >
              {save.isPending ? "جارٍ الحفظ…" : "حفظ المهمة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={catEditor !== null}
        onOpenChange={v => !v && setCatEditor(null)}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {catEditor?.id ? "تعديل جانب الحياة" : "جانب حياة جديد"}
            </DialogTitle>
            <DialogDescription>
              سمّه بالطريقة التي تناسبك، مثل الأسرة أو الرياضة.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (catEditor) category.mutate(catEditor);
            }}
          >
            <Input
              aria-label="اسم جانب الحياة"
              required
              maxLength={100}
              value={catEditor?.name ?? ""}
              onChange={e =>
                setCatEditor({ ...catEditor, name: e.target.value })
              }
            />
            <Button
              type="submit"
              disabled={category.isPending || !catEditor?.name.trim()}
              className="mt-4 w-full bg-[#1E3A8A]"
            >
              حفظ
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
