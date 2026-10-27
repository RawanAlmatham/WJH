import { useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { useAuth } from "@/_core/hooks/useAuth";
import { BrandLogo } from "@/components/Brand";
import BoardAssistant from "@/components/BoardAssistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  businessData,
  businessLabels,
  businessStatuses,
  businessTotals,
  projectStages,
  type BusinessRecord,
  type BusinessData,
  type BusinessKind,
} from "@shared/business";
import {
  LayoutDashboard,
  Wallet,
  Boxes,
  Truck,
  FolderOpen,
  ListTodo,
  Lightbulb,
  Plus,
  Search,
  Pencil,
  Archive,
  ArrowUpLeft,
  ChevronDown,
  Menu,
  X,
  Users,
  Loader2,
  Paperclip,
  Download,
  RotateCcw,
  Check,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
type Props = {
  user: { id: number; name?: string | null };
  board: {
    id: number;
    name: string;
    joinCode: string;
    inviteToken: string;
    membershipRole: string;
  };
  boards: { id: number; name: string }[];
  switchingBoard: boolean;
  onSelectBoard: (id: number) => void;
};
const nav = [
  {
    id: "home",
    label: "نظرة عامة",
    icon: LayoutDashboard,
    description: "ما يحتاج انتباهك، وما يتحرك الآن.",
  },
  {
    id: "money",
    label: "المال",
    icon: Wallet,
    description: "ما دخل، وما صُرف، وما التزمت به.",
  },
  {
    id: "projects",
    label: "المنتجات والمشروعات",
    icon: Boxes,
    description: "مرحلة واضحة، ومسؤول، وخطوة تالية.",
  },
  {
    id: "supply",
    label: "الموردون والمشتريات",
    icon: Truck,
    description: "قارن العروض، وتابع الطلب حتى الاستلام.",
  },
  {
    id: "docs",
    label: "التأسيس والوثائق",
    icon: FolderOpen,
    description: "المستند الصحيح، وما يحتاج مراجعة أو تجديدًا.",
  },
  {
    id: "tasks",
    label: "المهام العامة",
    icon: ListTodo,
    description: "الأعمال المشتركة خارج المشروعات.",
  },
  {
    id: "ideas",
    label: "بنك الأفكار",
    icon: Lightbulb,
    description: "احفظ الفكرة، وقرر ما يستحق التجربة.",
  },
];
const typeLabel = {
  imported: "منتج مستورد",
  technical: "منتج تقني",
  other: "فكرة أخرى",
};
const currency = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);
const dateLabel = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("ar-SA", {
        day: "numeric",
        month: "long",
        calendar: "gregory",
        timeZone: "Asia/Riyadh",
      }).format(new Date(s + "T12:00:00Z"))
    : "دون موعد";
const btn =
  "rounded-xl bg-[#205844] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#174735] disabled:opacity-50";
const select =
  "w-full rounded-xl border border-[#dfe5df] bg-white px-3 py-2.5 text-sm";
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e3e7e0] bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#254b3d]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({
  text = "لا توجد سجلات بعد. أضف أول سجل للبدء.",
}: {
  text?: string;
}) {
  return (
    <p className="py-8 text-center text-sm leading-7 text-[#7b8279]">{text}</p>
  );
}
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-lg bg-[#edf2e9] px-2.5 py-1 text-xs text-[#536c53]">
      {children}
    </span>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm text-[#3f5147]">
      {label}
      {children}
    </label>
  );
}
export default function BusinessBoard({
  user,
  board,
  boards,
  switchingBoard,
  onSelectBoard,
}: Props) {
  const utils = trpc.useUtils();
  const { logout } = useAuth();
  const isMobile = useIsMobile();
  const query = trpc.business.overview.useQuery({ boardId: board.id });
  const [page, setPage] = useState("home"),
    [mobile, setMobile] = useState(false),
    [tab, setTab] = useState("supplier"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("الكل"),
    [projectId, setProjectId] = useState<number | null>(null),
    [compareProject, setCompareProject] = useState(""),
    [team, setTeam] = useState(false);
  const [editor, setEditor] = useState<{
    kind: BusinessKind;
    record?: BusinessRecord;
    initial?: Partial<BusinessData>;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    row: BusinessRecord;
    action: "archive" | "settle" | "reimburse";
  } | null>(null);
  const rows = query.data?.records ?? [],
    active = rows.filter(r => !r.archived),
    members = query.data?.members ?? [],
    today = query.data?.today ?? "";
  const canEdit = board.membershipRole !== "viewer";
  const refresh = async () => {
    await utils.business.overview.invalidate({ boardId: board.id });
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const save = trpc.business.save.useMutation({
    onSuccess: async () => {
      setEditor(null);
      await refresh();
      toast.success("تم الحفظ");
    },
    onError,
  });
  const action = trpc.business.action.useMutation({
    onSuccess: async (result, variables) => {
      setConfirm(null);
      await refresh();
      if (variables.action === "convert") {
        setProjectId(result.id);
        setPage("projects");
      }
      toast.success("تم التحديث");
    },
    onError,
  });
  const pending = save.isPending || action.isPending;
  const act = (
    row: BusinessRecord,
    kind: "archive" | "restore" | "convert" | "settle" | "reimburse"
  ) =>
    action.mutate({
      boardId: board.id,
      id: row.id,
      version: row.version,
      action: kind,
    });
  const newItem = (kind: BusinessKind, initial: Partial<BusinessData> = {}) =>
    setEditor({
      kind,
      initial: {
        assigneeUserId: user.id,
        ...(projectId ? { projectId } : {}),
        ...initial,
      },
    });
  const edit = (row: BusinessRecord) =>
    setEditor({ kind: row.kind, record: row });
  const get = (kind: BusinessKind) => active.filter(r => r.kind === kind);
  const name = (id: number | null) =>
    members.find(m => m.userId === id)?.name ?? (id ? "عضو" : "مشتركة");
  const projectName = (id: number | null) =>
    rows.find(r => r.id === id && r.kind === "project")?.data.title ??
    "عمل عام";
  const list = (kind: BusinessKind) =>
    get(kind).filter(
      r =>
        (!projectId || r.data.projectId === projectId) &&
        `${r.data.title} ${r.data.notes} ${r.data.contact}`.includes(search)
    );
  const navigate = (id: string) => {
    setPage(id);
    setProjectId(null);
    setSearch("");
    setFilter("الكل");
    setMobile(false);
  };
  const config = nav.find(n => n.id === page);
  const total = businessTotals(rows);
  const smallAdd = (kind: BusinessKind, initial: Partial<BusinessData> = {}) =>
    canEdit ? (
      <button
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[#205844] hover:bg-[#edf2e9]"
        onClick={() => newItem(kind, initial)}
      >
        <Plus className="size-4" />
        {businessLabels[kind]}
      </button>
    ) : null;
  const tools = (row: BusinessRecord) =>
    canEdit ? (
      <div className="flex items-center gap-1">
        <button
          aria-label={`تعديل ${row.data.title}`}
          className="rounded-lg p-2 text-[#7e8b80] hover:bg-[#edf2e9]"
          onClick={() => edit(row)}
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          aria-label={`أرشفة ${row.data.title}`}
          className="rounded-lg p-2 text-[#a17e70] hover:bg-[#faf0e7]"
          onClick={() => setConfirm({ row, action: "archive" })}
        >
          <Archive className="size-3.5" />
        </button>
      </div>
    ) : null;
  const update = (row: BusinessRecord, patch: Partial<BusinessData>) =>
    save.mutate({
      boardId: board.id,
      id: row.id,
      version: row.version,
      kind: row.kind,
      data: { ...row.data, ...patch },
    });
  const statusSelect = (row: BusinessRecord) => (
    <select
      aria-label={`حالة ${row.data.title}`}
      disabled={!canEdit || pending}
      className="rounded-lg border-0 bg-[#f3f6f1] p-2 text-xs"
      value={row.data.status}
      onChange={e => update(row, { status: e.target.value })}
    >
      {(row.kind === "project"
        ? projectStages[row.data.type]
        : businessStatuses[row.kind]
      )
        .filter(
          s =>
            row.kind !== "idea" ||
            s !== "تحولت إلى مشروع" ||
            !!row.convertedProjectId
        )
        .map(s => (
          <option key={s}>{s}</option>
        ))}
    </select>
  );
  const fileLink = (row: BusinessRecord) =>
    row.data.fileId ? (
      <button
        className="inline-flex items-center gap-1 text-xs text-[#205844] underline"
        onClick={async () => {
          try {
            const file = await utils.business.download.fetch({
              boardId: board.id,
              id: row.data.fileId!,
            });
            const bytes = Uint8Array.from(atob(file.body), c =>
              c.charCodeAt(0)
            );
            const url = URL.createObjectURL(
              new Blob([bytes], { type: file.mime })
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = file.name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } catch (e) {
            onError(e as Error);
          }
        }}
      >
        <Download className="size-3.5" />
        {row.data.fileName || "تنزيل المرفق"}
      </button>
    ) : null;
  function taskCard(row: BusinessRecord) {
    return (
      <article
        key={row.id}
        className="rounded-xl border border-[#e6eae2] bg-white p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <label className="flex items-start gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="mt-1 accent-[#205844]"
              checked={row.data.status === "مكتملة"}
              disabled={!canEdit || pending}
              onChange={e =>
                update(row, { status: e.target.checked ? "مكتملة" : "قادمة" })
              }
            />
            <span
              className={
                row.data.status === "مكتملة"
                  ? "text-[#859083] line-through"
                  : ""
              }
            >
              {row.data.title}
            </span>
          </label>
          {tools(row)}
        </div>
        {row.data.projectId && (
          <p className="mt-2 text-xs text-[#869080]">
            {projectName(row.data.projectId)}
          </p>
        )}
        <div className="my-3 flex flex-wrap gap-2 text-xs text-[#7b8279]">
          <span>{name(row.data.assigneeUserId)}</span>
          {row.data.priority === "urgent" && <Badge>عالية</Badge>}
          <span
            className={
              row.data.dueDate &&
              row.data.dueDate < today &&
              row.data.status !== "مكتملة"
                ? "text-red-700"
                : ""
            }
          >
            {dateLabel(row.data.dueDate)}
          </span>
          {row.data.recurrence !== "none" && (
            <span>
              {row.data.recurrence === "weekly" ? "أسبوعيًا" : "شهريًا"}
            </span>
          )}
        </div>
        {row.data.notes && (
          <p className="mb-3 whitespace-pre-wrap text-xs leading-6 text-[#7b8279]">
            {row.data.notes}
          </p>
        )}
        {statusSelect(row)}
      </article>
    );
  }
  function cards(kind: BusinessKind, items = list(kind)) {
    return items.length ? (
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(row => (
          <article
            key={row.id}
            className="rounded-2xl border border-[#e3e7e0] bg-white p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge>
                {["idea", "project"].includes(kind)
                  ? typeLabel[row.data.type]
                  : row.data.status}
              </Badge>
              {tools(row)}
            </div>
            {kind === "idea" && (
              <Lightbulb className="mt-4 size-6 text-[#99aa86]" />
            )}
            <h3 className="mt-3 text-lg font-semibold text-[#254b3d]">
              {kind === "project" ? (
                <button
                  className="text-right hover:underline"
                  onClick={() => {
                    setProjectId(row.id);
                    setSearch("");
                  }}
                >
                  {row.data.title}
                </button>
              ) : (
                row.data.title
              )}
            </h3>
            {row.data.notes && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#899084]">
                {row.data.notes}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#899084]">
              <span>{name(row.data.assigneeUserId)}</span>
              <Badge>{row.data.status}</Badge>
            </div>
            {kind === "project" && (
              <p className="mt-4 text-sm">
                المصروف حتى الآن{" "}
                <strong>
                  {currency(
                    get("expense")
                      .filter(e => e.data.projectId === row.id)
                      .reduce((s, e) => s + e.data.amount, 0)
                  )}{" "}
                  ريال
                </strong>
              </p>
            )}
            {row.data.contact && (
              <p className="mt-3 break-all text-sm text-[#7b8279]" dir="auto">
                {row.data.contact}
              </p>
            )}
            {row.data.nextStep && (
              <div className="mt-4 rounded-xl bg-[#f6f8f2] p-3">
                <p className="mb-2 text-[11px] text-[#909a85]">
                  {kind === "idea"
                    ? "خطوة التحقق"
                    : kind === "order"
                      ? "المتابعة القادمة"
                      : "الخطوة التالية"}
                </p>
                <p className="text-sm leading-6">{row.data.nextStep}</p>
              </div>
            )}
            {row.data.dueDate && (
              <p className="mt-3 text-xs text-[#7b8279]">
                {dateLabel(row.data.dueDate)}
              </p>
            )}
            {fileLink(row)}
            {row.data.reference && (
              <a
                className="mt-3 block text-sm text-[#205844] underline"
                href={row.data.reference}
                target="_blank"
                rel="noopener noreferrer"
              >
                الرابط المرجعي
              </a>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9ece6] pt-4">
              {statusSelect(row)}
              {kind === "idea" && canEdit && (
                <button
                  disabled={pending || !!row.convertedProjectId}
                  className="flex items-center gap-1 text-xs text-[#205844] disabled:opacity-50"
                  onClick={() => act(row, "convert")}
                >
                  <ArrowUpLeft className="size-4" />
                  {row.convertedProjectId ? "تم التحويل" : "تحويل إلى مشروع"}
                </button>
              )}
              {kind === "supplier" && canEdit && (
                <button
                  className="text-xs text-[#205844]"
                  onClick={() =>
                    newItem("order", {
                      supplierId: row.id,
                      projectId: row.data.projectId,
                    })
                  }
                >
                  طلب جديد
                </button>
              )}
              {kind === "project" && (
                <button
                  className="text-xs text-[#205844]"
                  onClick={() => {
                    setProjectId(row.id);
                    setSearch("");
                  }}
                >
                  فتح المشروع ←
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    ) : (
      <Empty />
    );
  }
  function expenseTable(items = list("expense")) {
    return items.length ? (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-sm">
          <thead className="bg-[#f7f8f4] text-xs text-[#87917f]">
            <tr>
              {[
                "البند",
                "مرتبط بـ",
                "دفعت بواسطة",
                "المبلغ · ريال",
                "الإيصال",
                "الإجراءات",
              ].map(t => (
                <th className="px-3 py-3 font-medium" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className="border-b border-[#edf0e9]">
                <td className="px-3 py-4">
                  {r.data.title}
                  <span className="mt-1 block text-xs text-[#90998a]">
                    {dateLabel(r.data.date)}
                  </span>
                </td>
                <td className="px-3 py-4 text-xs">
                  {projectName(r.data.projectId)}
                </td>
                <td className="px-3 py-4 text-xs">
                  {r.data.payerUserId ? name(r.data.payerUserId) : "حساب العمل"}
                  {r.data.payerUserId && (
                    <span className="mt-2 block">
                      {r.data.reimbursed ? (
                        "تم التعويض"
                      ) : canEdit ? (
                        <button
                          disabled={pending}
                          className="text-[#205844] underline"
                          onClick={() =>
                            setConfirm({ row: r, action: "reimburse" })
                          }
                        >
                          تسجيل التعويض
                        </button>
                      ) : (
                        "بانتظار التعويض"
                      )}
                    </span>
                  )}
                </td>
                <td className="px-3 py-4 tabular-nums">
                  {currency(r.data.amount)}
                </td>
                <td className="px-3 py-4">{fileLink(r)}</td>
                <td>{tools(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty />
    );
  }
  const searchBar = (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute right-3 top-3 size-4 text-[#94a18c]" />
      <Input
        aria-label="بحث في القسم"
        placeholder="بحث سريع"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="rounded-xl border-[#e3e7e0] bg-white pr-9"
      />
    </div>
  );
  const filters = (values: string[]) => (
    <div className="flex flex-wrap gap-2">
      {values.map(v => (
        <button
          key={v}
          aria-pressed={filter === v}
          onClick={() => setFilter(v)}
          className={`rounded-lg border px-3 py-2 text-xs ${filter === v ? "border-[#d7e2d3] bg-[#eaf1e8] text-[#205844]" : "border-[#e6e9e1] bg-white text-[#7e8878]"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
  const filtered = (kind: BusinessKind) =>
    list(kind).filter(
      r =>
        filter === "الكل" ||
        r.data.status === filter ||
        typeLabel[r.data.type] === filter
    );
  const openProject = rows.find(
    r => r.id === projectId && r.kind === "project"
  );
  return (
    <div dir="rtl" className="min-h-dvh bg-[#f8f7f3] text-[#344c3f]">
      {mobile && (
        <button
          aria-label="إغلاق القائمة"
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        inert={isMobile && !mobile}
        aria-hidden={isMobile && !mobile}
        className={`fixed inset-y-0 right-0 z-40 flex w-60 flex-col overflow-y-auto border-l border-[#e6eae2] bg-[#fdfefa] px-5 py-7 transition-transform md:translate-x-0 ${mobile ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between">
          <BrandLogo />
          <button
            className="md:hidden"
            aria-label="إغلاق القائمة"
            onClick={() => setMobile(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <label className="mb-8 grid gap-2 text-xs text-[#899480]">
          لوحاتي
          <select
            aria-label="اختيار اللوحة"
            className={`${select} text-[#344c3f]`}
            value={board.id}
            disabled={switchingBoard}
            onChange={e => onSelectBoard(Number(e.target.value))}
          >
            {boards.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <span className="mb-4 text-xs text-[#a0aa97]">إدارة الأعمال</span>
        <nav className="space-y-2">
          {nav.map(n => (
            <button
              key={n.id}
              aria-current={page === n.id ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm ${page === n.id ? "bg-[#eaf1e8] font-semibold text-[#205844]" : "text-[#818e7d] hover:bg-[#f2f5ed]"}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon className="size-5 shrink-0" />
              {n.label}
              {n.id === "tasks" && (
                <span className="mr-auto rounded bg-[#dbe7d8] px-1.5 text-xs">
                  {
                    get("task").filter(
                      t => !t.data.projectId && t.data.status !== "مكتملة"
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-[#e6eae2] pt-5">
          <button
            className="flex items-center gap-2 text-sm text-[#7f8e78]"
            onClick={() => {
              setTeam(true);
              setMobile(false);
            }}
          >
            <Users className="size-4" />
            الفريق
          </button>
          <button
            className="flex items-center gap-2 text-sm text-[#7f8e78]"
            onClick={() => navigate("archives")}
          >
            <Archive className="size-4" />
            الأرشيف
          </button>
          <a className="block text-sm text-[#205844]" href="/boards/new">
            ＋ لوحة جديدة
          </a>
          <button
            className="block text-xs text-[#819078]"
            onClick={() => void logout().catch(onError)}
          >
            تسجيل الخروج
          </button>
          <p className="text-xs text-[#a0aa97]">خطوة واحدة، ثم التي تليها.</p>
        </div>
      </aside>
      <div className="md:mr-60">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#e6eae2] bg-[#fdfefa] px-5 py-3 sm:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="فتح القائمة"
              className="md:hidden"
              onClick={() => setMobile(true)}
            >
              <Menu className="size-5" />
            </button>
            <span className="text-sm font-medium">{board.name}</span>
            <span className="hidden text-xs text-[#9aa58f] sm:inline">
              {user.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BoardAssistant
              key={board.id}
              boardId={board.id}
              boardName={board.name}
              canEdit={canEdit}
              onSaved={refresh}
            />
            <button
              aria-label="تحديث البيانات"
              className="rounded-lg p-2 text-[#85917c]"
              onClick={() => void refresh()}
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1520px] px-5 py-8 sm:px-10 sm:py-12">
          <p className="mb-5 text-xs text-[#9ca590]">
            وجهة / إدارة الأعمال / {config?.label ?? "الأرشيف"}
          </p>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              {openProject ? (
                <>
                  <button
                    className="mb-4 flex items-center gap-1 text-xs text-[#7f8e78]"
                    onClick={() => {
                      setProjectId(null);
                      setSearch("");
                    }}
                  >
                    <ArrowRight className="size-3" />
                    جميع المشروعات
                  </button>
                  <h1 className="text-2xl font-bold sm:text-3xl">
                    {openProject.data.title}
                  </h1>
                  <p className="mt-3 text-sm text-[#86917e]">
                    {name(openProject.data.assigneeUserId)} ·{" "}
                    {typeLabel[openProject.data.type]}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {page === "home"
                      ? "الصورة كاملة"
                      : (config?.label ?? "الأرشيف")}
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-[#899480]">
                    {config?.description ??
                      "سجلات محفوظة يمكنك استعادتها في أي وقت."}
                  </p>
                </>
              )}
            </div>
            {canEdit && page !== "home" && page !== "archives" && (
              <button
                className={`${btn} flex items-center gap-2`}
                onClick={() =>
                  openProject
                    ? edit(openProject)
                    : newItem(
                        (
                          {
                            money: "expense",
                            projects: "project",
                            supply: tab === "order" ? "order" : "supplier",
                            docs: "document",
                            tasks: "task",
                            ideas: "idea",
                          } as Record<string, BusinessKind>
                        )[page]
                      )
                }
              >
                <Plus className="size-4" />
                {openProject
                  ? "تعديل المشروع"
                  : page === "ideas"
                    ? "حفظ فكرة"
                    : `إضافة ${businessLabels[({ money: "expense", projects: "project", supply: tab === "order" ? "order" : "supplier", docs: "document", tasks: "task", ideas: "idea" } as Record<string, BusinessKind>)[page]]}`}
              </button>
            )}
          </div>
          {query.isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto size-6 animate-spin" />
            </div>
          ) : query.error ? (
            <div role="alert" className="rounded-xl border bg-white p-6">
              {query.error.message}
              <Button
                variant="outline"
                className="mr-3"
                onClick={() => void refresh()}
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            <>
              {page === "home" && (
                <>
                  <div className="mb-7 grid gap-4 sm:grid-cols-3">
                    {[
                      [
                        "الرصيد الحالي · ريال",
                        currency(total.balance),
                        "بعد مصروفات الحساب والتعويضات",
                      ],
                      [
                        "الالتزامات القادمة · ريال",
                        currency(total.upcoming),
                        "التزامات قائمة + تعويضات مستحقة",
                      ],
                      [
                        "أعمال نشطة",
                        get("project").filter(p => p.data.status !== "مكتمل")
                          .length,
                        "منتجات ومشروعات قيد العمل",
                      ],
                    ].map(([title, note, hint]) => (
                      <Panel key={String(title)} title={String(title)}>
                        <p className="text-3xl font-semibold tabular-nums">
                          {note}
                        </p>
                        <p className="mt-2 text-xs text-[#9aa58e]">{hint}</p>
                      </Panel>
                    ))}
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Panel
                      title="يحتاج قرار الفريق"
                      action={smallAdd("decision")}
                    >
                      {get("decision")
                        .filter(d => d.data.status !== "معتمد")
                        .map(r => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-3 border-b border-[#edf0e9] py-4"
                          >
                            <div>
                              <p className="text-sm">{r.data.title}</p>
                              <p className="mt-1 text-xs text-[#98a28d]">
                                {projectName(r.data.projectId)}
                              </p>
                            </div>
                            {canEdit && (
                              <button
                                disabled={pending}
                                className="text-sm text-[#205844]"
                                onClick={() => update(r, { status: "معتمد" })}
                              >
                                اعتماد
                              </button>
                            )}
                            {tools(r)}
                          </div>
                        ))}
                      {!get("decision").some(
                        r => r.data.status !== "معتمد"
                      ) && <Empty text="لا توجد قرارات تنتظر المراجعة." />}
                      <details className="mt-4 text-xs text-[#8d9984]">
                        <summary>قرارات معتمدة</summary>
                        {get("decision")
                          .filter(r => r.data.status === "معتمد")
                          .map(r => (
                            <div
                              className="mt-3 flex items-center justify-between"
                              key={r.id}
                            >
                              {r.data.title}
                              {tools(r)}
                            </div>
                          ))}
                      </details>
                    </Panel>
                    <Panel
                      title="المواعيد القادمة"
                      action={
                        <button
                          className="text-xs text-[#205844]"
                          onClick={() => navigate("tasks")}
                        >
                          المهام
                        </button>
                      }
                    >
                      {active
                        .filter(
                          r =>
                            [
                              "task",
                              "order",
                              "obligation",
                              "document",
                            ].includes(r.kind) &&
                            r.data.dueDate &&
                            !["مكتملة", "مدفوع", "استلام"].includes(
                              r.data.status
                            )
                        )
                        .sort((a, b) =>
                          a.data.dueDate!.localeCompare(b.data.dueDate!)
                        )
                        .slice(0, 6)
                        .map(r => (
                          <button
                            key={r.id}
                            className="flex w-full items-center gap-4 border-b border-[#edf0e9] py-4 text-right"
                            onClick={() => edit(r)}
                          >
                            <span
                              className={`min-w-20 text-xs ${r.data.dueDate! < today ? "text-red-700" : "text-[#849477]"}`}
                            >
                              {dateLabel(r.data.dueDate)}
                            </span>
                            <span className="text-sm">
                              {r.data.title}
                              <span className="mt-1 block text-xs text-[#9aa58e]">
                                {businessLabels[r.kind]} ·{" "}
                                {name(r.data.assigneeUserId)}
                              </span>
                            </span>
                          </button>
                        ))}
                      {!active.some(
                        r =>
                          ["task", "order", "obligation", "document"].includes(
                            r.kind
                          ) &&
                          r.data.dueDate &&
                          !["مكتملة", "مدفوع", "استلام"].includes(r.data.status)
                      ) && <Empty text="لا توجد مواعيد قادمة." />}
                    </Panel>
                    <div className="lg:col-span-2">
                      <Panel
                        title="ما الذي يتحرك الآن؟"
                        action={
                          <button
                            className="text-xs text-[#205844]"
                            onClick={() => navigate("projects")}
                          >
                            كل المشروعات
                          </button>
                        }
                      >
                        {cards(
                          "project",
                          get("project").filter(r => r.data.status !== "مكتمل")
                        )}
                      </Panel>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="mt-7 flex flex-wrap gap-3">
                      {(["task", "expense", "idea"] as BusinessKind[]).map(
                        k => (
                          <button
                            className="rounded-xl border border-[#dfe5d8] bg-white px-4 py-3 text-sm"
                            key={k}
                            onClick={() => newItem(k)}
                          >
                            ＋ {businessLabels[k]}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
              {page === "money" && (
                <>
                  <div className="mb-7 grid gap-4 sm:grid-cols-3">
                    {[
                      ["رأس المال المدفوع", total.capital],
                      ["المصروفات المدفوعة", total.expenses],
                      ["المتاح بعد الالتزامات", total.available],
                    ].map(([title, value]) => (
                      <Panel title={title + " · ريال"} key={String(title)}>
                        <p className="text-3xl tabular-nums">
                          {currency(Number(value))}
                        </p>
                      </Panel>
                    ))}
                  </div>
                  <div className="mb-6 grid gap-5 lg:grid-cols-2">
                    <Panel
                      title="حساب الفريق"
                      action={smallAdd("contribution")}
                    >
                      {members
                        .filter(m => m.role !== "viewer")
                        .map(m => (
                          <div
                            key={m.userId}
                            className="flex items-center justify-between border-b border-[#edf0e9] py-4 text-sm"
                          >
                            <span>{m.name ?? "عضو"}</span>
                            <span>
                              {currency(
                                rows
                                  .filter(
                                    r =>
                                      r.kind === "contribution" &&
                                      r.data.assigneeUserId === m.userId
                                  )
                                  .reduce((s, r) => s + r.data.amount, 0)
                              )}{" "}
                              ريال
                            </span>
                          </div>
                        ))}
                      <p className="mt-5 text-sm text-[#8a957f]">
                        مصروفات شخصية تحتاج تعويضًا:{" "}
                        {currency(total.reimbursements)} ريال
                      </p>
                      <details className="mt-4 text-xs">
                        <summary>سجل المساهمات</summary>
                        {get("contribution").map(r => (
                          <div
                            key={r.id}
                            className="mt-3 flex items-center justify-between gap-2"
                          >
                            <span>
                              {name(r.data.assigneeUserId)} · {r.data.title} ·{" "}
                              {currency(r.data.amount)}
                            </span>
                            {tools(r)}
                          </div>
                        ))}
                      </details>
                    </Panel>
                    <Panel
                      title="التزامات قادمة"
                      action={smallAdd("obligation")}
                    >
                      {get("obligation").map(r => (
                        <div
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0e9] py-4"
                        >
                          <div>
                            <p className="text-sm">{r.data.title}</p>
                            <p className="mt-2 text-xs text-[#8a957f]">
                              {dateLabel(r.data.dueDate)} ·{" "}
                              {currency(r.data.amount)} ريال · {r.data.status}
                            </p>
                          </div>
                          {canEdit && r.data.status !== "مدفوع" && (
                            <button
                              disabled={pending}
                              onClick={() =>
                                setConfirm({ row: r, action: "settle" })
                              }
                              className="text-xs text-[#205844]"
                            >
                              تسجيل الدفع
                            </button>
                          )}
                          {tools(r)}
                        </div>
                      ))}
                      {!get("obligation").length && <Empty />}
                    </Panel>
                  </div>
                  <Panel title="حركة المصروفات" action={searchBar}>
                    {expenseTable()}
                  </Panel>
                </>
              )}
              {page === "projects" &&
                (openProject ? (
                  <>
                    <div className="mb-6 flex flex-wrap gap-2">
                      {projectStages[openProject.data.type].map((stage, i) => (
                        <button
                          disabled={!canEdit || pending}
                          className={`rounded-xl border px-4 py-3 text-sm ${openProject.data.status === stage ? "border-[#205844] bg-[#eaf1e8]" : "border-[#e1e7da] bg-white"}`}
                          key={stage}
                          onClick={() => update(openProject, { status: stage })}
                        >
                          {i + 1} · {stage}
                        </button>
                      ))}
                    </div>
                    {openProject.data.nextStep && (
                      <div className="mb-6 rounded-xl bg-[#edf2e7] p-5">
                        <p className="mb-2 text-xs text-[#8b977d]">
                          الخطوة التالية
                        </p>
                        {openProject.data.nextStep}
                      </div>
                    )}
                    <div className="grid gap-5 lg:grid-cols-2">
                      <Panel title="المهام" action={smallAdd("task")}>
                        {list("task").length ? (
                          <div className="space-y-3">
                            {list("task").map(taskCard)}
                          </div>
                        ) : (
                          <Empty />
                        )}
                      </Panel>
                      <Panel title="المصروفات" action={smallAdd("expense")}>
                        {list("expense").map(r => (
                          <div
                            className="flex items-center justify-between gap-2 border-b py-3 text-sm"
                            key={r.id}
                          >
                            <span>{r.data.title}</span>
                            <span>{currency(r.data.amount)} ريال</span>
                            {tools(r)}
                          </div>
                        ))}
                        {!list("expense").length && <Empty />}
                      </Panel>
                      <Panel title="الملفات" action={smallAdd("document")}>
                        {list("document").map(r => (
                          <div
                            key={r.id}
                            className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm"
                          >
                            <span>{r.data.title}</span>
                            {fileLink(r)}
                            {tools(r)}
                          </div>
                        ))}
                        {!list("document").length && <Empty />}
                      </Panel>
                      <Panel title="القرارات" action={smallAdd("decision")}>
                        {list("decision").map(r => (
                          <div
                            className="mb-3 flex items-center justify-between gap-2 text-sm"
                            key={r.id}
                          >
                            <span>{r.data.title}</span>
                            {statusSelect(r)}
                            {tools(r)}
                          </div>
                        ))}
                        {!list("decision").length && <Empty />}
                      </Panel>
                      <Panel title="ملاحظات">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-[#7f8e75]">
                          {openProject.data.notes || "لا توجد ملاحظات بعد."}
                        </p>
                        {fileLink(openProject)}
                      </Panel>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      {searchBar}
                      {filters(["الكل", "منتج مستورد", "منتج تقني", "مكتمل"])}
                    </div>
                    {cards("project", filtered("project"))}
                  </>
                ))}
              {page === "ideas" && (
                <>
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    {searchBar}
                    {filters([
                      "الكل",
                      "منتج مستورد",
                      "منتج تقني",
                      "للنقاش",
                      "قيد التحقق",
                    ])}
                  </div>
                  {cards("idea", filtered("idea"))}
                </>
              )}
              {page === "supply" && (
                <>
                  <div className="mb-6 flex flex-wrap gap-2">
                    {[
                      ["supplier", "الموردون"],
                      ["compare", "مقارنة العروض"],
                      ["order", "الطلبات"],
                    ].map(([id, label]) => (
                      <button
                        className={`rounded-xl border px-4 py-2 text-sm ${tab === id ? "border-[#d6e3d0] bg-[#eaf1e8]" : "border-[#e3e7e0] bg-white"}`}
                        key={id}
                        onClick={() => setTab(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mb-6">{searchBar}</div>
                  {tab !== "compare" ? (
                    cards(tab === "order" ? "order" : "supplier")
                  ) : (
                    <Panel
                      title="مقارنة العروض"
                      action={
                        <select
                          aria-label="المشروع للمقارنة"
                          className={select}
                          value={compareProject}
                          onChange={e => setCompareProject(e.target.value)}
                        >
                          <option value="">كل الموردين</option>
                          {get("project").map(p => (
                            <option key={p.id} value={p.id}>
                              {p.data.title}
                            </option>
                          ))}
                        </select>
                      }
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[450px] text-right text-sm">
                          <thead>
                            <tr>
                              <th className="p-3">المعيار</th>
                              {list("supplier")
                                .filter(
                                  r =>
                                    !compareProject ||
                                    r.data.projectId === Number(compareProject)
                                )
                                .map(s => (
                                  <th className="p-3" key={s.id}>
                                    <button onClick={() => edit(s)}>
                                      {s.data.title}
                                    </button>
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["سعر القطعة · ريال", "unitPrice"],
                              ["الحد الأدنى · قطعة", "minimumQuantity"],
                              ["العينة والشحن · ريال", "sampleCost"],
                              ["مدة التجهيز · أيام", "leadDays"],
                              ["الجودة", "status"],
                            ].map(([label, key]) => (
                              <tr
                                className="border-t border-[#e8ece2]"
                                key={key}
                              >
                                <th className="p-4 text-xs font-normal text-[#87967b]">
                                  {label}
                                </th>
                                {list("supplier")
                                  .filter(
                                    r =>
                                      !compareProject ||
                                      r.data.projectId ===
                                        Number(compareProject)
                                  )
                                  .map(s => (
                                    <td className="p-4" key={s.id}>
                                      {String(
                                        s.data[key as keyof BusinessData]
                                      )}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-4 text-xs leading-7 text-[#8d9983]">
                        جميع الأسعار بالريال. أدخل القيمة المحولة إذا كان العرض
                        بعملة أخرى؛ لا يجري تحويل العملات تلقائيًا.
                      </p>
                    </Panel>
                  )}
                </>
              )}
              {page === "docs" && (
                <>
                  <div className="mb-6 grid gap-5 lg:grid-cols-2">
                    <Panel
                      title="قائمة التأسيس"
                      action={smallAdd("task", {
                        foundation: true,
                        projectId: null,
                      })}
                    >
                      <div className="space-y-3">
                        {get("task")
                          .filter(t => t.data.foundation)
                          .map(taskCard)}
                      </div>
                      {!get("task").some(t => t.data.foundation) && (
                        <Empty text="أضف مهام التأسيس المناسبة لعملك." />
                      )}
                    </Panel>
                    <Panel title="مواعيد التجديد">
                      {get("document")
                        .filter(d => d.data.dueDate)
                        .sort((a, b) =>
                          a.data.dueDate!.localeCompare(b.data.dueDate!)
                        )
                        .map(r => (
                          <button
                            key={r.id}
                            onClick={() => edit(r)}
                            className="mb-4 block text-right text-sm"
                          >
                            {r.data.title} · {dateLabel(r.data.dueDate)}
                          </button>
                        ))}
                      {!get("document").some(d => d.data.dueDate) && (
                        <Empty text="أضف موعد التجديد من تفاصيل المستند." />
                      )}
                    </Panel>
                  </div>
                  <Panel title="ملفات العمل" action={searchBar}>
                    {list("document").length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[500px] text-right text-sm">
                          <thead>
                            <tr>
                              {[
                                "المستند",
                                "مرتبط بـ",
                                "الحالة",
                                "الملف",
                                "إجراءات",
                              ].map(s => (
                                <th
                                  className="p-3 text-xs font-medium text-[#87967b]"
                                  key={s}
                                >
                                  {s}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {list("document").map(r => (
                              <tr
                                className="border-t border-[#e8ece2]"
                                key={r.id}
                              >
                                <td className="p-3">{r.data.title}</td>
                                <td className="p-3 text-xs">
                                  {projectName(r.data.projectId)}
                                </td>
                                <td className="p-3">{statusSelect(r)}</td>
                                <td className="p-3">{fileLink(r)}</td>
                                <td>{tools(r)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty />
                    )}
                  </Panel>
                </>
              )}
              {page === "tasks" && (
                <>
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    {searchBar}
                    {filters([
                      "الكل",
                      ...members
                        .filter(m => m.role !== "viewer")
                        .map(m => m.name ?? "عضو"),
                      "متأخرة",
                    ])}
                  </div>
                  <div className="grid items-start gap-4 lg:grid-cols-3">
                    {businessStatuses.task.map(status => (
                      <Panel
                        key={status}
                        title={status}
                        action={
                          <Badge>
                            {
                              get("task").filter(
                                r =>
                                  !r.data.projectId && r.data.status === status
                              ).length
                            }
                          </Badge>
                        }
                      >
                        <div className="space-y-3">
                          {list("task")
                            .filter(
                              r =>
                                !r.data.projectId &&
                                r.data.status === status &&
                                (filter === "الكل" ||
                                  filter === name(r.data.assigneeUserId) ||
                                  (filter === "متأخرة" &&
                                    !!r.data.dueDate &&
                                    r.data.dueDate < today &&
                                    status !== "مكتملة"))
                            )
                            .map(taskCard)}
                        </div>
                        {status === "قادمة" && (
                          <div className="mt-4">
                            {smallAdd("task", { projectId: null })}
                          </div>
                        )}
                      </Panel>
                    ))}
                  </div>
                  <div className="mt-6">
                    <Panel
                      title="المهام المتكررة"
                      action={smallAdd("task", {
                        recurrence: "weekly",
                        projectId: null,
                      })}
                    >
                      {get("task")
                        .filter(
                          r =>
                            !r.data.projectId &&
                            r.data.recurrence !== "none" &&
                            r.data.status !== "مكتملة"
                        )
                        .map(r => (
                          <button
                            className="mb-3 block text-right text-sm"
                            key={r.id}
                            onClick={() => edit(r)}
                          >
                            {r.data.title} ·{" "}
                            {r.data.recurrence === "weekly"
                              ? "أسبوعيًا"
                              : "شهريًا"}{" "}
                            · {dateLabel(r.data.dueDate)}
                          </button>
                        ))}
                      <p className="mt-3 text-xs leading-7 text-[#8d9983]">
                        عند إنجاز مهمة متكررة، تُنشأ المهمة التالية بتاريخها
                        القادم تلقائيًا.
                      </p>
                    </Panel>
                  </div>
                </>
              )}
              {page === "archives" && (
                <Panel title="السجلات المؤرشفة">
                  <p className="mb-4 text-xs leading-7 text-[#8d9983]">
                    الأرشفة تحفظ السجل. تبقى المبالغ المسجلة ضمن الحسابات
                    المالية حتى لو أُرشف عرضها.
                  </p>
                  {rows
                    .filter(r => r.archived)
                    .map(r => (
                      <div
                        className="flex items-center justify-between gap-3 border-b py-4 text-sm"
                        key={r.id}
                      >
                        <span>
                          {businessLabels[r.kind]} · {r.data.title}
                        </span>
                        {canEdit && (
                          <button
                            disabled={pending}
                            className="flex items-center gap-1 text-[#205844]"
                            onClick={() => act(r, "restore")}
                          >
                            <RotateCcw className="size-4" />
                            استعادة
                          </button>
                        )}
                      </div>
                    ))}
                  {!rows.some(r => r.archived) && (
                    <Empty text="الأرشيف فارغ." />
                  )}
                </Panel>
              )}
            </>
          )}
          <footer className="mt-12 flex justify-between text-xs text-[#a7b19b]">
            <span>لكل طموح، وجهة.</span>
            <span>خطوة واحدة، ثم التي تليها.</span>
          </footer>
        </main>
      </div>
      {editor && (
        <BusinessEditor
          key={`${editor.kind}-${editor.record?.id ?? "new"}`}
          kind={editor.kind}
          record={editor.record}
          initial={editor.initial}
          members={members}
          projects={get("project")}
          suppliers={get("supplier")}
          boardId={board.id}
          canEdit={canEdit}
          pending={save.isPending}
          close={() => setEditor(null)}
          submit={data =>
            save.mutate({
              boardId: board.id,
              id: editor.record?.id,
              version: editor.record?.version,
              kind: editor.kind,
              data,
            })
          }
        />
      )}
      <Dialog
        open={!!confirm}
        onOpenChange={v => {
          if (!v && !action.isPending) setConfirm(null);
        }}
      >
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === "archive"
                ? "أرشفة السجل"
                : confirm?.action === "settle"
                  ? "تسجيل دفع الالتزام"
                  : "تسجيل التعويض"}
            </DialogTitle>
            <DialogDescription>{confirm?.row.data.title}</DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-7">
            {confirm?.action === "archive"
              ? "سينتقل السجل إلى الأرشيف ويمكنك استعادته. تبقى المبالغ ضمن الحسابات المالية."
              : confirm?.action === "settle"
                ? "يُسجل المبلغ كمصروف من حساب العمل ويصبح الالتزام مدفوعًا. هذا تسجيل محاسبي فقط."
                : "يُخصم المبلغ من حساب العمل ويُعلّم المصروف الشخصي بأنه مُعوّض. هذا تسجيل محاسبي فقط."}
          </p>
          <div className="flex gap-3">
            <button
              className={btn}
              disabled={action.isPending}
              onClick={() => confirm && act(confirm.row, confirm.action)}
            >
              تأكيد
            </button>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => setConfirm(null)}
            >
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={team} onOpenChange={setTeam}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>فريق اللوحة</DialogTitle>
            <DialogDescription>
              الأعضاء الذين يمكنهم الوصول إلى هذه المساحة.
            </DialogDescription>
          </DialogHeader>
          {members.map(m => (
            <p className="text-sm" key={m.userId}>
              {m.name ?? "عضو"} ·{" "}
              {m.role === "manager"
                ? "مدير"
                : m.role === "viewer"
                  ? "مشاهد"
                  : "عضو"}
            </p>
          ))}
          {board.membershipRole === "manager" && (
            <div className="rounded-xl border p-4 text-sm">
              <p>
                رمز الانضمام: <span dir="ltr">{board.joinCode}</span>
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/join/${board.inviteToken}`
                  );
                  toast.success("تم نسخ رابط الدعوة");
                }}
              >
                نسخ رابط دعوة الفريق
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type EditorProps = {
  kind: BusinessKind;
  record?: BusinessRecord;
  initial?: Partial<BusinessData>;
  members: { userId: number; name: string | null; role: string }[];
  projects: BusinessRecord[];
  suppliers: BusinessRecord[];
  boardId: number;
  canEdit: boolean;
  pending: boolean;
  close: () => void;
  submit: (data: BusinessData) => void;
};
function BusinessEditor({
  kind,
  record,
  initial,
  members,
  projects,
  suppliers,
  boardId,
  canEdit,
  pending,
  close,
  submit,
}: EditorProps) {
  const [data, setData] = useState<BusinessData>(
    () =>
      record?.data ?? {
        ...businessData.parse({
          title: "جديد",
          ...initial,
          status: businessStatuses[kind][0],
        }),
        title: "",
      }
  );
  const [details, setDetails] = useState(false),
    [file, setFile] = useState<File | null>(null);
  const upload = trpc.business.upload.useMutation();
  const busy = pending || upload.isPending;
  const patch = (value: Partial<BusinessData>) =>
    setData(d => ({ ...d, ...value }));
  const input = (key: keyof BusinessData, label: string, type = "text") => (
    <Field label={label}>
      <Input
        type={type}
        disabled={!canEdit}
        value={String(data[key] ?? "")}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={e =>
          patch({
            [key]:
              type === "number"
                ? Number(e.target.value)
                : e.target.value || (type === "date" ? null : ""),
          })
        }
        className="rounded-xl border-[#dfe5df] bg-white"
      />
    </Field>
  );
  const people = (
    key: "assigneeUserId" | "payerUserId",
    label: string,
    empty = "مشتركة"
  ) => (
    <Field label={label}>
      <select
        disabled={!canEdit}
        className={select}
        value={data[key] ?? ""}
        onChange={e =>
          patch({ [key]: e.target.value ? Number(e.target.value) : null })
        }
      >
        <option value="">{empty}</option>
        {members
          .filter(m => m.role !== "viewer")
          .map(m => (
            <option key={m.userId} value={m.userId}>
              {m.name ?? "عضو"}
            </option>
          ))}
      </select>
    </Field>
  );
  const project = (
    <Field label="مرتبط بمشروع · اختياري">
      <select
        disabled={!canEdit}
        className={select}
        value={data.projectId ?? ""}
        onChange={e =>
          patch({ projectId: e.target.value ? Number(e.target.value) : null })
        }
      >
        <option value="">عمل عام</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>
            {p.data.title}
          </option>
        ))}
      </select>
    </Field>
  );
  const attachment = (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#cbd9c2] p-4 text-sm text-[#7b8c6c]">
        <Paperclip className="size-4" />
        <span>{file?.name || data.fileName || "إرفاق ملف · اختياري"}</span>
        <input
          aria-label="إرفاق ملف"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt,.csv"
          className="sr-only"
          disabled={!canEdit || busy}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f && f.size > 10 * 1024 * 1024) {
              toast.error("الحد الأقصى 10 ميغابايت");
              e.target.value = "";
              return;
            }
            setFile(f ?? null);
          }}
        />
      </label>
      <p className="text-[11px] text-[#8d9983]">
        PDF، صورة، Word أو Excel، وملفات نصية · حتى 10 ميغابايت
      </p>
      {(file || data.fileId) && canEdit && (
        <button
          type="button"
          className="text-xs text-[#9b7464]"
          onClick={() => {
            setFile(null);
            patch({ fileId: null, fileName: "" });
          }}
        >
          إزالة المرفق من السجل
        </button>
      )}
    </div>
  );
  return (
    <Dialog
      open
      onOpenChange={v => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[92dvh] overflow-y-auto bg-[#fafbf7] sm:max-w-lg"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="text-xl text-[#205844]">
            {record ? "تعديل" : "إضافة"} {businessLabels[kind]}
          </DialogTitle>
          <DialogDescription>
            {kind === "idea"
              ? "جملة واحدة تكفي للبداية."
              : "الأساس أولًا، والتفاصيل عند الحاجة."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={async e => {
            e.preventDefault();
            if (!canEdit || busy) return;
            try {
              let value = { ...data };
              if (file) {
                const body = await new Promise<string>((resolve, reject) => {
                  const r = new FileReader();
                  r.onload = () => resolve(String(r.result).split(",")[1]);
                  r.onerror = reject;
                  r.readAsDataURL(file);
                });
                const result = await upload.mutateAsync({
                  boardId,
                  name: file.name,
                  mime:
                    file.type ||
                    ({ csv: "text/csv", txt: "text/plain" }[
                      file.name.split(".").pop() ?? ""
                    ] ??
                      ""),
                  body,
                });
                value = { ...value, fileId: result.id, fileName: result.name };
                patch({ fileId: result.id, fileName: result.name });
                setFile(null);
              }
              submit(value);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "تعذر رفع المرفق");
            }
          }}
        >
          {["expense", "contribution", "obligation"].includes(kind) &&
            input("amount", "المبلغ · ريال *", "number")}
          <Field
            label={
              kind === "task"
                ? "المهمة *"
                : kind === "idea"
                  ? "الفكرة *"
                  : kind === "expense"
                    ? "مقابل ماذا؟ *"
                    : kind === "document"
                      ? "اسم المستند *"
                      : "الاسم *"
            }
          >
            <Input
              autoFocus
              required
              maxLength={240}
              value={data.title}
              disabled={!canEdit}
              onChange={e => patch({ title: e.target.value })}
              className="rounded-xl border-[#dfe5df] bg-white"
            />
          </Field>
          {["idea", "project"].includes(kind) && (
            <div className="flex flex-wrap gap-2">
              {(["imported", "technical", "other"] as const).map(type => (
                <button
                  key={type}
                  disabled={!canEdit}
                  aria-pressed={data.type === type}
                  className={`rounded-xl border px-4 py-2 text-xs ${data.type === type ? "border-[#b8cfae] bg-[#eaf1e8]" : "border-[#dfe5df] bg-white"}`}
                  type="button"
                  onClick={() =>
                    patch({
                      type,
                      ...(kind === "project"
                        ? { status: projectStages[type][0] }
                        : {}),
                    })
                  }
                >
                  {typeLabel[type]}
                </button>
              ))}
            </div>
          )}
          {kind === "supplier" && input("contact", "وسيلة التواصل *")}
          {kind === "expense" &&
            people("payerUserId", "الدفع من", "حساب العمل")}
          {kind === "contribution" &&
            people("assigneeUserId", "صاحب المساهمة *", "اختر عضوًا")}
          {kind === "task" && (
            <>
              {people("assigneeUserId", "المسؤول")}
              {input("dueDate", "الموعد · اختياري", "date")}
            </>
          )}
          {kind === "order" && (
            <Field label="المورد · اختياري">
              <select
                disabled={!canEdit}
                className={select}
                value={data.supplierId ?? ""}
                onChange={e =>
                  patch({
                    supplierId: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">دون مورد محدد</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.data.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {kind === "document" && attachment}
          <button
            type="button"
            aria-expanded={details}
            className="flex w-full items-center justify-between border-y border-[#e3e7dc] py-4 text-sm text-[#7b8c6c]"
            onClick={() => setDetails(!details)}
          >
            تفاصيل إضافية
            <ChevronDown
              className={`size-4 transition ${details ? "rotate-180" : ""}`}
            />
          </button>
          {details && (
            <div className="space-y-5">
              {!["task", "contribution"].includes(kind) &&
                people("assigneeUserId", "المسؤول")}
              {kind !== "project" && project}
              {!["expense", "contribution"].includes(kind) && (
                <Field label="الحالة">
                  <select
                    disabled={
                      !canEdit ||
                      (kind === "obligation" && data.status === "مدفوع")
                    }
                    className={select}
                    value={data.status}
                    onChange={e => patch({ status: e.target.value })}
                  >
                    {(kind === "project"
                      ? projectStages[data.type]
                      : businessStatuses[kind]
                    )
                      .filter(
                        s =>
                          kind !== "obligation" ||
                          s !== "مدفوع" ||
                          data.status === "مدفوع"
                      )
                      .filter(
                        s =>
                          kind !== "idea" ||
                          s !== "تحولت إلى مشروع" ||
                          !!record?.convertedProjectId
                      )
                      .map(s => (
                        <option key={s}>{s}</option>
                      ))}
                  </select>
                </Field>
              )}
              {["project", "order", "idea"].includes(kind) &&
                input(
                  "nextStep",
                  kind === "idea" ? "خطوة التحقق" : "الخطوة التالية"
                )}
              {["order", "obligation", "document"].includes(kind) &&
                input(
                  "dueDate",
                  kind === "document"
                    ? "موعد التجديد · اختياري"
                    : "موعد المتابعة · اختياري",
                  "date"
                )}
              {["expense", "contribution"].includes(kind) &&
                input("date", "التاريخ · اختياري", "date")}
              {kind === "supplier" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {input("unitPrice", "سعر القطعة · ريال", "number")}
                  {input("minimumQuantity", "الحد الأدنى · قطعة", "number")}
                  {input("sampleCost", "العينة والشحن · ريال", "number")}
                  {input("leadDays", "مدة التجهيز · أيام", "number")}
                </div>
              )}
              {kind === "task" && (
                <>
                  <Field label="الأولوية">
                    <select
                      disabled={!canEdit}
                      className={select}
                      value={data.priority}
                      onChange={e =>
                        patch({
                          priority: e.target.value as BusinessData["priority"],
                        })
                      }
                    >
                      <option value="normal">عادية</option>
                      <option value="urgent">عالية</option>
                    </select>
                  </Field>
                  <Field label="التكرار">
                    <select
                      disabled={!canEdit}
                      className={select}
                      value={data.recurrence}
                      onChange={e =>
                        patch({
                          recurrence: e.target
                            .value as BusinessData["recurrence"],
                        })
                      }
                    >
                      <option value="none">دون تكرار</option>
                      <option value="weekly">أسبوعيًا</option>
                      <option value="monthly">شهريًا</option>
                    </select>
                  </Field>
                  <label className="flex gap-2 text-sm">
                    <input
                      disabled={!canEdit}
                      type="checkbox"
                      checked={data.foundation}
                      onChange={e => patch({ foundation: e.target.checked })}
                    />
                    ضمن قائمة التأسيس
                  </label>
                </>
              )}
              {kind === "idea" &&
                input("reference", "رابط مرجعي · اختياري", "url")}
              <Field label="ملاحظات · اختياري">
                <Textarea
                  value={data.notes}
                  maxLength={10000}
                  disabled={!canEdit}
                  onChange={e => patch({ notes: e.target.value })}
                  className="rounded-xl border-[#dfe5df] bg-white"
                />
              </Field>
              {kind !== "document" && attachment}
            </div>
          )}
          {canEdit && (
            <button
              type="submit"
              className={`${btn} flex w-full items-center justify-center gap-2`}
              disabled={busy || !data.title.trim()}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {record ? "حفظ التعديلات" : `حفظ ${businessLabels[kind]}`}
            </button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
