import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, ShieldCheck, UserCog } from "lucide-react";
import { useRoute } from "wouter";

export default function ManagerInviteAccess() {
  const [, params] = useRoute("/manager-invite/:token");
  const token = params?.token ?? "";
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.managerInvitations.byToken.useQuery(
    { token },
    { enabled: Boolean(token) }
  );
  const accept = trpc.managerInvitations.accept.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.assign("/");
    },
  });

  if (isLoading || authLoading)
    return <Status text="جارٍ التحقق من دعوة مدير اللوحة..." loading />;
  if (!data || data.status === "cancelled")
    return (
      <Status
        title="دعوة مدير اللوحة غير متاحة"
        text="قد يكون الرابط غير صحيح أو ألغاه مدير المنصة. اطلب دعوة جديدة للمتابعة."
      />
    );

  const accepted = data.status === "accepted";
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F8F6FF] p-6"
    >
      <section className="w-full max-w-md rounded-2xl border border-[#EDE6FB] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#F0EAFE] text-[#7A4CCF]">
          <UserCog className="size-6" />
        </span>
        <p className="mt-5 text-xs font-semibold text-[#8570D0]">
          وجهة · إدارة لوحة
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[#22273A]">
          دعوة لإدارة لوحة جديدة
        </h1>
        <p className="mt-3 text-sm leading-7 text-[#6D6279]">
          مرحبًا {data.name}، دعاك مدير المنصة لتصبح مدير لوحة. بعد تفعيل الدعوة
          يمكنك إنشاء لوحة مستقلة ودعوة فريقك إليها.
        </p>

        {accepted ? (
          <div className="mt-7 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="ml-2 inline size-4" />
            تم تفعيل صلاحية مدير اللوحة.
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
                جارٍ التفعيل...
              </>
            ) : (
              "قبول الدعوة وإنشاء لوحة"
            )}
          </Button>
        )}

        {accept.error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {accept.error.message}
          </p>
        )}
        <p className="mt-4 text-[11px] text-[#6D6279]">
          استخدم البريد: {data.email}
        </p>
      </section>
    </main>
  );
}

function Status({
  title,
  text,
  loading = false,
}: {
  title?: string;
  text: string;
  loading?: boolean;
}) {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F8F6FF] p-6"
    >
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        {loading && (
          <Loader2 className="mx-auto mb-4 size-6 animate-spin text-[#8570D0]" />
        )}
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
