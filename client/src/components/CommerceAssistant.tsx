import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Mic,
  Send,
  Settings,
  Square,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MAX_AUDIO_BYTES, type AssistantAction } from "@shared/assistant";
import { commerceStatusLabels } from "@shared/commerce";

type Props = {
  boardId: number;
  boardName: string;
  canEdit: boolean;
  sections: { id: number; name: string; archived: boolean }[];
  members: { userId: number | null; name: string }[];
  onSaved: () => Promise<void>;
};
const selectClass = "w-full rounded-lg border bg-white p-2 text-sm";
type Message = { role: "user" | "assistant"; content: string };

export default function CommerceAssistant({
  boardId,
  boardName,
  canEdit,
  sections,
  members,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(false);
  const [key, setKey] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState<{
    id: string;
    actions: AssistantAction[];
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [startingRecording, setStartingRecording] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const discard = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const mounted = useRef(true);
  const utils = trpc.useUtils();
  const settings = trpc.assistant.settings.useQuery(undefined, {
    enabled: open,
  });
  const onError = (error: { message: string }) => toast.error(error.message);
  const saveKey = trpc.assistant.saveSettings.useMutation({
    onSuccess: async () => {
      setKey("");
      setConfig(false);
      await utils.assistant.settings.invalidate();
      toast.success("تم حفظ مفتاح Groq. يُختبر الاتصال عند أول طلب.");
    },
    onError,
  });
  const removeKey = trpc.assistant.removeSettings.useMutation({
    onSuccess: async () => {
      setKey("");
      await utils.assistant.settings.invalidate();
      toast.success("تم فصل Groq عن حسابك");
    },
    onError,
  });
  const chat = trpc.assistant.chat.useMutation({ onError });
  const transcribe = trpc.assistant.transcribe.useMutation({ onError });
  const apply = trpc.assistant.acceptDraft.useMutation({
    onSuccess: async () => {
      setDraft(null);
      setMessages(m => [
        ...m,
        { role: "assistant", content: "تم حفظ المهام في اللوحة." },
      ]);
      await onSaved();
      toast.success("تم حفظ المهام");
    },
    onError,
  });
  const busy =
    processingAudio ||
    chat.isPending ||
    transcribe.isPending ||
    apply.isPending;
  const stop = (cancel: boolean) => {
    discard.current = cancel;
    setProcessingAudio(!cancel && recorder.current?.state === "recording");
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setRecording(false);
  };
  useEffect(() => {
    if (!open) {
      stop(true);
      setKey("");
    }
  }, [open]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      discard.current = true;
      if (timer.current) clearInterval(timer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state === "recording") recorder.current.stop();
      }
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  async function startRecording() {
    if (startingRecording) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error("التسجيل غير مدعوم في هذا المتصفح. يمكنك الكتابة في الشات.");
      return;
    }
    try {
      setStartingRecording(true);
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || !openRef.current) {
        media.getTracks().forEach(t => t.stop());
        return;
      }
      stream.current = media;
      discard.current = false;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) {
        media.getTracks().forEach(t => t.stop());
        toast.error(
          "صيغة تسجيل المتصفح غير مدعومة. استخدم الكتابة أو متصفحًا أحدث."
        );
        return;
      }
      const capture = new MediaRecorder(media, { mimeType: mime });
      recorder.current = capture;
      const chunks: Blob[] = [];
      let bytes = 0;
      capture.ondataavailable = event => {
        if (event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes > MAX_AUDIO_BYTES) {
            stop(true);
            toast.error("التسجيل طويل جدًا. جرّب تسجيلًا أقصر.");
          }
        }
      };
      capture.onerror = () => {
        stop(true);
        toast.error("تعذر تسجيل الصوت. جرّب مجددًا.");
      };
      capture.onstop = async () => {
        if (discard.current || !mounted.current || !openRef.current) return;
        const blob = new Blob(chunks, { type: mime });
        if (blob.size > MAX_AUDIO_BYTES || blob.size < 16) {
          setProcessingAudio(false);
          toast.error("التسجيل فارغ أو كبير جدًا");
          return;
        }
        try {
          const audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          if (!mounted.current || !openRef.current) return;
          const result = await transcribe.mutateAsync({
            boardId,
            audio,
            format: mime.includes("mp4")
              ? "mp4"
              : mime.includes("ogg")
                ? "ogg"
                : "webm",
          });
          if (mounted.current && openRef.current) {
            setText(previous =>
              previous ? `${previous}\n${result.text}` : result.text
            );
            toast.success("راجع النص ثم أرسله للمساعد");
          }
        } catch {
          /* The mutation displays a safe error and keeps typed text. */
        } finally {
          if (mounted.current) setProcessingAudio(false);
        }
      };
      setSeconds(0);
      setRecording(true);
      capture.start(1000);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++;
        setSeconds(elapsed);
        if (elapsed >= 120) stop(false);
      }, 1000);
    } catch {
      stream.current?.getTracks().forEach(t => t.stop());
      toast.error(
        "تعذر الوصول للميكروفون. اسمح بالتسجيل من إعدادات المتصفح أو استخدم الكتابة."
      );
    } finally {
      if (mounted.current) setStartingRecording(false);
    }
  }
  async function send() {
    const message = text.trim();
    if (!message || busy || recording || startingRecording) return;
    try {
      const result = await chat.mutateAsync({
        boardId,
        message,
        history: messages.slice(-8),
      });
      setMessages(m => [
        ...m.slice(-6),
        { role: "user", content: message },
        { role: "assistant", content: result.reply },
      ]);
      setText("");
      setDraft(
        result.draftId ? { id: result.draftId, actions: result.actions } : null
      );
    } catch {
      /* Keep the user's message for retry. */
    }
  }
  function edit(index: number, fields: Partial<AssistantAction>) {
    setDraft(d =>
      d
        ? {
            ...d,
            actions: d.actions.map((a, i) =>
              i === index ? { ...a, ...fields } : a
            ),
          }
        : null
    );
  }
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="gap-2 border-[#7A2E5C]/20 text-[#7A2E5C]"
      >
        <Sparkles className="size-4" />
        مساعد وجهة
      </Button>
      <Dialog
        open={open}
        onOpenChange={value => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent
          dir="rtl"
          className="flex max-h-[92dvh] w-[calc(100%-1rem)] flex-col overflow-hidden bg-[#F5F2EE] p-4 sm:max-w-2xl sm:p-6"
        >
          <DialogHeader className="shrink-0 pr-6 text-right">
            <DialogTitle className="flex items-center gap-2 text-[#14285F]">
              <Sparkles className="size-5" />
              مساعد وجهة
            </DialogTitle>
            <DialogDescription>
              {boardName} · اكتب أو سجّل، وراجع الاقتراح قبل الحفظ.
            </DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b pb-3 text-xs">
            <span>
              {settings.data?.configured
                ? "Groq مرتبط بحسابك"
                : "اربط Groq للبدء"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfig(!config)}
              disabled={busy || recording}
            >
              <Settings className="ml-1 size-4" />
              إعدادات Groq
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
            {(config || settings.data?.configured === false) && (
              <form
                className="space-y-3 rounded-xl border bg-white p-4"
                onSubmit={e => {
                  e.preventDefault();
                  saveKey.mutate({ apiKey: key });
                }}
              >
                <h3 className="font-bold">ربط Groq بحسابك</h3>
                <p className="text-xs leading-6 text-slate-600">
                  يحفظ المفتاح مشفّرًا. عند إرسال طلب، يُرسل نصه وتفاصيل مهام
                  اللوحة اللازمة إلى Groq. التسجيل يُرسل للتفريغ ولا يُحفظ في
                  وجهة. الاستخدام على حساب Groq الخاص بك.
                </p>
                {settings.data?.configured && (
                  <p className="text-xs">
                    مفتاح محفوظ ينتهي بـ{" "}
                    <b dir="ltr">{settings.data.lastFour}</b>
                  </p>
                )}
                <label className="block text-sm">
                  مفتاح Groq API
                  <Input
                    type="password"
                    autoComplete="off"
                    dir="ltr"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder="gsk_…"
                    maxLength={254}
                    className="mt-2"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={!key.trim() || saveKey.isPending}>
                    {saveKey.isPending ? "جارٍ الحفظ…" : "حفظ المفتاح"}
                  </Button>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#1E3A8A] underline"
                  >
                    إنشاء مفتاح Groq
                  </a>
                  {settings.data?.configured && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={removeKey.isPending}
                      onClick={() => removeKey.mutate()}
                    >
                      فصل الربط
                    </Button>
                  )}
                </div>
              </form>
            )}
            {!messages.length && !draft && (
              <div className="rounded-xl bg-white p-4 text-sm leading-7">
                <p className="font-bold text-[#14285F]">كيف أساعدك؟</p>
                <p>
                  «أضيفي مهمة مقارنة عروض أدوات الطبخ في قسم الموردين، موعدها
                  الخميس»
                </p>
                <p>أو: «وش مهامي اليوم؟» و«لخّصي تقدم المشروع».</p>
                <p className="mt-2 text-xs text-slate-500">
                  أدعم حاليًا مهام قالب التجارة. أي إضافة أو تعديل ينتظر
                  اعتمادك.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap rounded-xl p-3 text-sm leading-7 ${m.role === "user" ? "mr-6 bg-[#14285F] text-white" : "ml-6 border bg-white"}`}
              >
                <p className="mb-1 text-xs opacity-60">
                  {m.role === "user" ? "أنت" : "مساعد وجهة"}
                </p>
                {m.content}
              </div>
            ))}
            {draft && (
              <div className="space-y-3 rounded-xl border border-[#7A2E5C]/20 bg-white p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#7A2E5C]">
                    راجع المهام المقترحة
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="إلغاء الاقتراح"
                    disabled={busy}
                    onClick={() => setDraft(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  لم تُحفظ بعد. يمكنك تعديل التفاصيل قبل الاعتماد. صلاحية
                  الاقتراح 30 دقيقة.
                </p>
                {draft.actions.map((a, i) => (
                  <fieldset
                    key={i}
                    disabled={busy}
                    className="space-y-3 rounded-lg border p-3"
                  >
                    <legend className="px-1 text-xs font-bold">
                      {a.taskId ? "تعديل مهمة" : "مهمة جديدة"} {i + 1}
                    </legend>
                    <label className="block text-xs">
                      عنوان المهمة
                      <Input
                        className="mt-1"
                        value={a.title}
                        maxLength={280}
                        onChange={e => edit(i, { title: e.target.value })}
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs">
                        القسم
                        <select
                          className={selectClass}
                          value={a.sectionId}
                          onChange={e =>
                            edit(i, { sectionId: Number(e.target.value) })
                          }
                        >
                          {sections
                            .filter(s => !s.archived)
                            .map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="text-xs">
                        المسؤول
                        <select
                          className={selectClass}
                          value={a.assigneeUserId ?? ""}
                          onChange={e =>
                            edit(i, {
                              assigneeUserId: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        >
                          <option value="">غير مسندة</option>
                          {members
                            .filter(m => m.userId)
                            .map(m => (
                              <option key={m.userId} value={m.userId!}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="text-xs">
                        الموعد
                        <Input
                          type="date"
                          value={a.dueDate ?? ""}
                          onChange={e =>
                            edit(i, { dueDate: e.target.value || null })
                          }
                        />
                      </label>
                      <label className="text-xs">
                        الحالة
                        <select
                          className={selectClass}
                          value={a.status}
                          onChange={e =>
                            edit(i, {
                              status: e.target
                                .value as AssistantAction["status"],
                            })
                          }
                        >
                          {Object.entries(commerceStatusLabels).map(
                            ([value, name]) => (
                              <option key={value} value={value}>
                                {name}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                    <label className="block text-xs">
                      التفاصيل
                      <Textarea
                        className="mt-1"
                        rows={2}
                        value={a.description}
                        maxLength={20000}
                        onChange={e => edit(i, { description: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs">
                      الأولوية
                      <select
                        className={selectClass}
                        value={a.priority}
                        onChange={e =>
                          edit(i, {
                            priority: e.target
                              .value as AssistantAction["priority"],
                          })
                        }
                      >
                        <option value="normal">عادية</option>
                        <option value="urgent">عاجلة</option>
                      </select>
                    </label>
                    {(a.status === "blocked" || a.waitingReason) && (
                      <label className="block text-xs">
                        سبب الانتظار
                        <Input
                          value={a.waitingReason}
                          maxLength={1000}
                          onChange={e =>
                            edit(i, { waitingReason: e.target.value })
                          }
                        />
                      </label>
                    )}
                    {a.checklist.map((c, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`إنجاز الخطوة ${j + 1}`}
                          checked={c.done}
                          onChange={e =>
                            edit(i, {
                              checklist: a.checklist.map((item, index) =>
                                index === j
                                  ? { ...item, done: e.target.checked }
                                  : item
                              ),
                            })
                          }
                        />
                        <Input
                          aria-label={`الخطوة ${j + 1}`}
                          value={c.text}
                          maxLength={500}
                          onChange={e =>
                            edit(i, {
                              checklist: a.checklist.map((item, index) =>
                                index === j
                                  ? { ...item, text: e.target.value }
                                  : item
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </fieldset>
                ))}
                {canEdit && (
                  <Button
                    className="w-full bg-[#1E3A8A]"
                    disabled={busy || draft.actions.some(a => !a.title.trim())}
                    onClick={() =>
                      apply.mutate({
                        boardId,
                        draftId: draft.id,
                        actions: draft.actions,
                      })
                    }
                  >
                    {apply.isPending
                      ? "جارٍ الحفظ…"
                      : `اعتماد وحفظ ${draft.actions.length === 1 ? "المهمة" : "المهام"}`}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="shrink-0 space-y-2 border-t pt-3">
            {recording && (
              <div
                role="status"
                className="flex items-center justify-between text-sm text-[#7A2E5C]"
              >
                <span>جارٍ التسجيل · {seconds} ثانية (دقيقتان كحد أقصى)</span>
                <Button size="sm" variant="ghost" onClick={() => stop(true)}>
                  إلغاء
                </Button>
              </div>
            )}
            {(chat.isPending || processingAudio || transcribe.isPending) && (
              <p role="status" className="flex items-center gap-2 text-xs">
                <Loader2 className="size-4 animate-spin" />
                {processingAudio || transcribe.isPending
                  ? "جارٍ تحويل الصوت إلى نص…"
                  : "جارٍ تجهيز الرد…"}
              </p>
            )}
            <Textarea
              aria-label="رسالتك لمساعد وجهة"
              placeholder="اكتب طلبك أو سجّله…"
              value={text}
              maxLength={6000}
              rows={2}
              disabled={busy || recording}
              onChange={e => setText(e.target.value)}
              className="bg-white"
            />
            <div className="flex items-center gap-2">
              <Button
                className="flex-1 bg-[#14285F]"
                disabled={
                  busy ||
                  recording ||
                  startingRecording ||
                  !text.trim() ||
                  !settings.data?.configured
                }
                onClick={send}
              >
                <Send className="ml-2 size-4" />
                إرسال
              </Button>
              <Button
                variant="outline"
                disabled={
                  busy || startingRecording || !settings.data?.configured
                }
                onClick={() => (recording ? stop(false) : startRecording())}
              >
                {recording ? (
                  <Square className="ml-2 size-4" />
                ) : (
                  <Mic className="ml-2 size-4" />
                )}
                {recording ? "إيقاف وتفريغ" : "تسجيل"}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              التسجيل يُفرّغ أولًا لتراجعه، ثم ترسله. الاقتراحات لا تنفّذ إلا
              باعتمادك.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
