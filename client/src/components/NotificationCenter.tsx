import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function notificationTime(value: string | Date) {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(date);
}

export function NotificationCenter({
  onOpenLink,
}: {
  onOpenLink: (link: string) => void;
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const utils = trpc.useUtils();
  const query = trpc.workspace.notifications.useQuery(
    { unreadOnly },
    { refetchInterval: 30_000, refetchOnWindowFocus: true }
  );
  const refresh = () => utils.workspace.notifications.invalidate();
  const markRead = trpc.workspace.markNotificationRead.useMutation({
    onSuccess: refresh,
  });
  const markAll = trpc.workspace.markAllNotificationsRead.useMutation({
    onSuccess: refresh,
  });
  const unreadCount = query.data?.unreadCount ?? 0;
  const items = query.data?.items ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`الإشعارات${unreadCount ? `، ${unreadCount} غير مقروء` : ""}`}
          className="relative flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#5A5570] transition hover:bg-slate-50"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -left-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-5 text-white">
              {unreadCount > 99 ? "+99" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        align="start"
        sideOffset={8}
        className="w-[min(92vw,410px)] overflow-hidden rounded-xl border-slate-200 p-0 shadow-xl"
      >
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#22273A]">الإشعارات</h2>
              <p className="mt-1 text-[11px] text-[#6D6279]">
                {unreadCount
                  ? `${unreadCount} إشعار غير مقروء`
                  : "لا توجد تحديثات جديدة"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7A4CCF] disabled:opacity-50"
              >
                <CheckCheck className="size-4" />
                تحديد الكل كمقروء
              </button>
            )}
          </div>
          <div className="mt-3 flex w-fit rounded-lg bg-slate-100 p-1 text-xs">
            {[
              [false, "الكل"],
              [true, "غير المقروء"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setUnreadOnly(Boolean(value))}
                className={cn(
                  "rounded-md px-3 py-1.5",
                  unreadOnly === value
                    ? "bg-white font-semibold text-[#7A4CCF] shadow-sm"
                    : "text-slate-500"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[min(62vh,520px)] overflow-y-auto overscroll-contain">
          {query.isLoading ? (
            <p className="px-4 py-12 text-center text-xs text-slate-400">
              جارٍ تحميل الإشعارات...
            </p>
          ) : items.length ? (
            items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!item.readAt) markRead.mutate({ id: item.id });
                  onOpenLink(item.link);
                }}
                className={cn(
                  "relative block w-full border-b border-slate-100 px-4 py-3.5 text-right transition last:border-0 hover:bg-slate-50",
                  !item.readAt && "bg-[#F6F3FF]"
                )}
              >
                {!item.readAt && (
                  <span className="absolute right-1.5 top-5 size-1.5 rounded-full bg-[#7A4CCF]" />
                )}
                <p className="text-sm font-semibold text-[#3F3A52]">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#615A74]">
                  {item.message}
                  {item.occurrenceCount > 1 &&
                    ` · ${item.occurrenceCount} تحديثات`}
                </p>
                <p className="mt-2 text-[10px] text-[#9089A2]">
                  {notificationTime(item.updatedAt)}
                  {item.actorName ? ` · بواسطة ${item.actorName}` : ""}
                </p>
              </button>
            ))
          ) : (
            <div className="px-6 py-14 text-center">
              <Inbox className="mx-auto size-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-[#5A5570]">
                {unreadOnly
                  ? "لا توجد إشعارات غير مقروءة"
                  : "لا توجد إشعارات بعد"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#9089A2]">
                ستظهر هنا التحديثات التي تخصك عند حدوثها.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
