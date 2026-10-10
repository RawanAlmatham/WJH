import { BrandJourney, BrandLogo } from "@/components/Brand";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Layers3, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BOARD_TEMPLATE_LABELS, boardTemplates } from "@shared/boardTemplates";

export default function BoardOnboarding({
  preview: _preview = false,
}: {
  preview?: boolean;
}) {
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [template, setTemplate] =
    useState<(typeof boardTemplates)[number]>("idea_lab");
  const [starterTasks, setStarterTasks] = useState(false);
  const config = BOARD_TEMPLATE_LABELS[template];
  const createBoard = trpc.boards.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء اللوحة");
      window.location.assign("/");
    },
    onError: issue => toast.error(issue.message),
  });

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#F5F2EE]"
      >
        <Loader2 className="size-6 animate-spin text-[#1E3A8A]" />
      </div>
    );
  }

  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[#F5F2EE] px-5 py-8 text-[#1F2328]"
    >
      <div className="brand-hero-wash absolute inset-x-0 top-0 h-[32rem]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <BrandLogo tagline />
          <a
            href="/welcome"
            className="text-sm font-semibold text-[#1E3A8A] transition hover:opacity-75"
          >
            عن وجهة
          </a>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1fr_.9fr]">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#CCD4E6] bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#1E3A8A] shadow-sm">
              <Sparkles className="size-4 text-[#896400]" />
              قوالب وجهة
            </span>
            {user?.name && (
              <p className="mt-7 text-sm font-semibold text-[#7A2E5C]">
                أهلًا {user.name}
              </p>
            )}
            <h1 className="mt-3 text-4xl font-bold leading-[1.25] tracking-tight sm:text-5xl">
              اختر مساحة تناسب
              <span className="block text-[#1E3A8A]">طموحك وطريقة عملك.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#62635F] sm:text-lg">
              ابدأ بقالب جاهز للفرد أو الفريق، وعدّل تنظيمه ليناسب مشروعك.
            </p>

            <div className="mt-6 grid gap-3">
              {boardTemplates.map(value => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={template === value}
                  onClick={() => setTemplate(value)}
                  className={`rounded-2xl border-2 bg-white p-5 text-right ${template === value ? "border-[#1E3A8A]" : "border-[#DEDFDC]"}`}
                >
                  <h2 className="font-bold">
                    {BOARD_TEMPLATE_LABELS[value].title}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[#62635F]">
                    {BOARD_TEMPLATE_LABELS[value].description}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-4 rounded-2xl border border-white bg-white/75 p-5 shadow-[0_14px_40px_rgba(34,39,58,.07)] backdrop-blur">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E9EDF7] text-[#1E3A8A]">
                <Layers3 className="size-5" />
              </span>
              <div>
                <h2 className="font-bold">{config.title}</h2>
                <p className="mt-1 text-sm leading-7 text-[#62635F]">
                  {config.highlights.join(" · ")}
                </p>
              </div>
            </div>

            {user && (
              <form
                className="mt-7 max-w-xl rounded-2xl border border-[#D9DEE9] bg-white p-5 shadow-sm"
                onSubmit={event => {
                  event.preventDefault();
                  const value = name.trim();
                  if (value.length < 2) {
                    toast.error("اكتب اسمًا للوحة من حرفين على الأقل");
                    return;
                  }
                  createBoard.mutate({
                    name: value,
                    template,
                    starterTasks:
                      template === "commerce_import" && starterTasks,
                  });
                }}
              >
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3CC] text-[#896400]">
                    <Lightbulb className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-bold">أنشئ لوحتك</h2>
                    <p className="mt-1 text-xs leading-6 text-[#62635F]">
                      ستكون مدير المساحة ويمكنك دعوة الفريق لاحقًا.
                    </p>
                  </div>
                </div>
                <label className="text-xs font-semibold text-[#4E534E]">
                  اسم اللوحة أو المشروع
                  <Input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder={
                      template === "commerce_import"
                        ? "مثال: مشروع أجهزة الضغط الهوائي"
                        : "مثال: فريق الفرص الجديدة"
                    }
                    className="mt-2 h-11 bg-[#FDFCFA]"
                    maxLength={180}
                  />
                </label>
                {template === "commerce_import" && (
                  <fieldset className="mt-4 text-sm">
                    <legend className="font-semibold">بداية المشروع</legend>
                    <label className="mt-2 flex items-center gap-2">
                      <input
                        type="radio"
                        name="starter"
                        checked={!starterTasks}
                        onChange={() => setStarterTasks(false)}
                      />
                      أقسام جاهزة بدون مهام
                    </label>
                    <label className="mt-2 flex items-center gap-2">
                      <input
                        type="radio"
                        name="starter"
                        checked={starterTasks}
                        onChange={() => setStarterTasks(true)}
                      />
                      أضف مهام مقترحة
                    </label>
                    <p className="mt-2 text-xs text-[#62635F]">
                      يمكن تعديل الأقسام. المهام المقترحة تُسند لك ويمكن تعديلها
                      أو أرشفتها.
                    </p>
                  </fieldset>
                )}
                <Button
                  type="submit"
                  disabled={createBoard.isPending}
                  className="mt-4 h-11 w-full gap-2 bg-[#1E3A8A] hover:bg-[#172E6E]"
                >
                  {createBoard.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  إنشاء {config.title}
                </Button>
              </form>
            )}

            {!user && (
              <Button
                onClick={() => startLogin()}
                className="mt-8 h-12 gap-2 bg-[#1E3A8A] px-7 text-base hover:bg-[#172E6E]"
              >
                تسجيل الدخول
                <ArrowLeft className="size-4" />
              </Button>
            )}
          </div>

          <div className="hidden lg:block" aria-hidden="true">
            <BrandJourney />
          </div>
        </section>
      </div>
    </main>
  );
}
