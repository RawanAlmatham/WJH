import { Button } from "@/components/ui/button";
import { BrandJourney, BrandLogo } from "@/components/Brand";
import { startGoogleLogin } from "@/const";
import { ArrowRight, Check } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export default function Login() {
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) toast.error(error);
  }, []);

  function loginWithGoogle() {
    const requestedNext = new URLSearchParams(window.location.search).get(
      "next"
    );
    startGoogleLogin(requestedNext ?? "/");
  }

  return (
    <main
      dir="rtl"
      className="public-shell flex min-h-screen items-center justify-center bg-[#F5F2EE] p-4 sm:p-8"
    >
      <div className="brand-login">
        <section className="brand-login-form">
          <a
            href="/"
            className="self-start"
            aria-label="وجهة — الصفحة الرئيسية"
          >
            <BrandLogo tagline />
          </a>
          <p className="mt-12 text-xs font-semibold text-[#7A2E5C]">
            خطوتك الأولى
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-snug text-[#1F2328]">
            أهلًا بك في وجهة.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#62635F]">
            مساحتك لترتيب الأفكار وتحويلها إلى إنجاز. سجّل الدخول أو أنشئ حسابك
            باستخدام Google.
          </p>
          <Button
            type="button"
            onClick={loginWithGoogle}
            className="mt-8 h-12 w-full gap-3 bg-[#1E3A8A] text-white hover:bg-[#172E6E]"
          >
            المتابعة باستخدام Google
          </Button>
          <p className="mt-5 flex items-center gap-2 text-xs leading-6 text-[#62635F]">
            <Check className="size-4 shrink-0 text-[#45613F]" />
            بعد الدخول، أنشئ لوحتك أو انضم إلى لوحة فريقك.
          </p>
          <div className="mt-10 flex items-center justify-between border-t border-[#E4E1DA] pt-5 text-xs text-[#62635F]">
            <a className="hover:text-[#1E3A8A] hover:underline" href="/support">
              الدعم
            </a>
            <a className="hover:text-[#1E3A8A] hover:underline" href="/privacy">
              سياسة الخصوصية
            </a>
          </div>
          <a
            href="/"
            className="mt-5 inline-flex items-center gap-2 self-start text-xs text-[#62635F] hover:text-[#1E3A8A]"
          >
            <ArrowRight className="size-3" />
            العودة للرئيسية
          </a>
        </section>
        <aside className="brand-login-story">
          <BrandJourney />
          <h2 className="mt-5 text-3xl font-bold leading-relaxed">
            لكل طموح،
            <br />
            <span className="text-[#1E3A8A]">وجهة.</span>
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#4E534E]">
            لفريقك، لشركتك، لمتجرك، أو لنفسك.
            <br />
            البدايات مختلفة، والخطوة الأولى هنا.
          </p>
        </aside>
      </div>
    </main>
  );
}
