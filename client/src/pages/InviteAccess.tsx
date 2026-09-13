import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, ShieldCheck, Users } from "lucide-react";
import { useRoute } from "wouter";

export default function InviteAccess() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = trpc.workspace.invitationByToken.useQuery(
    { token },
    { enabled: Boolean(token) }
  );
  const accept = trpc.workspace.acceptInvitation.useMutation({
    onSuccess: () => window.location.assign("/"),
  });

  if (isLoading || authLoading)
    return <Status text="جارٍ التحقق من الدعوة..." />;
  if (!data?.member || data.invitation.status === "cancelled")
    return (
      <Status
        title="رابط الدعوة غير متاح"
        text="قد يكون الرابط غير صحيح أو تم إلغاؤه. تواصل مع مدير القسم للحصول على دعوة جديدة."
      />
    );

  const accepted = data.invitation.status === "accepted";
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F8F6FF] p-6"
    >
      <section className="w-full max-w-md rounded-2xl border border-[#EDE6FB] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#F0EAFE] text-[#7A4CCF]">
          <Users className="size-6" />
        </span>
        <p className="mt-5 text-xs font-semibold text-[#8570D0]">
          وجهة · دعوة فريق
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[#22273A]">
          الانضمام إلى {data.board?.name ?? "مساحة العمل"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[#6D6279]">
          مرحبًا {data.member.name}، تمت دعوتك بدور{" "}
          <strong className="font-semibold text-[#5A5570]">
            {data.member.role}
          </strong>
          .
        </p>
        {accepted ? (
          <div className="mt-7 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="ml-2 inline size-4" />
            تم قبول هذه الدعوة سابقًا.
          </div>
        ) : !user ? (
          <Button
            onClick={startLogin}
            className="mt-7 h-11 w-full gap-2 bg-[#7A4CCF] hover:bg-[#684CB2]"
          >
            <ShieldCheck className="size-4" />
            تسجيل الدخول أو إنشاء حساب
          </Button>
        ) : (
          <Button
            disabled={accept.isPending}
            onClick={() => accept.mutate({ token })}
            className="mt-7 h-11 w-full bg-[#7A4CCF] hover:bg-[#684CB2]"
          >
            {accept.isPending ? (
              <>
                <Loader2 className="ml-2 size-4 animate-spin" />
                جارٍ الانضمام...
              </>
            ) : (
              "قبول الدعوة والانضمام"
            )}
          </Button>
        )}
        {accept.error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {accept.error.message}
          </p>
        )}
        <p className="mt-4 text-[11px] text-[#6D6279]">
          استخدم البريد: {data.invitation.email}
        </p>
      </section>
    </main>
  );
}

function Status({ title, text }: { title?: string; text: string }) {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F8F6FF] p-6"
    >
      <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        {title && <h1 className="text-xl font-bold text-[#22273A]">{title}</h1>}
        <p
          className={`${title ? "mt-3" : ""} text-sm leading-6 text-[#6D6279]`}
        >
          {text}
        </p>
      </section>
    </main>
  );
}
