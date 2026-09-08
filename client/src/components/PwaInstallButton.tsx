import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null
  );
  const [installed, setInstalled] = useState(false);
  const isAppleMobile =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    const savePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", savePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", savePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (installed || Capacitor.isNativePlatform()) return null;

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
      return;
    }

    if (isAppleMobile) {
      toast.message("لتثبيت أثر على الآيفون", {
        description:
          "اضغطي زر المشاركة في Safari ثم اختاري «إضافة إلى الشاشة الرئيسية».",
        duration: 8000,
      });
      return;
    }

    toast.message("تثبيت تطبيق أثر", {
      description:
        "افتحي قائمة المتصفح واختاري «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",
      duration: 8000,
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={install}
      className={cn(
        "gap-2 border-[#BFD3E7] bg-white text-[#45698F]",
        className
      )}
    >
      {isAppleMobile ? (
        <Share2 className="size-4" />
      ) : (
        <Download className="size-4" />
      )}
      {compact ? "تثبيت التطبيق" : "تثبيت أثر كتطبيق"}
    </Button>
  );
}
