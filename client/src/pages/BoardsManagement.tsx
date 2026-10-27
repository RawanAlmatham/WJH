import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  LogOut,
  Trash2,
  RotateCcw,
  Plus,
  Loader2,
  Users,
  FolderKanban,
} from "lucide-react";
import { BOARD_TEMPLATE_LABELS } from "@shared/boardTemplates";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { toast } from "sonner";
type Board =
  inferRouterOutputs<AppRouter>["boards"]["management"]["boards"][number];
export default function BoardsManagement() {
  const { user, loading } = useAuth();
  const query = trpc.boards.management.useQuery(undefined, { enabled: !!user });
  const [dialog, setDialog] = useState<{
      kind: "leave" | "delete";
      board: Board;
    } | null>(null),
    [confirmName, setConfirmName] = useState(""),
    [successor, setSuccessor] = useState("");
  const done = () => window.location.replace("/boards");
  const error = (e: { message: string }) => toast.error(e.message);
  const leave = trpc.boards.leave.useMutation({
    onSuccess: done,
    onError: error,
  });
  const remove = trpc.boards.delete.useMutation({
    onSuccess: done,
    onError: error,
  });
  const restore = trpc.boards.restore.useMutation({
    onSuccess: done,
    onError: error,
  });
  const select = trpc.boards.select.useMutation({
    onSuccess: () => window.location.assign("/"),
    onError: error,
  });
  const busy =
    leave.isPending ||
    remove.isPending ||
    restore.isPending ||
    select.isPending;
  const open = (kind: "leave" | "delete", board: Board) => {
    setConfirmName("");
    setSuccessor("");
    setDialog({ kind, board });
  };
  const lastManager =
    dialog?.board.membershipRole === "manager" &&
    !dialog.board.members.some(
      m => m.userId !== user?.id && m.role === "manager"
    );
  const successors =
    dialog?.board.members.filter(
      m => m.userId !== user?.id && m.role === "member"
    ) ?? [];
  const cannotLeave = !!lastManager && !successors.length;
  return (
    <main dir="rtl" className="min-h-dvh bg-[#F5F2EE] px-5 py-8 text-[#1F2328]">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <BrandLogo tagline />
          <a
            href="/"
            className="flex items-center gap-1 text-sm text-[#1E3A8A]"
          >
            <ArrowRight className="size-4" />
            العودة إلى اللوحة
          </a>
        </header>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#14285F]">إدارة اللوحات</h1>
            <p className="mt-3 text-sm leading-7 text-[#687063]">
              افتح لوحاتك، أو غادر المساحات التي لم تعد تحتاجها. حذف اللوحة متاح
              لمديرها فقط.
            </p>
          </div>
          {user && (
            <a
              href="/boards/new"
              className="flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm text-white"
            >
              <Plus className="size-4" />
              لوحة جديدة
            </a>
          )}
        </div>
        {loading || query.isLoading ? (
          <Loader2 className="mx-auto my-16 size-6 animate-spin" />
        ) : !user ? (
          <div className="rounded-2xl border bg-white p-8">
            <p>سجّل الدخول لإدارة لوحاتك.</p>
            <Button className="mt-4" onClick={() => startLogin()}>
              تسجيل الدخول
            </Button>
          </div>
        ) : query.error ? (
          <div role="alert" className="rounded-2xl border bg-white p-6">
            {query.error.message}
            <Button
              variant="outline"
              className="mr-3"
              onClick={() => void query.refetch()}
            >
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {query.data?.boards.map(board => (
                <section
                  key={board.id}
                  className="flex flex-col rounded-2xl border border-[#dfe3da] bg-white p-6"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="rounded-xl bg-[#e9edf7] p-3 text-[#1E3A8A]">
                      <FolderKanban className="size-5" />
                    </span>
                    {board.isActive && (
                      <span className="rounded-full bg-[#eaf2e8] px-3 py-1 text-xs text-[#426242]">
                        اللوحة الحالية
                      </span>
                    )}
                  </div>
                  <h2 className="break-words text-xl font-bold">
                    {board.name}
                  </h2>
                  <p className="mt-2 text-xs text-[#7b8476]">
                    {BOARD_TEMPLATE_LABELS[board.template]?.title ?? "لوحة عمل"}{" "}
                    ·{" "}
                    {board.membershipRole === "manager"
                      ? "مدير اللوحة"
                      : board.membershipRole === "viewer"
                        ? "مشاهد"
                        : "عضو"}
                  </p>
                  <p className="mt-4 flex items-center gap-2 text-xs text-[#7b8476]">
                    <Users className="size-4" />
                    {board.members.length} أعضاء
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button
                      disabled={busy}
                      onClick={() => select.mutate({ boardId: board.id })}
                    >
                      فتح اللوحة
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => open("leave", board)}
                      className="gap-2"
                    >
                      <LogOut className="size-4" />
                      مغادرة اللوحة
                    </Button>
                    {board.membershipRole === "manager" && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => open("delete", board)}
                        className="gap-2 text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        <Trash2 className="size-4" />
                        حذف اللوحة
                      </Button>
                    )}
                  </div>
                </section>
              ))}
            </div>
            {!query.data?.boards.length && (
              <div className="rounded-2xl border bg-white p-8 text-center text-sm text-[#737e6c]">
                ليس لديك لوحات حالية. يمكنك إنشاء لوحة جديدة أو استعادة لوحة من
                المحذوفات.
              </div>
            )}
            <section className="mt-10 rounded-2xl border border-[#dfe3da] bg-white p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Trash2 className="size-5 text-[#857063]" />
                اللوحات المحذوفة
              </h2>
              <p className="mt-3 text-xs leading-7 text-[#7b8476]">
                الحذف ينقل اللوحة هنا ويخفيها عن الفريق ويوقف فتحها والانضمام
                إليها. تبقى بياناتها محفوظة، ويمكن لمديرها استعادتها مع الأعضاء
                الحاليين.
              </p>
              {query.data?.deleted.length ? (
                <div className="mt-5 space-y-3">
                  {query.data.deleted.map(board => (
                    <div
                      key={board.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7e9e2] p-4"
                    >
                      <div>
                        <h3 className="font-semibold">{board.name}</h3>
                        <p className="mt-1 text-xs text-[#8a927f]">
                          {board.deletedAt &&
                            new Intl.DateTimeFormat("ar-SA", {
                              dateStyle: "medium",
                              calendar: "gregory",
                              timeZone: "Asia/Riyadh",
                            }).format(board.deletedAt)}
                        </p>
                      </div>
                      <Button
                        disabled={busy}
                        variant="outline"
                        className="gap-2"
                        onClick={() => restore.mutate({ boardId: board.id })}
                      >
                        <RotateCcw className="size-4" />
                        استعادة اللوحة
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#8a927f]">
                  لا توجد لوحات محذوفة تديرها.
                </p>
              )}
            </section>
          </>
        )}
        <Dialog
          open={!!dialog}
          onOpenChange={v => {
            if (!v && !busy) setDialog(null);
          }}
        >
          <DialogContent
            dir="rtl"
            className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
          >
            <DialogHeader>
              <DialogTitle>
                {dialog?.kind === "delete" ? "حذف اللوحة" : "مغادرة اللوحة"}
              </DialogTitle>
              <DialogDescription>{dialog?.board.name}</DialogDescription>
            </DialogHeader>
            {dialog?.kind === "delete" ? (
              <>
                <p className="text-sm leading-7">
                  ستُحذف اللوحة من قائمة اللوحات لدى جميع أعضائها، ويتوقف الوصول
                  إليها. يمكنك استعادتها من «اللوحات المحذوفة». لن تُحذف
                  بياناتها نهائيًا.
                </p>
                <label className="grid gap-2 text-sm">
                  اكتب اسم اللوحة لتأكيد الحذف
                  <Input
                    value={confirmName}
                    autoComplete="off"
                    onChange={e => setConfirmName(e.target.value)}
                    placeholder={dialog.board.name}
                  />
                </label>
              </>
            ) : (
              <>
                <p className="text-sm leading-7">
                  ستخرج من هذه اللوحة وتتوقف عن الوصول إليها. تبقى أعمال اللوحة
                  وسجل مساهماتك محفوظة لدى الفريق. للعودة ستحتاج رابط دعوة أو
                  رمز انضمام.
                </p>
                {lastManager &&
                  (cannotLeave ? (
                    <p
                      role="alert"
                      className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900"
                    >
                      أنت آخر مدير ولا يوجد عضو يمكنه تولّي الإدارة. يمكنك إلغاء
                      المغادرة وحذف اللوحة إذا لم تعد تحتاجها.
                    </p>
                  ) : (
                    <label className="grid gap-2 text-sm">
                      اختر عضوًا يتولى إدارة اللوحة
                      <select
                        aria-label="المدير الجديد"
                        className="rounded-lg border bg-white p-3"
                        value={successor}
                        onChange={e => setSuccessor(e.target.value)}
                      >
                        <option value="">اختر عضوًا</option>
                        {successors.map(m => (
                          <option key={m.userId} value={m.userId}>
                            {m.name ?? "عضو"}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs leading-6 text-[#7b8476]">
                        عند تأكيد المغادرة، يصبح هذا العضو مديرًا ويستطيع إدارة
                        اللوحة وجميع مشروعاتها.
                      </span>
                    </label>
                  ))}
              </>
            )}
            <div className="mt-2 flex flex-wrap gap-3">
              <Button
                disabled={
                  busy ||
                  (dialog?.kind === "delete"
                    ? confirmName !== dialog.board.name
                    : cannotLeave || (!!lastManager && !successor))
                }
                variant={dialog?.kind === "delete" ? "destructive" : "default"}
                onClick={() => {
                  if (!dialog) return;
                  if (dialog.kind === "delete")
                    remove.mutate({ boardId: dialog.board.id, confirmName });
                  else
                    leave.mutate({
                      boardId: dialog.board.id,
                      successorUserId: successor
                        ? Number(successor)
                        : undefined,
                    });
                }}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : dialog?.kind === "delete" ? (
                  "تأكيد حذف اللوحة"
                ) : (
                  "تأكيد المغادرة"
                )}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                إلغاء
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
