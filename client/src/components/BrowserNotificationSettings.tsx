import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  defaultBrowserNotificationTypes,
  notificationTypeLabels,
  type NotificationType,
} from "@shared/notificationTypes";
import { BellRing, BellOff, CircleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(
    Array.from(raw).map(character => character.charCodeAt(0))
  );
}

export function BrowserNotificationSettings() {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : "denied"
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [enabledTypes, setEnabledTypes] = useState<NotificationType[]>(
    defaultBrowserNotificationTypes
  );
  const config = trpc.workspace.browserPushConfig.useQuery(undefined, {
    enabled: supported,
    retry: false,
  });
  const save = trpc.workspace.saveBrowserPushSubscription.useMutation({
    onSuccess: () => config.refetch(),
  });
  const updateTypes = trpc.workspace.updateBrowserPushTypes.useMutation();
  const remove = trpc.workspace.removeBrowserPushSubscription.useMutation();

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then(registration => registration.pushManager.getSubscription())
      .then(current => setSubscription(current))
      .catch(() => undefined);
  }, [supported]);

  useEffect(() => {
    if (!subscription || !config.data) return;
    const saved = config.data.subscriptions.find(
      item => item.endpoint === subscription.endpoint
    );
    if (saved?.enabledTypes?.length) setEnabledTypes(saved.enabledTypes);
  }, [config.data, subscription]);

  const activeForAccount = useMemo(
    () =>
      Boolean(
        subscription &&
          config.data?.subscriptions.some(
            item => item.endpoint === subscription.endpoint
          )
      ),
    [config.data, subscription]
  );

  const enable = async () => {
    if (!supported || !config.data) return;
    if (Notification.permission === "denied") {
      setPermission("denied");
      return;
    }
    const result =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    const current =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.data.publicKey),
      }));
    const json = current.toJSON();
    if (!json.keys?.p256dh || !json.keys.auth)
      throw new Error("تعذر قراءة مفاتيح اشتراك المتصفح");
    await save.mutateAsync({
      endpoint: current.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      expirationTime: current.expirationTime,
      enabledTypes,
    });
    setSubscription(current);
    toast.success("تم تفعيل إشعارات المتصفح لهذا الحساب");
  };

  const disable = async () => {
    if (!subscription) return;
    await remove.mutateAsync({ endpoint: subscription.endpoint });
    await subscription.unsubscribe();
    setSubscription(null);
    toast.success("تم إيقاف إشعارات المتصفح");
  };

  const toggleType = async (type: NotificationType, enabled: boolean) => {
    const next = enabled
      ? defaultBrowserNotificationTypes.filter(
          candidate => candidate === type || enabledTypes.includes(candidate)
        )
      : enabledTypes.filter(candidate => candidate !== type);
    setEnabledTypes(next);
    if (subscription && activeForAccount)
      await updateTypes.mutateAsync({
        endpoint: subscription.endpoint,
        enabledTypes: next,
      });
  };

  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#26364A]">
            {activeForAccount ? (
              <BellRing className="size-4 text-emerald-600" />
            ) : (
              <BellOff className="size-4 text-slate-400" />
            )}
            إشعارات المتصفح
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-6 text-[#7C8A9A]">
            إشعارات أثر الداخلية تعمل دائمًا. يمكنك تفعيل إشعارات المتصفح لتصلك
            التنبيهات حتى عندما لا تكون الصفحة مفتوحة.
          </p>
        </div>
        {activeForAccount ? (
          <Button
            type="button"
            variant="outline"
            onClick={disable}
            disabled={remove.isPending}
            className="h-9 border-slate-200 text-xs"
          >
            إيقاف إشعارات المتصفح
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() =>
              void enable().catch(error => toast.error(error.message))
            }
            disabled={!supported || config.isLoading || save.isPending}
            className="h-9 bg-[#52769F] text-xs hover:bg-[#46698F]"
          >
            تفعيل إشعارات المتصفح
          </Button>
        )}
      </div>

      {!supported && (
        <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          هذا المتصفح لا يدعم Web Push. ستستمر إشعارات أثر الداخلية بالعمل.
        </div>
      )}
      {supported && permission === "denied" && (
        <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          الإذن مرفوض. افتح إعدادات الموقع في المتصفح، وغيّر «الإشعارات» إلى
          «سماح»، ثم أعد تحميل الصفحة. لن يطلب أثر الإذن مرة أخرى تلقائيًا.
        </div>
      )}
      {activeForAccount && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-semibold text-[#52657A]">
            اختر أنواع إشعارات المتصفح
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {defaultBrowserNotificationTypes.map(type => (
              <label
                key={type}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-[#FCFDFE] px-3 py-2.5 text-xs text-[#52657A]"
              >
                {notificationTypeLabels[type]}
                <Switch
                  checked={enabledTypes.includes(type)}
                  onCheckedChange={checked => void toggleType(type, checked)}
                  aria-label={`إشعارات ${notificationTypeLabels[type]}`}
                  className="data-[state=checked]:bg-[#52769F]"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
