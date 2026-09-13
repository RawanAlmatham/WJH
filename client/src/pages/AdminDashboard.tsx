import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clipboard,
  Clock3,
  Loader2,
  MailPlus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const { data, isLoading, error } = trpc.admin.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const invite = trpc.admin.inviteManager.useMutation({
    onSuccess: async result => {
      setInviteUrl(`${window.location.origin}${result.invitePath}`);
      setName("");
      setEmail("");
      await utils.admin.overview.invalidate();
      toast.success("تم إنشاء دعوة مدير اللوحة");
    },
    onError: issue => toast.error(issue.message),
  });
  const cancel = trpc.admin.cancelManagerInvitation.useMutation({
    onSuccess: async () => {
      await utils.admin.overview.invalidate();
      toast.success("تم إلغاء الدعوة");
    },
    onError: issue => toast.error(issue.message),
  });
  const reissue = trpc.admin.reissueManagerInvitation.useMutation({
    onSuccess: async result => {
      setInviteUrl(`${window.location.origin}${result.invitePath}`);
      await utils.admin.overview.invalidate();
      toast.success("تم إنشاء رابط جديد للدعوة");
    },
    onError: issue => toast.error(issue.message),
  });
  const updateMemberAccess = trpc.admin.updateBoardMemberAccess.useMutation({
    onSuccess: async () => {
      await utils.admin.overview.invalidate();
      toast.success("تم تحديث صلاحية العضو");
    },
    onError: issue => toast.error(issue.message),
  });
  const setMemberActive = trpc.admin.setBoardMemberActive.useMutation({
    onSuccess: async result => {
      await utils.admin.overview.invalidate();
      toast.success(result.success ? "تم تحديث وصول العضو" : "تعذر التحديث");
    },
    onError: issue => toast.error(issue.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    invite.mutate({ name: name.trim(), email: email.trim() });
  };
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("تم نسخ رابط الدعوة");
  };

  if (loading)
    return (
      <Centered>
        <Loader2 className="size-7 animate-spin text-[#8570D0]" />
      </Centered>
    );
  if (!user)
    return (
      <Centered>
        <AccessCard
          title="سجّل الدخول لإدارة المنصة"
          action="تسجيل الدخول"
          onClick={startLogin}
        />
      </Centered>
    );
  if (user.role !== "admin")
    return (
      <Centered>
        <AccessCard
          title="هذه الصفحة لمدير المنصة فقط"
          action="العودة إلى لوحة العمل"
          onClick={() => window.location.assign("/")}
        />
      </Centered>
    );
  if (isLoading)
    return (
      <Centered>
        <Loader2 className="size-7 animate-spin text-[#8570D0]" />
      </Centered>
    );
  if (error || !data)
    return (
      <Centered>
        <AccessCard
          title="تعذر تحميل لوحة إدارة المنصة"
          action="إعادة المحاولة"
          onClick={() => window.location.reload()}
        />
      </Centered>
    );

  const pending = data.invitations.filter(item => item.status === "pending");
  const history = data.invitations.filter(item => item.status !== "pending");
  const selectedBoard =
    data.boards.find(board => board.id === selectedBoardId) ?? data.boards[0];

  return (
    <main dir="rtl" className="min-h-screen bg-[#F8F6FF] text-[#22273A]">
      <header className="app-topbar border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#22273A] text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">إدارة منصة وجهة</p>
              <p className="text-[11px] text-slate-500">
                المدراء والأقسام والأعضاء
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.assign("/")}
            className="gap-2 border-slate-200 bg-white text-[#5A5570]"
          >
            <ArrowRight className="size-4" />
            <span className="hidden sm:inline">لوحة عملي</span>
            <span className="sm:hidden">لوحتي</span>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold text-[#8570D0]">مدير المنصة</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              إدارة المدراء واللوحات
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              أدر المدراء وأعضاء فرقهم وصلاحيات الوصول من مكان واحد.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            مرحبًا، {user.name ?? "مدير المنصة"}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            icon={<UserCog className="size-5" />}
            label="مدراء اللوحات"
            value={data.managerCount}
          />
          <SummaryCard
            icon={<Building2 className="size-5" />}
            label="لوحات الأقسام"
            value={data.boardCount}
          />
          <SummaryCard
            icon={<Users className="size-5" />}
            label="أعضاء الفرق"
            value={data.memberCount}
          />
          <SummaryCard
            icon={<ShieldCheck className="size-5" />}
            label="إجمالي الحسابات"
            value={data.userCount}
          />
          <SummaryCard
            icon={<Clock3 className="size-5" />}
            label="دعوات بانتظار القبول"
            value={data.pendingInvitationCount}
          />
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-bold">أعضاء الفرق</h2>
              <p className="mt-1 text-xs text-slate-500">
                راجع أعضاء كل لوحة، وعدّل صلاحياتهم أو أوقف وصولهم.
              </p>
            </div>
            {data.boards.length > 0 && (
              <label className="text-xs font-medium text-[#5A5570]">
                لوحة القسم
                <select
                  value={selectedBoard?.id ?? ""}
                  onChange={event =>
                    setSelectedBoardId(Number(event.target.value))
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#8570D0] sm:min-w-56"
                >
                  {data.boards.map(board => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {selectedBoard ? (
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="responsive-data-table w-full min-w-[820px] text-right">
                  <thead className="border-b border-slate-100 bg-[#FFFDFF] text-[11px] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">العضو</th>
                      <th className="px-4 py-3">دوره في القسم</th>
                      <th className="px-4 py-3">صلاحية اللوحة</th>
                      <th className="px-4 py-3">الحالة</th>
                      <th className="px-4 py-3">الإدارة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBoard.members.map(member => {
                      const protectedMember =
                        member.isOwner || member.userId === user.id;
                      const accessLabel = member.isOwner
                        ? "مدير اللوحة الأساسي"
                        : member.accountRole === "admin"
                          ? "مدير المنصة"
                          : null;
                      return (
                        <tr
                          key={member.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td
                            data-mobile-primary
                            data-label="العضو"
                            className="px-4 py-4"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 items-center justify-center rounded-full bg-[#F0EAFE] text-xs font-bold text-[#7A4CCF]">
                                {initials(member.name)}
                              </span>
                              <div>
                                <p className="text-sm font-semibold">
                                  {member.name}
                                </p>
                                <p
                                  dir="ltr"
                                  className="mt-1 break-all text-right text-xs text-slate-500"
                                >
                                  {member.email ?? "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td
                            data-label="دوره في القسم"
                            className="px-4 py-4 text-xs text-[#5A5570]"
                          >
                            {member.role}
                          </td>
                          <td data-label="صلاحية اللوحة" className="px-4 py-4">
                            {accessLabel ? (
                              <span className="rounded-full bg-[#F0EAFE] px-2.5 py-1 text-[11px] font-semibold text-[#7A4CCF]">
                                {accessLabel}
                              </span>
                            ) : (
                              <select
                                value={member.accessRole ?? "member"}
                                disabled={
                                  member.accessStatus !== "active" ||
                                  updateMemberAccess.isPending
                                }
                                onChange={event =>
                                  updateMemberAccess.mutate({
                                    memberId: member.id,
                                    accessRole: event.target.value as
                                      | "manager"
                                      | "member"
                                      | "viewer",
                                  })
                                }
                                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-50"
                              >
                                <option value="manager">مدير لوحة</option>
                                <option value="member">عضو</option>
                                <option value="viewer">مشاهد</option>
                              </select>
                            )}
                          </td>
                          <td data-label="الحالة" className="px-4 py-4">
                            <MemberStatus status={member.accessStatus} />
                          </td>
                          <td
                            data-mobile-actions
                            data-label="الإدارة"
                            className="px-4 py-4"
                          >
                            {member.accessStatus === "inactive" &&
                            member.userId ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={setMemberActive.isPending}
                                onClick={() =>
                                  setMemberActive.mutate({
                                    memberId: member.id,
                                    active: true,
                                  })
                                }
                                className="gap-1.5 border-emerald-200 text-emerald-700"
                              >
                                <RotateCcw className="size-3.5" />
                                إعادة التفعيل
                              </Button>
                            ) : member.accessStatus !== "inactive" ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={
                                      protectedMember ||
                                      setMemberActive.isPending
                                    }
                                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    {member.accessStatus === "pending"
                                      ? "إلغاء الدعوة"
                                      : protectedMember
                                        ? "محمي"
                                        : "إيقاف الوصول"}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent dir="rtl">
                                  <AlertDialogHeader className="text-right sm:text-right">
                                    <AlertDialogTitle>
                                      {member.accessStatus === "pending"
                                        ? "إلغاء دعوة العضو؟"
                                        : "إيقاف وصول العضو؟"}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      سيُمنع {member.name} من الوصول إلى لوحة «
                                      {selectedBoard.name}»، مع الاحتفاظ بسجل
                                      أعماله السابقة.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="sm:justify-start">
                                    <AlertDialogCancel>تراجع</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        setMemberActive.mutate({
                                          memberId: member.id,
                                          active: false,
                                        })
                                      }
                                      className="bg-rose-600 text-white hover:bg-rose-700"
                                    >
                                      تأكيد الإيقاف
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <span className="text-xs text-slate-400">
                                يتطلب دعوة جديدة
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!selectedBoard.members.length && (
                <Empty text="لا يوجد أعضاء في هذه اللوحة بعد." />
              )}
            </div>
          ) : (
            <Empty text="لا توجد لوحات لإدارة أعضائها بعد." />
          )}
        </section>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#F0EAFE] text-[#7A4CCF]">
                <MailPlus className="size-5" />
              </span>
              <div>
                <h2 className="font-bold">إضافة مدير لوحة</h2>
                <p className="mt-1 text-xs text-slate-500">
                  سيستلم رابطًا لإنشاء حسابه ولوحته.
                </p>
              </div>
            </div>
            {inviteUrl ? (
              <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="size-4" />
                  رابط الدعوة جاهز
                </div>
                <Input
                  readOnly
                  value={inviteUrl}
                  dir="ltr"
                  className="mt-3 bg-white text-xs"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => copy(inviteUrl)}
                    className="gap-2 border-emerald-200 text-emerald-800"
                  >
                    <Clipboard className="size-4" />
                    نسخ الرابط
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setInviteUrl("")}
                    className="text-emerald-800"
                  >
                    دعوة مدير لوحة آخر
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-[#5A5570]">
                  اسم المدير
                  <Input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    required
                    minLength={2}
                    placeholder="مثال: مها العتيبي"
                    className="mt-2"
                  />
                </label>
                <label className="block text-sm font-medium text-[#5A5570]">
                  البريد الإلكتروني
                  <Input
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    required
                    type="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    className="mt-2"
                  />
                </label>
                <Button
                  type="submit"
                  disabled={invite.isPending}
                  className="h-10 w-full bg-[#7A4CCF] hover:bg-[#684CB2]"
                >
                  {invite.isPending
                    ? "جارٍ إنشاء الدعوة..."
                    : "إنشاء رابط دعوة مدير اللوحة"}
                </Button>
              </form>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">مدراء اللوحات</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    المدراء الذين فعّلوا حساباتهم.
                  </p>
                </div>
                <span className="rounded-full bg-[#F0EAFE] px-3 py-1 text-xs font-semibold text-[#7A4CCF]">
                  {data.managers.length}
                </span>
              </div>
              <div className="mt-5 divide-y divide-slate-100">
                {data.managers.length ? (
                  data.managers.map(manager => (
                    <div
                      key={manager.id}
                      className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-[#F0EAFE] text-xs font-bold text-[#7A4CCF]">
                          {initials(manager.name)}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">
                            {manager.name ?? "مدير لوحة"}
                          </p>
                          <p
                            dir="ltr"
                            className="mt-1 text-right text-xs text-slate-500"
                          >
                            {manager.email}
                          </p>
                        </div>
                      </div>
                      <div className="text-right sm:text-left">
                        <p className="text-xs font-semibold text-[#5A5570]">
                          {manager.boards.length} لوحة
                        </p>
                        <p className="mt-1 max-w-52 truncate text-xs text-slate-400">
                          {manager.boards.map(board => board.name).join("، ") ||
                            "لم ينشئ لوحة بعد"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text="لم يفعّل أي مدير حسابه بعد." />
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">الدعوات المرسلة</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    يمكن إلغاء الدعوة أو إصدار رابط جديد.
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {pending.length} معلقة
                </span>
              </div>
              <div className="mt-5 divide-y divide-slate-100">
                {pending.map(item => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p
                        dir="ltr"
                        className="mt-1 text-right text-xs text-slate-500"
                      >
                        {item.email}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reissue.isPending}
                        onClick={() => reissue.mutate({ id: item.id })}
                        className="gap-1.5 border-[#D9CCF3] text-[#7A4CCF]"
                      >
                        <RefreshCw className="size-3.5" />
                        رابط جديد
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate({ id: item.id })}
                        className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <XCircle className="size-3.5" />
                        إلغاء
                      </Button>
                    </div>
                  </div>
                ))}
                {!pending.length && <Empty text="لا توجد دعوات معلقة." />}
              </div>
              {!!history.length && (
                <p className="mt-4 text-xs text-slate-400">
                  سجل سابق:{" "}
                  {history.filter(item => item.status === "accepted").length}{" "}
                  مقبولة،{" "}
                  {history.filter(item => item.status === "cancelled").length}{" "}
                  ملغاة.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="flex size-10 items-center justify-center rounded-xl bg-[#F0EAFE] text-[#7A4CCF]">
        {icon}
      </span>
      <p className="mt-5 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{text}</p>;
}
function MemberStatus({
  status,
}: {
  status: "active" | "pending" | "inactive";
}) {
  const content = {
    active: { label: "نشط", style: "bg-emerald-50 text-emerald-700" },
    pending: {
      label: "بانتظار قبول الدعوة",
      style: "bg-amber-50 text-amber-700",
    },
    inactive: { label: "متوقف", style: "bg-slate-100 text-slate-500" },
  }[status];
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${content.style}`}
    >
      {content.label}
    </span>
  );
}
function initials(name: string | null) {
  return (
    name
      ?.split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join("") || "م"
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F8F6FF] p-6"
    >
      {children}
    </main>
  );
}
function AccessCard({
  title,
  action,
  onClick,
}: {
  title: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <ShieldCheck className="mx-auto size-8 text-[#8570D0]" />
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <Button
        onClick={onClick}
        className="mt-6 bg-[#7A4CCF] hover:bg-[#684CB2]"
      >
        {action}
      </Button>
    </section>
  );
}
