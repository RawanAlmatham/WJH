import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function Login() {
  const utils = trpc.useUtils();
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
      ? next
      : "/";
  const invitationToken =
    safeNext.match(/^\/(?:invite|manager-invite)\/([^/?#]+)/)?.[1] ?? "";
  const canSignup = Boolean(invitationToken);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const finish = async (user: any) => {
    utils.auth.me.setData(undefined, user);
    window.location.href = safeNext;
  };
  const login = trpc.auth.login.useMutation({
    onSuccess: finish,
    onError: error => toast.error(error.message),
  });
  const signup = trpc.auth.signup.useMutation({
    onSuccess: finish,
    onError: error => toast.error(error.message),
  });
  const pending = login.isPending || signup.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signup")
      signup.mutate({ name, email, password, invitationToken });
    else login.mutate({ email, password });
  }

  return (
    <main
      dir="rtl"
      className="public-shell flex min-h-screen items-center justify-center bg-[#F7F9FC] p-4 sm:p-6"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold text-[#52769F]">أثر</p>
        <h1 className="mt-2 text-2xl font-bold text-[#26364A]">
          {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#7C8A9A]">
          {mode === "login"
            ? "أدخل بيانات حسابك للعودة إلى مساحة عملك."
            : "أنشئ حسابك باستخدام البريد الإلكتروني الذي وصلت إليه الدعوة."}
        </p>
        {canSignup && (
          <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "login" ? "bg-white text-[#52769F] shadow-sm" : "text-slate-500"}`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "signup" ? "bg-white text-[#52769F] shadow-sm" : "text-slate-500"}`}
            >
              إنشاء حساب بالدعوة
            </button>
          </div>
        )}
        {!canSignup && (
          <p className="mt-3 text-xs text-slate-500">
            إنشاء الحسابات الجديدة متاح من خلال رابط دعوة يرسله مدير اللوحة.
          </p>
        )}
        {mode === "signup" && (
          <>
            <label className="mt-6 block text-sm font-medium text-[#52657A]">
              الاسم
            </label>
            <Input
              value={name}
              onChange={event => setName(event.target.value)}
              required
              minLength={2}
              autoComplete="name"
              className="mt-2"
            />
          </>
        )}
        <label
          className={`${mode === "signup" ? "mt-4" : "mt-6"} block text-sm font-medium text-[#52657A]`}
        >
          البريد الإلكتروني
        </label>
        <Input
          value={email}
          onChange={event => setEmail(event.target.value)}
          required
          type="email"
          autoComplete="email"
          className="mt-2"
        />
        <label className="mt-4 block text-sm font-medium text-[#52657A]">
          كلمة المرور
        </label>
        <Input
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
          minLength={mode === "signup" ? 8 : 1}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="mt-2"
        />
        {mode === "signup" && (
          <p className="mt-2 text-xs text-slate-500">ثمانية أحرف على الأقل.</p>
        )}
        <Button
          type="submit"
          disabled={pending}
          className="mt-6 h-11 w-full bg-[#52769F] hover:bg-[#46698F]"
        >
          {pending
            ? "جارٍ المتابعة…"
            : mode === "login"
              ? "دخول"
              : "إنشاء الحساب"}
        </Button>
        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-500">
          <a className="hover:text-[#52769F] hover:underline" href="/privacy">
            سياسة الخصوصية
          </a>
          <a className="hover:text-[#52769F] hover:underline" href="/support">
            الدعم
          </a>
        </div>
      </form>
    </main>
  );
}
