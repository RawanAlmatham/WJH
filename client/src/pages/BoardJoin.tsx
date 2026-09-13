import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";

export default function BoardJoin() {
  const [, params] = useRoute("/join/:token");
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [complete, setComplete] = useState(false);
  const join = trpc.boards.joinByLink.useMutation({
    onSuccess: () => {
      utils.boards.mine.invalidate();
      setComplete(true);
    },
  });
  const token = params?.token ?? "";
  useEffect(() => {
    if (user && token && !join.isPending && !join.isSuccess && !join.isError)
      join.mutate({ inviteToken: token });
  }, [user, token]);
  if (loading || (user && join.isPending))
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#F8F6FF]"
      >
        <Loader2 className="size-6 animate-spin text-[#8570D0]" />
      </div>
    );
  if (!user)
    return (
      <JoinCard
        title="انضم إلى لوحة إدارة"
        description="سجّل الدخول للانضمام إلى اللوحة التي تمت مشاركتها معك."
        action="تسجيل الدخول والمتابعة"
        onClick={() => startLogin()}
      />
    );
  if (complete)
    return (
      <JoinCard
        title="تم الانضمام بنجاح"
        description="أصبحت الآن عضوًا في لوحة الإدارة. يمكنك البدء في متابعة وإضافة الأعمال."
        action="فتح لوحة العمل"
        onClick={() => setLocation("/")}
        success
      />
    );
  return (
    <JoinCard
      title="تعذر الانضمام"
      description={join.error?.message ?? "رابط الانضمام غير صالح."}
      action="العودة إلى البداية"
      onClick={() => setLocation("/")}
    />
  );
}
function JoinCard({
  title,
  description,
  action,
  onClick,
  success = false,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  success?: boolean;
}) {
  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F8F6FF] p-5"
    >
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <span
          className={`mx-auto flex size-12 items-center justify-center rounded-2xl ${success ? "bg-emerald-50 text-emerald-700" : "bg-[#F0EAFE] text-[#7A4CCF]"}`}
        >
          {success ? (
            <CheckCircle2 className="size-6" />
          ) : (
            <Users className="size-6" />
          )}
        </span>
        <h1 className="mt-5 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#6D6279]">{description}</p>
        <Button
          onClick={onClick}
          className="mt-6 h-10 w-full bg-[#7A4CCF] hover:bg-[#684CB2]"
        >
          {action}
        </Button>
      </section>
    </div>
  );
}
