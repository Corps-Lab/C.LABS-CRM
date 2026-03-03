import logoImage from "@/assets/logo.png";
import { useAgency } from "@/contexts/AgencyContext";
import { cn } from "@/lib/utils";

interface AgencyLogoProps {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}

export function AgencyLogo({
  className,
  iconClassName,
  wordmarkClassName,
  showWordmark = true,
}: AgencyLogoProps) {
  const { currentAgency } = useAgency();

  if (currentAgency.id === "corps") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff8a1d]/40 bg-[linear-gradient(145deg,#ff8a1d_0%,#ff6a00_100%)] shadow-[0_0_24px_rgba(255,122,24,0.35)]",
            iconClassName
          )}
        >
          <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
            <path
              d="M18 20c5-6 14-9 22-7 7 2 12 7 14 14"
              fill="none"
              stroke="#050505"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M46 44c-5 6-14 9-22 7-7-2-12-7-14-14"
              fill="none"
              stroke="#050505"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M17 33c2-8 9-14 18-15 8-1 16 2 21 9"
              fill="none"
              stroke="#050505"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
        </div>
        {showWordmark && (
          <div className={cn("leading-none", wordmarkClassName)}>
            <div className="text-sm font-black tracking-[0.35em] text-[#ff8a1d]">CORPS</div>
            <div className="mt-1 text-[10px] font-semibold tracking-[0.28em] text-white/70">
              AGENCY
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoImage}
        alt="C.LABS"
        className={cn("h-12 w-12 object-contain", iconClassName)}
      />
      {showWordmark && (
        <div className={cn("leading-none", wordmarkClassName)}>
          <div className="text-sm font-black tracking-[0.3em] text-primary">C.LABS</div>
          <div className="mt-1 text-[10px] font-semibold tracking-[0.28em] text-white/70">
            CRM
          </div>
        </div>
      )}
    </div>
  );
}
