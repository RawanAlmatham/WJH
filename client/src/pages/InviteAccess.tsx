import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { useRoute } from "wouter";

export default function InviteAccess() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = trpc.workspace.invitationByToken.useQuery({ token }, { enabled: Boolean(token) });
  if (isLoading) return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F7F9FC] text-sm text-[#7C8A9A]">جارٍ التحقق من الدعوة...</div>;
  if (!data || !data.member || data.invitation.status === "cancelled") return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F7F9FC] p-6"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#26364A]">رابط الدعوة غير متاح</h1><p className="mt-3 text-sm leading-6 text-[#7C8A9A]">قد يكون الرابط غير صحيح أو تم إلغاؤه. تواصل مع مدير القسم للحصول على دعوة جديدة.</p></div></div>;
  return <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F7F9FC] p-6"><div className="w-full max-w-md rounded-2xl border border-[#DDE8F2] bg-white p-8 text-center shadow-sm"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#EDF4FA] text-[#52769F]"><Users className="size-6" /></span><p className="mt-5 text-xs font-semibold text-[#6C8FB8]">دعوة للانضمام إلى لوحة تشغيل القسم</p><h1 className="mt-2 text-2xl font-bold text-[#26364A]">مرحبًا {data.member.name}</h1><p className="mt-3 text-sm leading-7 text-[#7C8A9A]">تمت دعوتك للانضمام كـ <strong className="font-semibold text-[#52657A]">{data.member.role}</strong>. سجّل الدخول بالبريد الإلكتروني الذي استلم الدعوة لتفعيل عضويتك.</p>{isAuthenticated ? <div className="mt-7 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="ml-2 inline size-4" />تم تسجيل دخولك. سيظهر حسابك كعضو فريق عند العودة للمنصة.</div> : <Button onClick={() => startLogin()} className="mt-7 h-11 w-full gap-2 bg-[#52769F] hover:bg-[#46698F]"><ShieldCheck className="size-4" />تسجيل الدخول وقبول الدعوة</Button>}<p className="mt-4 text-[11px] text-[#7C8A9A]">الدعوة مرتبطة بالبريد الإلكتروني: {data.invitation.email}</p></div></div>;
}
