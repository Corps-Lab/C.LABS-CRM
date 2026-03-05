import logoImage from "@/assets/logo.png";
import corpsLogo from "@/assets/corps-logo.png";
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
        <img
          src={corpsLogo}
          alt="Corps Lab"
          className={cn(
            "h-12 w-12 rounded-2xl object-cover shadow-[0_0_24px_rgba(255,122,24,0.35)]",
            iconClassName
          )}
        />
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
