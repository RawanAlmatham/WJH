import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  mono = false,
}: {
  className?: string;
  mono?: boolean;
}) {
  return (
    <img
      src={mono ? "/brand/wjh-symbol-white.svg" : "/brand/wjh-symbol.svg"}
      alt=""
      aria-hidden="true"
      width="320"
      height="300"
      className={cn("brand-mark size-10 shrink-0 object-contain", className)}
    />
  );
}

export function BrandLogo({
  className,
  light = false,
  tagline = false,
}: {
  className?: string;
  light?: boolean;
  tagline?: boolean;
}) {
  return (
    <span
      className={cn(
        "brand-logo inline-flex items-center gap-3",
        light ? "text-white" : "text-[#1F2328]",
        className
      )}
      dir="rtl"
      aria-label="وجهة"
    >
      <BrandMark />
      <span>
        <span className="brand-wordmark block text-[1.9rem] font-bold leading-none tracking-[-.07em]">
          وجهة
        </span>
        {tagline && (
          <span
            className={cn(
              "mt-2 block text-[10px] font-medium",
              light ? "text-white/75" : "text-[#62635F]"
            )}
          >
            لكل طموح، وجهة.
          </span>
        )}
      </span>
    </span>
  );
}

/** A decorative extension of the logo, never mirrored in RTL layouts. */
export function BrandJourney({ className }: { className?: string }) {
  return (
    <div
      className={cn("brand-journey", className)}
      aria-hidden="true"
      dir="ltr"
    >
      <div className="brand-journey-orbit" />
      <BrandMark className="brand-journey-symbol" />
      <span className="brand-journey-label brand-journey-start">فكرة</span>
      <span className="brand-journey-label brand-journey-finish">وجهة</span>
    </div>
  );
}
