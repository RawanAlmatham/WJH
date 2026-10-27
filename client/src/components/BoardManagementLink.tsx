import { Settings2 } from "lucide-react";
export default function BoardManagementLink({
  dark = false,
}: {
  dark?: boolean;
}) {
  return (
    <a
      href="/boards"
      className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-3 text-xs ${dark ? "border-white/20 text-white/80 hover:bg-white/10" : "border-[#dce2d5] bg-white text-[#425744] hover:bg-[#f3f6ef]"}`}
    >
      <Settings2 className="size-4" />
      إدارة اللوحات
    </a>
  );
}
