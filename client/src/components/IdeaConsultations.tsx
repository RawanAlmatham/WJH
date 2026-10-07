import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ListTodo,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  consultationFieldsSchema,
  type ConsultationFields,
  type ConsultationQuestion,
} from "@shared/consultations";
import type { ideaLabConsultations } from "../../../drizzle/schema";

type Consultation = typeof ideaLabConsultations.$inferSelect;
const statusLabels = {
  preparing: "قيد التجهيز",
  ready: "جاهزة للقاء",
  completed: "مكتملة",
};
const priorityLabels = {
  high: "مهم جدًا",
  normal: "عادي",
  later: "إذا سمح الوقت",
};
const empty = (): ConsultationFields => ({
  title: "",
  consultant: "",
  goal: "",
  status: "preparing",
  questions: [],
  summary: "",
  recommendations: "",
});
const inputClass =
  "h-10 w-full rounded-lg border border-[#DEDFDC] bg-white px-3 text-sm";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-xs text-[#696D75]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function IdeaConsultations({
  ideaId,
  consultations,
  canEdit,
  aiConfigured,
  onOpenSettings,
  onOpenTask,
}: {
  ideaId: number;
  consultations: Consultation[];
  canEdit: boolean;
  aiConfigured: boolean;
  onOpenSettings: () => void;
  onOpenTask: (task: any) => void;
}) {
  const items = consultations.filter(item => item.ideaId === ideaId);
  const utils = trpc.useUtils();
  const save = trpc.ideaLab.saveConsultation.useMutation();
  const remove = trpc.ideaLab.deleteConsultation.useMutation();
  const suggest = trpc.ideaLab.suggestConsultationQuestions.useMutation();
  const toTask = trpc.ideaLab.consultationToTask.useMutation();
  const [selected, setSelected] = useState<Consultation | null>(
    items[0] || null
  );
  const [draft, setDraft] = useState<ConsultationFields>(items[0] || empty());
  const [dirty, setDirty] = useState(false);
  const [results, setResults] = useState(false);
  const [question, setQuestion] = useState("");
  const [priority, setPriority] =
    useState<ConsultationQuestion["priority"]>("normal");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const busy =
    save.isPending || remove.isPending || toTask.isPending || suggest.isPending;
  useEffect(() => {
    if (!dirty) return;
    const listener = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  const change = (fields: Partial<ConsultationFields>) => {
    setDraft(value => ({ ...value, ...fields }));
    setDirty(true);
  };
  const select = (item: Consultation | null) => {
    if (
      (dirty || question.trim()) &&
      !window.confirm("لديك تغييرات غير محفوظة. هل تريد تركها؟")
    )
      return;
    setSelected(item);
    setDraft(item || empty());
    setDirty(false);
    setQuestion("");
    setSuggestions([]);
    setResults(false);
  };
  const updateQuestion = (id: string, fields: Partial<ConsultationQuestion>) =>
    change({
      questions: draft.questions.map(item =>
        item.id === id ? { ...item, ...fields } : item
      ),
    });
  const addQuestion = (text: string, level = priority) => {
    if (!text.trim() || draft.questions.length >= 60) return;
    change({
      questions: [
        ...draft.questions,
        {
          id: crypto.randomUUID(),
          text: text.trim(),
          priority: level,
          answer: "",
        },
      ],
    });
  };
  const move = (index: number, offset: number) => {
    const questions = [...draft.questions];
    [questions[index], questions[index + offset]] = [
      questions[index + offset],
      questions[index],
    ];
    change({ questions });
  };
  const persist = async () => {
    try {
      if (question.trim()) {
        toast.error("أضف السؤال المكتوب للقائمة أو امسحه قبل الحفظ");
        return null;
      }
      const parsed = consultationFieldsSchema.safeParse(draft);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message || "راجع بيانات الاستشارة");
        return null;
      }
      const result = await save.mutateAsync({
        ...parsed.data,
        ideaId,
        id: selected?.id,
        version: selected?.version,
      });
      setSelected({
        ...selected,
        ...parsed.data,
        ...result,
        ideaId,
      } as Consultation);
      setDirty(false);
      await utils.ideaLab.overview.invalidate();
      return result;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذر حفظ الاستشارة"
      );
      return null;
    }
  };
  const openTask = async (id: number) => {
    const data = await utils.ideaLab.overview.fetch();
    const task = data.tasks.find(item => item.id === id);
    if (task) onOpenTask(task);
    else toast.error("المهمة لم تعد متاحة");
  };
  return (
    <section className="mt-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">الاستشارات</h2>
          <p className="mt-1 text-sm text-[#696D75]">
            أسئلتك، إجابات المستشار، والخطوة التالية في مكان واحد.
          </p>
        </div>
        {canEdit && (
          <Button
            className="gap-2 bg-[#1E3A8A]"
            disabled={busy}
            onClick={() => select(null)}
          >
            <Plus className="size-4" /> استشارة جديدة
          </Button>
        )}
      </header>
      {!canEdit && !items.length ? (
        <p className="rounded-xl bg-white p-6 text-sm text-[#696D75]">
          لم تُضف استشارات لهذه الفكرة بعد.
        </p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="space-y-2">
            <p className="mb-3 text-xs text-[#696D75]">استشارات هذه الفكرة</p>
            {items.map(item => (
              <button
                key={item.id}
                disabled={busy}
                onClick={() => select(item)}
                className={`w-full rounded-xl border p-4 text-right ${selected?.id === item.id ? "border-[#1E3A8A] bg-[#E9EDF7]" : "border-[#DEDFDC] bg-white"}`}
              >
                <span className="text-xs text-[#1E3A8A]">
                  {statusLabels[item.status]}
                </span>
                <h3 className="mt-2 font-bold">{item.title}</h3>
                <p className="mt-1 text-xs text-[#696D75]">
                  {item.consultant || "المستشار لم يُحدد"} ·{" "}
                  {item.questions.length} أسئلة
                </p>
              </button>
            ))}
            {!selected && (
              <div className="rounded-xl bg-[#E9EDF7] p-4 text-sm font-bold text-[#1E3A8A]">
                استشارة جديدة
              </div>
            )}
          </aside>
          <div className="min-w-0 rounded-2xl border border-[#DEDFDC] bg-white p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-extrabold">
                <MessageSquare className="size-5 text-[#1E3A8A]" />
                {draft.title || "تجهيز استشارة جديدة"}
              </h3>
              <select
                aria-label="حالة الاستشارة"
                disabled={!canEdit || busy}
                className="h-9 rounded-lg border bg-white px-2 text-xs"
                value={draft.status}
                onChange={e =>
                  change({
                    status: e.target.value as ConsultationFields["status"],
                  })
                }
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset
              disabled={!canEdit || busy}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field label="عنوان الاستشارة">
                <Input
                  maxLength={280}
                  value={draft.title}
                  placeholder="مثال: مراجعة نموذج العمل"
                  onChange={e => change({ title: e.target.value })}
                />
              </Field>
              <Field label="المستشار أو التخصص">
                <Input
                  maxLength={280}
                  value={draft.consultant}
                  placeholder="اسم المستشار أو تخصصه"
                  onChange={e => change({ consultant: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="الهدف من الاستشارة">
                  <Textarea
                    maxLength={5000}
                    rows={2}
                    value={draft.goal}
                    placeholder="ما الذي تريد التأكد منه أو اتخاذ قرار بشأنه؟"
                    onChange={e => change({ goal: e.target.value })}
                  />
                </Field>
              </div>
            </fieldset>
            <nav
              className="my-5 flex gap-6 border-b"
              aria-label="محتوى الاستشارة"
            >
              {[
                [false, "تجهيز الأسئلة"],
                [true, "الإجابات والتوصيات"],
              ].map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={results === value}
                  onClick={() => setResults(Boolean(value))}
                  className={`border-b-2 py-3 text-sm ${results === value ? "border-[#1E3A8A] font-bold text-[#1E3A8A]" : "border-transparent text-[#696D75]"}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">الأسئلة ({draft.questions.length})</h3>
              {!results && canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={
                    suggest.isPending || busy || draft.questions.length >= 60
                  }
                  onClick={async () => {
                    if (!aiConfigured) {
                      toast.info(
                        "أضف مفتاحك في إعدادات حسابك لاستخدام الاقتراحات"
                      );
                      if (
                        !dirty ||
                        window.confirm(
                          "احفظ الاستشارة قبل الانتقال للإعدادات. هل تريد الانتقال دون حفظ؟"
                        )
                      )
                        onOpenSettings();
                      return;
                    }
                    try {
                      const result = await suggest.mutateAsync({
                        ideaId,
                        consultant: draft.consultant,
                        goal: draft.goal,
                        existingQuestions: draft.questions.map(
                          item => item.text
                        ),
                      });
                      setSuggestions(result.questions);
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "تعذر اقتراح الأسئلة"
                      );
                    }
                  }}
                >
                  {suggest.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}{" "}
                  اقتراح أسئلة · اختياري
                </Button>
              )}
            </div>
            {!results && canEdit && (
              <form
                className="mb-4 space-y-3 rounded-xl bg-[#E9EDF7] p-4"
                onSubmit={e => {
                  e.preventDefault();
                  addQuestion(question);
                  setQuestion("");
                }}
              >
                <Field label="أضف سؤالًا من عندك">
                  <Textarea
                    maxLength={2000}
                    disabled={busy || draft.questions.length >= 60}
                    rows={2}
                    value={question}
                    onChange={e => {
                      setQuestion(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="ما الذي تحتاج معرفته عن فكرتك؟"
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <select
                    aria-label="أولوية السؤال الجديد"
                    className="h-9 rounded-lg border bg-white px-3 text-xs"
                    value={priority}
                    onChange={e =>
                      setPriority(
                        e.target.value as ConsultationQuestion["priority"]
                      )
                    }
                  >
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    size="sm"
                    className="gap-2 bg-[#1E3A8A]"
                    disabled={
                      busy || !question.trim() || draft.questions.length >= 60
                    }
                  >
                    <Plus className="size-4" />
                    إضافة السؤال
                  </Button>
                </div>
              </form>
            )}
            {!results && suggestions.length > 0 && (
              <div className="mb-4 rounded-xl border border-[#DEDFDC] p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold">اقتراحات للمراجعة</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSuggestions([])}
                  >
                    إغلاق
                  </Button>
                </div>
                <p className="mb-2 text-xs text-[#696D75]">
                  اختر ما يناسب الاستشارة لإضافته إلى أسئلتك.
                </p>
                {suggestions.map(text => (
                  <div
                    key={text}
                    className="flex items-center justify-between gap-3 border-t py-3"
                  >
                    <p className="text-sm">{text}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || draft.questions.length >= 60}
                      onClick={() => {
                        addQuestion(text, "normal");
                        setSuggestions(items =>
                          items.filter(item => item !== text)
                        );
                      }}
                    >
                      إضافة
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {draft.questions.length === 0 && (
              <p className="py-6 text-sm text-[#696D75]">
                أضف الأسئلة التي تريد مناقشتها مع المستشار.
              </p>
            )}
            {draft.questions.map((item, index) => (
              <div
                key={item.id}
                className="flex gap-3 border-b border-[#E3E4E1] py-4"
              >
                <span className="pt-2 text-xs text-[#696D75]">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  {!results && canEdit ? (
                    <Textarea
                      aria-label={`السؤال ${index + 1}`}
                      disabled={busy}
                      maxLength={2000}
                      rows={2}
                      value={item.text}
                      onChange={e =>
                        updateQuestion(item.id, { text: e.target.value })
                      }
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {item.text}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`أولوية السؤال ${index + 1}`}
                      disabled={!canEdit || busy}
                      className="h-8 rounded-lg border bg-white px-2 text-xs"
                      value={item.priority}
                      onChange={e =>
                        updateQuestion(item.id, {
                          priority: e.target
                            .value as ConsultationQuestion["priority"],
                        })
                      }
                    >
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {canEdit && !results && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="نقل السؤال للأعلى"
                          disabled={busy || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="نقل السؤال للأسفل"
                          disabled={
                            busy || index === draft.questions.length - 1
                          }
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="حذف السؤال"
                          disabled={busy}
                          onClick={() =>
                            change({
                              questions: draft.questions.filter(
                                q => q.id !== item.id
                              ),
                            })
                          }
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                  {results && (
                    <div className="mt-3">
                      <Field label="إجابة المستشار والملاحظات">
                        <Textarea
                          readOnly={!canEdit}
                          disabled={busy}
                          maxLength={10000}
                          rows={3}
                          value={item.answer}
                          onChange={e =>
                            updateQuestion(item.id, { answer: e.target.value })
                          }
                          placeholder="سجل الإجابة أثناء اللقاء أو بعده…"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {draft.questions.length >= 60 && (
              <p className="mt-3 text-xs text-[#696D75]">
                وصلت إلى الحد الأقصى: ٦٠ سؤالًا لكل استشارة.
              </p>
            )}
            {results && (
              <div className="mt-5 space-y-4">
                <Field label="خلاصة الاستشارة">
                  <Textarea
                    readOnly={!canEdit}
                    disabled={busy}
                    maxLength={20000}
                    rows={3}
                    value={draft.summary}
                    onChange={e => change({ summary: e.target.value })}
                    placeholder="أهم ما خرجت به من اللقاء…"
                  />
                </Field>
                <Field label="التوصيات والخطوات التالية">
                  <Textarea
                    readOnly={!canEdit}
                    disabled={busy}
                    maxLength={20000}
                    rows={3}
                    value={draft.recommendations}
                    onChange={e => change({ recommendations: e.target.value })}
                    placeholder="الخطوات المقترحة لتطوير الفكرة أو اختبارها…"
                  />
                </Field>
                {(canEdit || selected?.taskId) && (
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      (!selected?.taskId && !draft.recommendations.trim())
                    }
                    className="gap-2"
                    onClick={async () => {
                      try {
                        if (selected?.taskId) {
                          await openTask(selected.taskId);
                          return;
                        }
                        const saved = await persist();
                        if (!saved) return;
                        const task = await toTask.mutateAsync({ id: saved.id });
                        setSelected(value =>
                          value ? { ...value, taskId: task.id } : value
                        );
                        await utils.ideaLab.overview.invalidate();
                        await openTask(task.id);
                        toast.success(
                          "تم إنشاء مهمة مرتبطة بالفكرة من توصيات الاستشارة"
                        );
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "تعذر إنشاء المهمة"
                        );
                      }
                    }}
                  >
                    <ListTodo className="size-4" />
                    {selected?.taskId
                      ? "فتح مهمة المتابعة"
                      : "تحويل التوصيات إلى مهمة"}
                  </Button>
                )}
              </div>
            )}
            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#696D75]" aria-live="polite">
                {dirty
                  ? "تغييرات غير محفوظة"
                  : selected
                    ? "الاستشارة محفوظة"
                    : "الأسئلة اليدوية لا تحتاج إلى مفتاح ذكاء اصطناعي"}
              </span>
              <div className="flex gap-2">
                {canEdit && selected && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    className="text-red-700"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="ml-2 size-4" />
                    حذف
                  </Button>
                )}
                {canEdit && (
                  <Button
                    className="gap-2 bg-[#1E3A8A]"
                    disabled={busy || draft.title.trim().length < 2}
                    onClick={async () => {
                      if (await persist()) toast.success("تم حفظ الاستشارة");
                    }}
                  >
                    {save.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    حفظ الاستشارة
                  </Button>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>حذف الاستشارة؟</DialogTitle>
            <DialogDescription>
              ستُحذف أسئلتها وإجاباتها نهائيًا. تبقى مهمة المتابعة إن وُجدت.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!selected) return;
                try {
                  await remove.mutateAsync({ id: selected.id });
                  setSelected(null);
                  setDraft(empty());
                  setDirty(false);
                  setQuestion("");
                  setSuggestions([]);
                  setDeleteOpen(false);
                  await utils.ideaLab.overview.invalidate();
                  toast.success("تم حذف الاستشارة");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "تعذر حذف الاستشارة"
                  );
                }
              }}
            >
              حذف الاستشارة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
