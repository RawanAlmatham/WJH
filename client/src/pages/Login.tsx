import { Button } from "@/components/ui/button";
import { startGoogleLogin } from "@/const";
import { Mail } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export default function Login() {
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) toast.error(decodeURIComponent(error));
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
      className="public-shell flex min-h-screen items-center justify-center bg-[#F8F6FF] p-4 sm:p-6"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-[#7A4CCF]">وجهة</p>
        <h1 className="mt-2 text-2xl font-bold text-[#22273A]">تسجيل الدخول</h1>
        <p className="mt-2 text-sm leading-6 text-[#6D6279]">
          يمكنك الآن الدخول عبر حساب Google مباشرة.
        </p>

        <Button
          type="button"
          onClick={loginWithGoogle}
          className="mt-6 h-11 w-full bg-white text-[#22273A] ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <Mail className="size-4" />
          الدخول باستخدام Gmail
        </Button>
        <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
          <a className="hover:text-[#7A4CCF] hover:underline" href="/support">
            الدعم
          </a>
          <a className="hover:text-[#7A4CCF] hover:underline" href="/privacy">
            سياسة الخصوصية
          </a>
        </div>
      </div>
    </main>
  );
}
