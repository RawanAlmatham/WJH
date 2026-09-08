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
  TrendingUp,
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
    title: "أنشئ مساحة العمل",
    description: "لوحة مستقلة لإدارة أو فريق أو مشروع، بحسب طريقة عملك.",
  },
  {
    number: "02",
    title: "ادعُ فريقك",
    description: "أرسل رابط الدعوة وحدد دور العضو ببساطة وبدون إعدادات معقدة.",
  },
  {
    number: "03",
    title: "تابع الإنجاز والأثر",
    description:
      "راقب الأولويات والتقدم والمواعيد من لوحة واحدة محدثة باستمرار.",
  },
];

export default function Landing() {
  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[#F7F9FC] text-[#26364A]"
    >
      <header className="app-topbar sticky top-0 z-30 border-b border-slate-200/80 bg-[#F7F9FC]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-10">
          <a
            href="#top"
            className="flex items-center gap-3"
            aria-label="أثر - الصفحة الرئيسية"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#52769F] text-white shadow-sm">
              <TrendingUp className="size-5" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none">أثر</span>
              <span className="mt-1 block text-[10px] text-slate-500">
                إدارة العمل بوضوح
              </span>
            </span>
          </a>

          <nav
            className="hidden items-center gap-8 text-sm text-slate-600 md:flex"
            aria-label="التنقل الرئيسي"
          >
            <a href="#features" className="transition hover:text-[#52769F]">
              المزايا
            </a>
            <a href="#how-it-works" className="transition hover:text-[#52769F]">
              كيف تعمل؟
            </a>
            <a href="#about" className="transition hover:text-[#52769F]">
              عن أثر
            </a>
          </nav>

          <Button
            onClick={startLogin}
            variant="outline"
            className="h-10 shrink-0 border-[#BFD3E7] bg-white px-3 text-[#45698F] hover:bg-[#EDF4FA] sm:px-4"
          >
            تسجيل الدخول
          </Button>
        </div>
      </header>

      <section id="top" className="relative">
        <div className="absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(circle_at_76%_20%,rgba(108,143,184,.19),transparent_35%),radial-gradient(circle_at_18%_15%,rgba(199,218,235,.35),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:gap-14 sm:px-8 sm:py-24 lg:grid-cols-[.9fr_1.1fr] lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#C9DBEA] bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#52769F] shadow-sm">
              <CheckCircle2 className="size-4" />
              من التخطيط إلى الإنجاز في مساحة واحدة
            </span>
            <h1 className="mt-7 text-[2.15rem] font-bold leading-[1.3] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              كل شغل فريقك،
              <span className="block text-[#52769F]">من الهدف إلى الأثر.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#66788C] sm:text-lg">
              «أثر» منصة عربية لتنظيم الخطط والمشاريع والمهام، تمنح الفريق رؤية
              مشتركة وتضع ما يحتاج انتباهك أمامك بوضوح.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={startLogin}
                className="h-12 gap-2 bg-[#52769F] px-7 text-base hover:bg-[#46698F]"
              >
                الدخول إلى أثر
                <ArrowLeft className="size-4" />
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center rounded-md border border-slate-200 bg-white px-7 text-sm font-semibold text-[#52657A] transition hover:border-[#BFD3E7] hover:bg-[#F8FBFE]"
              >
                تعرّف على طريقة العمل
              </a>
              <PwaInstallButton className="h-12 px-6" />
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="size-4 text-[#6C8FB8]" />
              التسجيل متاح عبر دعوة من مدير مساحة العمل.
            </p>
          </div>

          <DashboardPreview />
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
              <p className="text-sm font-bold text-[#26364A]">{title}</p>
              <p className="mt-1 text-xs text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
      >
        <SectionIntro
          eyebrow="مساحة عمل متكاملة"
          title="كل ما يحتاجه الفريق للعمل بوضوح"
          description="صُممت أثر لتجمع الصورة الكبيرة والتفاصيل اليومية، بدون أن تصبح إدارة العمل عبئًا إضافيًا."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(feature => (
            <article
              key={feature.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(38,54,74,.04)] transition hover:-translate-y-1 hover:border-[#BFD3E7] hover:shadow-[0_18px_45px_rgba(38,54,74,.08)]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#EDF4FA] text-[#52769F] transition group-hover:bg-[#52769F] group-hover:text-white">
                {feature.icon}
              </span>
              <h3 className="mt-6 text-lg font-bold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#718093]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#26364A] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <SectionIntro
            dark
            eyebrow="بداية بسيطة"
            title="ثلاث خطوات، وفريقك جاهز"
            description="تبدأ مساحة العمل بسرعة، ثم تتوسع مع احتياج الفريق بدون تعقيد في الصلاحيات أو الإعدادات."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.number}
                className="relative rounded-2xl border border-white/10 bg-white/[.055] p-6"
              >
                <span className="text-sm font-semibold text-[#AFC6DD]">
                  {step.number}
                </span>
                <h3 className="mt-8 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {step.description}
                </p>
                {index < steps.length - 1 && (
                  <ArrowLeft className="absolute -left-3 top-10 hidden size-5 text-[#AFC6DD] md:block" />
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
        <div className="grid items-center gap-12 rounded-3xl border border-[#DCE7F2] bg-[#EEF5FA] p-7 sm:p-10 lg:grid-cols-[1fr_.8fr] lg:p-14">
          <div>
            <p className="text-xs font-semibold text-[#52769F]">لماذا أثر؟</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight">
              لأن الإنجاز لا يكفي إذا لم يكن أثره واضحًا.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-[#66788C] sm:text-base">
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
                className="flex items-center gap-3 rounded-xl border border-white bg-white/75 px-4 py-3 text-sm font-medium text-[#40556C]"
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
        <div className="mx-auto max-w-7xl rounded-3xl bg-[#52769F] px-6 py-12 text-center text-white shadow-[0_22px_60px_rgba(82,118,159,.24)] sm:px-10">
          <h2 className="text-2xl font-bold sm:text-3xl">
            جاهز تشوف عمل فريقك بصورة أوضح؟
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-blue-100">
            سجّل الدخول إلى مساحة عملك، أو استخدم رابط الدعوة الذي وصلك من مدير
            الفريق.
          </p>
          <Button
            onClick={startLogin}
            className="mt-7 h-11 bg-white px-7 text-[#45698F] hover:bg-slate-50"
          >
            تسجيل الدخول
          </Button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:px-8 lg:px-10">
          <p className="font-semibold text-[#52657A]">
            أثر — إدارة العمل بوضوح
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <p>منصة داخلية لتنظيم عمل الفرق وتحويل الخطط إلى نتائج.</p>
            <a
              className="font-medium text-[#52769F] hover:underline"
              href="/privacy"
            >
              سياسة الخصوصية
            </a>
            <a
              className="font-medium text-[#52769F] hover:underline"
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
    { title: "تحديث تقرير التقدم", meta: "هذا الأسبوع", color: "bg-[#6C8FB8]" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl lg:mx-0">
      <div className="absolute -inset-8 -z-10 rounded-full bg-[#6C8FB8]/10 blur-3xl" />
      <div className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_28px_80px_rgba(38,54,74,.16)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#6C8FB8]" />
            <p className="text-xs font-semibold">نظرة هذا الأسبوع</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
            على المسار
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_.86fr]">
          <div className="rounded-2xl bg-[#F7F9FC] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">إنجاز المشاريع</p>
              <FolderKanban className="size-4 text-[#6C8FB8]" />
            </div>
            <div className="mt-8 flex items-end gap-2">
              {[42, 64, 53, 82, 70, 92].map((height, index) => (
                <span
                  key={index}
                  className={`flex-1 rounded-t-md ${index === 5 ? "bg-[#52769F]" : "bg-[#C9D9E8]"}`}
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
              <span className="text-sm font-bold text-[#52769F]">76%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[76%] rounded-full bg-[#6C8FB8]" />
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
    <div className="rounded-xl bg-[#F7F9FC] p-3">
      <span className="text-[#6C8FB8]">{icon}</span>
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
        className={`text-xs font-semibold ${dark ? "text-[#AFC6DD]" : "text-[#52769F]"}`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-[#26364A]"}`}
      >
        {title}
      </h2>
      <p
        className={`mt-4 text-sm leading-7 sm:text-base ${dark ? "text-slate-300" : "text-[#718093]"}`}
      >
        {description}
      </p>
    </div>
  );
}
