import { BrandJourney, BrandLogo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import {
  ArrowLeft,
  Blocks,
  CheckCircle2,
  Layers3,
  Sparkles,
  Waypoints,
} from "lucide-react";

const principles = [
  {
    icon: Layers3,
    title: "تجربة مستقلة",
    description: "لكل احتياج تقسيماته وبياناته وأدواته الخاصة.",
    color: "#1E3A8A",
    background: "#E9EDF7",
  },
  {
    icon: Blocks,
    title: "مرونة من البداية",
    description: "نبني كل مساحة لتتوسع من دون أن تقيدها بنية قالب آخر.",
    color: "#7A2E5C",
    background: "#F5EAF0",
  },
  {
    icon: Waypoints,
    title: "خطوات أوضح",
    description: "تظهر لك المعلومات التي تحتاجها بحسب وجهتك فقط.",
    color: "#45613F",
    background: "#E9EDE4",
  },
];

export default function Landing() {
  const { user } = useAuth();
  const openAccount = () =>
    window.location.assign(user ? "/" : "/login?next=%2F");

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[#F5F2EE] text-[#1F2328]"
    >
      <header className="app-topbar sticky top-0 z-30 border-b border-slate-200/80 bg-[#F5F2EE]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8 lg:px-10">
          <a href="#top" aria-label="وجهة - الصفحة الرئيسية">
            <BrandLogo tagline />
          </a>
          <Button
            onClick={openAccount}
            variant="outline"
            className="h-10 border-[#CCD4E6] bg-white px-4 text-[#1E3A8A] hover:bg-[#E9EDF7]"
          >
            {user ? "فتح حسابي" : "تسجيل الدخول"}
          </Button>
        </div>
      </header>

      <section id="top" className="relative">
        <div className="brand-hero-wash absolute inset-x-0 top-0 h-[38rem]" />
        <div className="relative mx-auto grid min-h-[36rem] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1fr] lg:px-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#CCD4E6] bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#1E3A8A] shadow-sm">
              <CheckCircle2 className="size-4 text-[#896400]" />
              نعيد تصميم وجهة من الصفر
            </span>
            <h1 className="mt-7 text-[2.4rem] font-bold leading-[1.25] tracking-tight sm:text-5xl lg:text-[3.7rem]">
              كل هدف له طريقته،
              <span className="block text-[#1E3A8A]">وكل طريق له وجهة.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#62635F] sm:text-lg">
              نبني مساحات عربية متخصصة تساعدك على ترتيب خطواتك ومتابعة تقدمك،
              بتجربة مصممة لكل احتياج على حدة.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={openAccount}
                className="h-12 gap-2 bg-[#1E3A8A] px-7 text-base hover:bg-[#172E6E]"
              >
                {user ? "فتح حسابي" : "الدخول إلى وجهة"}
                <ArrowLeft className="size-4" />
              </Button>
              <PwaInstallButton className="h-12 px-6" />
            </div>
          </div>

          <div className="brand-hero-visual">
            <BrandJourney />
            <div className="brand-arrival-card" dir="rtl">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FFF3CC] text-[#896400]">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold">مساحة جديدة تبدأ هنا.</p>
                <p className="mt-1 text-xs text-[#62635F]">
                  نصممها حول ما تريد إنجازه.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/70">
        <div className="mx-auto max-w-7xl px-5 py-7 text-center sm:px-8 lg:px-10">
          <p className="text-sm font-semibold text-[#444943]">
            أزلنا القوالب السابقة، ونبني الآن كل قالب كتجربة مستقلة متكاملة.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[#7A2E5C]">
            أساس النسخة الجديدة
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
            القالب يتبع احتياجك
          </h2>
          <p className="mt-4 text-sm leading-8 text-[#62635F] sm:text-base">
            لن نفرض الهيكل نفسه على جميع الاستخدامات. نبدأ من هدف القالب، ثم
            نصمم أقسامه وتدفقه وبياناته حول هذا الهدف.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {principles.map(principle => {
            const Icon = principle.icon;
            return (
              <article
                key={principle.title}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_14px_40px_rgba(34,39,58,.06)]"
              >
                <span
                  className="flex size-12 items-center justify-center rounded-xl"
                  style={{
                    color: principle.color,
                    backgroundColor: principle.background,
                  }}
                >
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-6 text-lg font-bold">{principle.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#62635F]">
                  {principle.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-3xl bg-[#1E3A8A] px-6 py-12 text-center text-white shadow-[0_22px_60px_rgba(30,58,138,.24)] sm:px-10">
          <h2 className="text-2xl font-bold sm:text-3xl">
            نبني أول وجهة، خطوة بخطوة.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-blue-100">
            سيُفتح إنشاء المساحات بعد اكتمال واعتماد أول قالب جديد.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:px-8 lg:px-10">
          <BrandLogo tagline />
          <div className="flex flex-wrap items-center justify-center gap-4">
            <p>لكل طموح، وجهة.</p>
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
