import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  BOARD_TEMPLATE_LABELS,
  boardTemplates,
  type BoardTemplate,
} from "@shared/boardTemplates";
import {
  Check,
  Clipboard,
  Link2,
  Loader2,
  MessageCircle,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const templateTitle = (value: BoardTemplate) =>
  BOARD_TEMPLATE_LABELS[value]?.title ?? BOARD_TEMPLATE_LABELS.work.title;

export default function BoardOnboarding({
  preview = false,
}: {
  preview?: boolean;
}) {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const previewMode = preview
    ? new URLSearchParams(window.location.search).get("onboardingMode")
    : null;
  const canCreate = preview || Boolean(user);
  const [mode, setMode] = useState<"choice" | "create" | "join">(
    previewMode === "create"
      ? "create"
      : previewMode === "join"
        ? "join"
        : "choice"
  );
  const [boardName, setBoardName] = useState("");
  const [template, setTemplate] = useState<BoardTemplate | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [created, setCreated] = useState<{
    name: string;
    joinCode: string;
    inviteToken: string;
    template: BoardTemplate;
  } | null>(null);
  const create = trpc.boards.create.useMutation({
    onSuccess: board => {
      setCreated(board);
      utils.boards.mine.invalidate();
      toast.success("تم إنشاء اللوحة بنجاح");
    },
    onError: error => toast.error(error.message),
  });
  const join = trpc.boards.joinByCode.useMutation({
    onSuccess: () => {
      utils.boards.mine.invalidate();
      toast.success("تم الانضمام إلى اللوحة");
    },
    onError: error => toast.error(error.message),
  });

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`تم نسخ ${label}`);
  };
  const previewBoard =
    previewMode === "shared"
      ? {
          name: "إدارة العمليات",
          joinCode: "8H4K2PZQ",
          inviteToken: "preview-board-share-token-00000000",
          template: "work" as BoardTemplate,
        }
      : null;
  const sharedBoard = created ?? previewBoard;
  const sharedBoardTemplate = sharedBoard?.template ?? template ?? "work";
  const inviteLink = sharedBoard
    ? `${window.location.origin}/join/${sharedBoard.inviteToken}`
    : "";

  if (loading && !preview)
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#F8F6FF]"
      >
        <Loader2 className="size-6 animate-spin text-[#8570D0]" />
      </div>
    );
  if (!user && !preview)
    return (
      <div
        dir="rtl"
        className="fixed inset-0 flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto bg-[#F8F6FF] p-6"
      >
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#F0EAFE] text-[#7A4CCF]">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-5 text-xl font-bold">ابدأ إدارة أعمال فريقك</h1>
          <p className="mt-2 text-sm leading-6 text-[#6D6279]">
            سجّل الدخول أولًا لإنشاء لوحة أو الانضمام إلى لوحة موجودة.
          </p>
          <Button
            onClick={() => startLogin()}
            className="mt-6 h-10 w-full bg-[#7A4CCF] hover:bg-[#684CB2]"
          >
            تسجيل الدخول
          </Button>
        </section>
      </div>
    );
  if (sharedBoard)
    return (
      <div
        dir="rtl"
        className="fixed inset-0 flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto bg-[#F8F6FF] p-5"
      >
        <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Check className="size-6" />
          </span>
          <p className="mt-5 text-xs font-semibold text-[#8570D0]">
            لوحة جديدة
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            تم إنشاء «{sharedBoard.name}»
          </h1>
          <p className="mt-1 text-sm font-medium text-[#4E4860]">
            القالب: {templateTitle(sharedBoardTemplate)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6D6279]">
            شارك أحد الخيارين التاليين مع أعضاء فريقك؛ سيحتاجون إلى تسجيل الدخول
            ثم ستضاف عضويتهم تلقائيًا.
          </p>
          <div className="mt-6 rounded-xl border border-[#ECE5FB] bg-[#F8F6FF] p-4">
            <p className="text-sm font-semibold text-[#22273A]">
              ادعُ أعضاء الفريق الآن
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6D6279]">
              أرسل الرابط عبر واتساب أو انسخه وشاركه بالطريقة المناسبة.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`انضم إلى لوحة «${sharedBoard.name}» عبر هذا الرابط: ${inviteLink}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-[#1E9B5A] px-4 text-sm font-medium text-white transition hover:bg-[#16864B]"
              >
                <MessageCircle className="size-4" />
                دعوة عبر واتساب
              </a>
              <Button
                onClick={() => copy(inviteLink, "رابط المشاركة")}
                variant="outline"
                className="h-10 flex-1 gap-2 border-[#D9CCF3] bg-white text-[#7A4CCF]"
              >
                <Clipboard className="size-4" />
                نسخ الرابط
              </Button>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <CopyField
              label="رمز الانضمام"
              value={sharedBoard.joinCode}
              onCopy={() => copy(sharedBoard.joinCode, "رمز الانضمام")}
            />
            <CopyField
              label="رابط مشاركة اللوحة"
              value={inviteLink}
              onCopy={() => copy(inviteLink, "رابط المشاركة")}
            />
          </div>
          <Button
            onClick={() => window.location.assign("/")}
            className="mt-6 h-10 w-full bg-[#7A4CCF] hover:bg-[#684CB2]"
          >
            الانتقال إلى لوحة العمل
          </Button>
        </section>
      </div>
    );
  const displayName = user?.name ?? "مستخدم وجهة";
  const effectiveMode = mode === "create" && !canCreate ? "join" : mode;
  return (
    <div
      dir="rtl"
      className="fixed inset-0 min-h-screen overflow-x-hidden overflow-y-auto bg-[#F8F6FF] px-5 py-10 md:flex md:items-center md:justify-center"
    >
      <section className="mx-auto w-full max-w-4xl">
        <div className="mb-8 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[#F0EAFE] text-[#7A4CCF]">
            <Users className="size-5" />
          </span>
          <p className="mt-4 text-xs font-semibold text-[#8570D0]">
            مرحبًا {displayName}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
            كيف تود أن تبدأ؟
          </h1>
          <p className="mt-2 text-sm text-[#6D6279]">
            {canCreate
              ? "أنشئ مساحة عمل لفريقك أو انضم لمساحة قائمة."
              : "أدخل رمز اللوحة الذي أرسله لك مدير القسم."}
          </p>
        </div>
        {effectiveMode === "choice" ? (
          <div
            className={
              canCreate ? "grid gap-4 md:grid-cols-2" : "mx-auto max-w-md"
            }
          >
            {canCreate && (
              <ChoiceCard
                icon={<Plus className="size-5" />}
                title="إنشاء لوحة إدارة جديدة"
                description="أنشئ لوحة لفريقك واحصل على رمز ورابط مشاركة للأعضاء."
                action="إنشاء لوحة"
                onClick={() => setMode("create")}
              />
            )}
            <ChoiceCard
              icon={<Link2 className="size-5" />}
              title="الانضمام للوحة إدارة موجودة"
              description="أدخل رمز اللوحة الذي أرسله لك المدير أو استخدم رابط المشاركة."
              action="انضمام للوحة"
              onClick={() => setMode("join")}
            />
          </div>
        ) : (
          <div
            className={`mx-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
              effectiveMode === "create" ? "max-w-2xl" : "max-w-md"
            }`}
          >
            <button
              onClick={() => setMode("choice")}
              className="text-sm text-[#7A4CCF]"
            >
              ← رجوع
            </button>
            {effectiveMode === "create" ? (
              <>
                <h2 className="mt-5 text-lg font-bold">إنشاء لوحة إدارة</h2>
                <p className="mt-1 text-sm text-[#6D6279]">
                  اختر اسمًا واضحًا للفريق أو القسم وحدد نوع القالب.
                </p>
                <label className="mt-6 block text-sm font-medium text-[#5A5570]">
                  اسم اللوحة
                  <Input
                    autoFocus
                    value={boardName}
                    onChange={event => setBoardName(event.target.value)}
                    placeholder="مثال: إدارة العمليات"
                    className="mt-2 h-11 border-slate-200"
                  />
                </label>
                <label className="mt-5 block text-sm font-medium text-[#5A5570]">
                  نوع القالب <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {!template ? (
                    <p className="-mt-1 text-xs text-amber-700">
                      اختر قالبًا واحدًا للوحة قبل المتابعة.
                    </p>
                  ) : null}
                  {boardTemplates.map(item => {
                    const config = BOARD_TEMPLATE_LABELS[item];
                    const isSelected = template === item;
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => setTemplate(item)}
                        aria-pressed={isSelected}
                        className="rounded-xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-sm"
                        style={{
                          borderColor: isSelected ? config.accent : "#E2E8F0",
                          backgroundColor: isSelected
                            ? config.softAccent
                            : "#FFFFFF",
                        }}
                      >
                        <span
                          className="mb-3 flex size-8 items-center justify-center rounded-lg"
                          style={{
                            color: config.accent,
                            backgroundColor: config.softAccent,
                          }}
                        >
                          {isSelected ? (
                            <Check className="size-4" />
                          ) : (
                            <Plus className="size-4" />
                          )}
                        </span>
                        <p className="font-semibold">{config.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#6D6279]">
                          {config.description}
                        </p>
                        <ul className="mt-3 space-y-1.5">
                          {config.highlights.map(highlight => (
                            <li
                              key={highlight}
                              className="flex items-center gap-2 text-[11px] text-[#5A5570]"
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: config.accent }}
                              />
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
                {template ? (
                  <p
                    className="mt-3 rounded-lg px-3 py-2 text-xs leading-5"
                    style={{
                      color: BOARD_TEMPLATE_LABELS[template].accent,
                      backgroundColor:
                        BOARD_TEMPLATE_LABELS[template].softAccent,
                    }}
                  >
                    ستُنشأ اللوحة بأقسامها المناسبة و3 مهام بداية قابلة للتعديل.
                  </p>
                ) : null}
                <Button
                  disabled={
                    create.isPending || boardName.trim().length < 2 || !template
                  }
                  onClick={() => {
                    if (!template) {
                      toast.error("اختر قالبًا قبل إنشاء اللوحة");
                      return;
                    }
                    create.mutate({ name: boardName.trim(), template });
                  }}
                  className="mt-5 h-10 w-full bg-[#7A4CCF] hover:bg-[#684CB2]"
                >
                  {create.isPending ? "جارٍ الإنشاء..." : "إنشاء اللوحة"}
                </Button>
              </>
            ) : (
              <>
                <h2 className="mt-5 text-lg font-bold">الانضمام إلى لوحة</h2>
                <p className="mt-1 text-sm text-[#6D6279]">
                  أدخل رمز اللوحة الذي شاركه مدير الفريق معك.
                </p>
                <label className="mt-6 block text-sm font-medium text-[#5A5570]">
                  رمز اللوحة
                  <Input
                    autoFocus
                    value={joinCode}
                    onChange={event =>
                      setJoinCode(event.target.value.toUpperCase())
                    }
                    placeholder="مثال: 8H4K2PZQ"
                    className="mt-2 h-11 border-slate-200 font-mono tracking-[.15em]"
                  />
                </label>
                <Button
                  disabled={join.isPending || joinCode.trim().length < 6}
                  onClick={() => join.mutate({ joinCode: joinCode.trim() })}
                  className="mt-5 h-10 w-full bg-[#7A4CCF] hover:bg-[#684CB2]"
                >
                  {join.isPending ? "جارٍ الانضمام..." : "انضمام للوحة"}
                </Button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-6 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-[#D9CCF3] hover:shadow-md"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-[#F0EAFE] text-[#7A4CCF]">
        {icon}
      </span>
      <h2 className="mt-6 text-lg font-bold">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-[#6D6279]">
        {description}
      </p>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#7A4CCF]">
        {action} <span>←</span>
      </span>
    </button>
  );
}
function CopyField({
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
      <p className="mb-2 text-sm font-medium text-[#5A5570]">{label}</p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className="h-10 min-w-0 border-slate-200 bg-[#FFFDFF] text-xs"
        />
        <Button
          onClick={onCopy}
          variant="outline"
          className="h-10 shrink-0 border-slate-200 px-3 text-[#7A4CCF]"
        >
          <Clipboard className="size-4" />
        </Button>
      </div>
    </div>
  );
}
