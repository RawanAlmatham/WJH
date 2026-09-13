import { BrandJourney, BrandLogo } from "@/components/Brand";
import { boardTemplates, BOARD_TEMPLATE_LABELS } from "@shared/boardTemplates";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListChecks,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const features = [
  {
    icon: <Target className="size-5" />,
    title: "خطة تتحول إلى عمل",
    description:
      "اربط الأهداف السنوية بالمشاريع والمهام، لتبقى الأولويات واضحة من البداية حتى الإنجاز.",
  },
  {
    icon: <ListChecks className="size-5" />,
    title: "متابعة بلا تعقيد",
    description:
      "شاهد حالة المهام والمواعيد والمسؤوليات في مكان واحد، مع ترتيب تلقائي لما يحتاج انتباهك.",
  },
  {
    icon: <Users className="size-5" />,
    title: "فريق على نفس الصورة",
    description:
      "وزّع العمل، تابع أحمال الفريق، وشارك المستجدات من لوحة واضحة للجميع.",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "تقارير تساعد على القرار",
    description:
      "حوّل تقدّم العمل إلى مؤشرات وتقارير موجزة تساعدك على التدخل في الوقت المناسب.",
  },
];

const steps = [
  {
    number: "01",
    title: "اختر وجهتك",
    description: "أنشئ لوحة واختر القالب الذي يناسب عملك وطموحك.",
  },
  {
    number: "02",
    title: "رتّب خطواتك",
    description: "أضف مهامك وأولوياتك، وادعُ فريقك إذا كانت وجهتكم مشتركة.",
  },
  {
    number: "03",
    title: "تابع الإنجاز مع وجهة",
    description:
      "راقب الأولويات والتقدم والمواعيد من لوحة واحدة محدثة باستمرار.",
  },
];

export default function Landing() {
  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[#F5F2EE] text-[#1F2328]"
    >
      <header className="app-topbar sticky top-0 z-30 border-b border-slate-200/80 bg-[#F5F2EE]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-10">
          <a
            href="#top"
            className="flex items-center gap-3"
            aria-label="وجهة - الصفحة الرئيسية"
          >
            <BrandLogo tagline />
          </a>

          <nav
            className="hidden items-center gap-8 text-sm text-slate-600 md:flex"
            aria-label="التنقل الرئيسي"
          >
            <a href="#features" className="transition hover:text-[#1E3A8A]">
              المزايا
            </a>
            <a href="#how-it-works" className="transition hover:text-[#1E3A8A]">
              كيف تعمل؟
            </a>
            <a href="#about" className="transition hover:text-[#1E3A8A]">
              عن وجهة
            </a>
          </nav>

          <Button
            onClick={startLogin}
            variant="outline"
            className="h-10 shrink-0 border-[#CCD4E6] bg-white px-3 text-[#1E3A8A] hover:bg-[#E9EDF7] sm:px-4"
          >
            تسجيل الدخول
          </Button>
        </div>
      </header>

      <section id="top" className="relative">
        <div className="absolute inset-x-0 top-0 -z-0 h-[34rem] brand-hero-wash" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:gap-14 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1fr] lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#CCD4E6] bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#1E3A8A] shadow-sm">
              <CheckCircle2 className="size-4" />
              لكل طموح، وجهة.
            </span>
            <h1 className="mt-7 text-[2.15rem] font-bold leading-[1.3] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              طموحك يستحق
              <span className="block text-[#1E3A8A]">وجهة واضحة.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#62635F] sm:text-lg">
              من فكرة تنتظر البداية إلى إنجاز تفتخر فيه. رتّب مهامك، اجمع فريقك،
              واختر مساحة تناسب طموحك؛ للعمل، لشركتك، لمتجرك أو ليومك.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={startLogin}
                className="h-12 gap-2 bg-[#1E3A8A] px-7 text-base hover:bg-[#172E6E]"
              >
                ابدأ وجهتك
                <ArrowLeft className="size-4" />
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center rounded-md border border-slate-200 bg-white px-7 text-sm font-semibold text-[#4E534E] transition hover:border-[#CCD4E6] hover:bg-[#F5F2EE]"
              >
                تعرّف على طريقة العمل
              </a>
              <PwaInstallButton className="h-12 px-6" />
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="size-4 text-[#7A2E5C]" />
              التسجيل والدخول عبر حساب Google متاحان الآن.
            </p>
          </div>

          <div className="brand-hero-visual">
            <BrandJourney />
            <div className="brand-arrival-card" dir="rtl">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FFF3CC] text-[#896400]">
                <Check className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold">كل خطوة تقرّبك.</p>
                <p className="mt-1 text-xs text-[#62635F]">
                  فكرة واضحة. خطوات مرتبة. إنجاز ملموس.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/75">
        <div className="mx-auto grid max-w-7xl gap-px px-5 py-5 sm:grid-cols-3 sm:px-8 lg:px-10">
          {[
            ["رؤية واحدة", "للخطة والعمل اليومي"],
            ["أولوية أوضح", "لما يحتاج انتباهك الآن"],
            ["قرار أسرع", "ببيانات محدثة ومختصرة"],
          ].map(([title, text], index) => (
            <div
              key={title}
              className={`px-5 py-3 ${index !== 0 ? "sm:border-r sm:border-slate-200" : ""}`}
            >
              <p className="text-sm font-bold text-[#1F2328]">{title}</p>
              <p className="mt-1 text-xs text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="templates"
        className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 lg:px-10"
      >
        <SectionIntro
          eyebrow="أربع بدايات. واحتمالات كثيرة."
          title="مساحة تشبه طريقة عملك"
          description="اختَر قالبك عند إنشاء اللوحة، لتبدأ بتقسيمات ومهام أولية تناسب وجهتك."
        />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {boardTemplates.map((template, index) => {
            const config = BOARD_TEMPLATE_LABELS[template];
            return (
              <button
                key={template}
                onClick={startLogin}
                className="brand-template-card group text-right"
                style={{
                  borderTopColor: ["#1E3A8A", "#7A2E5C", "#A6B69A", "#F6B801"][
                    index
                  ],
                }}
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: config.accent }}
                >
                  0{index + 1}
                </span>
                <h3 className="mt-5 text-lg font-bold">
                  {config.title.replace("قالب ", "")}
                </h3>
                <p className="mt-2 min-h-14 text-xs leading-6 text-[#62635F]">
                  {config.description}
                </p>
                <span
                  className="mt-5 inline-flex items-center gap-2 text-xs font-semibold"
                  style={{ color: config.accent }}
                >
                  ابدأ هنا{" "}
                  <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
      >
        <SectionIntro
          eyebrow="مساحة عمل متكاملة"
          title="كل ما يحتاجه الفريق للعمل بوضوح"
          description="صُممت وجهة لتجمع الصورة الكبيرة والتفاصيل اليومية، بدون أن تصبح إدارة العمل عبئًا إضافيًا."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(34,39,58,.05)] transition hover:-translate-y-1 hover:border-[#CCD4E6] hover:shadow-[0_18px_45px_rgba(34,39,58,.10)]"
            >
              <span
                className="flex size-11 items-center justify-center rounded-xl"
                style={{
                  background: ["#E9EDF7", "#F5EAF0", "#E9EDE4", "#FFF3CC"][
                    index
                  ],
                  color: ["#1E3A8A", "#7A2E5C", "#45613F", "#896400"][index],
                }}
              >
                {feature.icon}
              </span>
              <h3 className="mt-6 text-lg font-bold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#62635F]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-2 lg:px-10">
        <SectionIntro
          eyebrow="خطواتك، في مكانها."
          title="الصورة الكبيرة، والتفاصيل التي تصنعها."
          description="مهام ومشاريع وأولويات في لوحة واحدة، لتعرف أين وصلت وما خطوتك التالية. هذه معاينة توضيحية لطريقة عرض العمل."
        />
        <DashboardPreview />
      </section>

      <section id="how-it-works" className="bg-[#1F2328] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <SectionIntro
            dark
            eyebrow="بداية بسيطة"
            title="من هنا تبدأ وجهتك"
            description="ابدأ بحساب Google، وأنشئ لوحتك الخاصة أو انضم إلى لوحة بدعوة من فريقك."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.number}
                className="relative rounded-2xl border border-white/10 bg-white/[.055] p-6"
              >
                <span className="text-sm font-semibold text-[#F6B801]">
                  {step.number}
                </span>
                <h3 className="mt-8 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {step.description}
                </p>
                {index < steps.length - 1 && (
                  <ArrowLeft className="absolute -left-3 top-10 hidden size-5 text-[#F6B801] md:block" />
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="about"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
      >
        <div className="grid items-center gap-12 rounded-3xl border border-[#E4E1DA] bg-[#E9EDE4] p-7 sm:p-10 lg:grid-cols-[1fr_.8fr] lg:p-14">
          <div>
            <p className="text-xs font-semibold text-[#1E3A8A]">لماذا وجهة؟</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight">
              لأن الإنجاز لا يكتمل من دون وجهة واضحة.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-[#62635F] sm:text-base">
              تجمع المنصة الأهداف والمشاريع والمهام والمواعيد في سياق واحد؛
              ليعرف كل عضو ما عليه، ويعرف المدير أين يتقدم العمل وأين يحتاج إلى
              تدخل.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              "لوحات مستقلة للفرق والإدارات",
              "تقدّم مشاريع محسوب تلقائيًا",
              "أولويات مرتبة حسب الحاجة",
              "مواعيد وتقارير في صورة واحدة",
            ].map(item => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-white bg-white/75 px-4 py-3 text-sm font-medium text-[#444943]"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <Check className="size-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-3xl bg-[#1E3A8A] px-6 py-12 text-center text-white shadow-[0_22px_60px_rgba(30,58,138,.24)] sm:px-10">
          <h2 className="text-2xl font-bold sm:text-3xl">
            وجهتك القادمة تبدأ بخطوة.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-blue-100">
            أنشئ لوحتك، اختر قالبك، وابدأ ترتيب ما تريد الوصول إليه.
          </p>
          <Button
            onClick={startLogin}
            className="mt-7 h-11 bg-white px-7 text-[#1E3A8A] hover:bg-slate-50"
          >
            تسجيل الدخول
          </Button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:px-8 lg:px-10">
          <BrandLogo tagline />
          <div className="flex flex-wrap items-center justify-center gap-4">
            <p>مساحة عربية تجمع طموحك وخطواتك.</p>
            <a
              className="font-medium text-[#1E3A8A] hover:underline"
              href="/privacy"
            >
              سياسة الخصوصية
            </a>
            <a
              className="font-medium text-[#1E3A8A] hover:underline"
              href="/support"
            >
              الدعم
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function DashboardPreview() {
  const tasks = [
    { title: "اعتماد خطة المشروع", meta: "اليوم", color: "bg-rose-500" },
    { title: "مراجعة المخرجات", meta: "غدًا", color: "bg-amber-400" },
    { title: "تحديث تقرير التقدم", meta: "هذا الأسبوع", color: "bg-[#7A2E5C]" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl lg:mx-0">
      <div className="absolute -inset-8 -z-10 rounded-full bg-[#7A2E5C]/10 blur-3xl" />
      <div className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_28px_80px_rgba(34,39,58,.14)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#7A2E5C]" />
            <p className="text-xs font-semibold">نظرة هذا الأسبوع</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
            على المسار
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_.86fr]">
          <div className="rounded-2xl bg-[#F5F2EE] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">إنجاز المشاريع</p>
              <FolderKanban className="size-4 text-[#7A2E5C]" />
            </div>
            <div className="mt-8 flex items-end gap-2">
              {[42, 64, 53, 82, 70, 92].map((height, index) => (
                <span
                  key={index}
                  className={`flex-1 rounded-t-md ${index === 5 ? "bg-[#1E3A8A]" : "bg-[#A6B69A]"}`}
                  style={{ height }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
              <span>بداية الفترة</span>
              <span>اليوم</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">التقدم العام</p>
              <span className="text-sm font-bold text-[#1E3A8A]">76%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[76%] rounded-full bg-[#7A2E5C]" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Stat
                icon={<CheckCircle2 className="size-3.5" />}
                value="18"
                label="مكتملة"
              />
              <Stat
                icon={<Clock3 className="size-3.5" />}
                value="6"
                label="جارية"
              />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold">ما يحتاج انتباهك</p>
            <CalendarDays className="size-4 text-slate-400" />
          </div>
          <div className="space-y-2">
            {tasks.map(task => (
              <div
                key={task.title}
                className="flex items-center gap-3 rounded-xl bg-[#FAFBFD] px-3.5 py-3"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${task.color}`}
                />
                <p className="min-w-0 flex-1 truncate text-xs font-medium">
                  {task.title}
                </p>
                <span className="text-[10px] text-slate-400">{task.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-[#F5F2EE] p-3">
      <span className="text-[#7A2E5C]">{icon}</span>
      <p className="mt-2 text-lg font-bold">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p
        className={`text-xs font-semibold ${dark ? "text-[#F6B801]" : "text-[#1E3A8A]"}`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-[#1F2328]"}`}
      >
        {title}
      </h2>
      <p
        className={`mt-4 text-sm leading-7 sm:text-base ${dark ? "text-slate-300" : "text-[#62635F]"}`}
      >
        {description}
      </p>
    </div>
  );
}
