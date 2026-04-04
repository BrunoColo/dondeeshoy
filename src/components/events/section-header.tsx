import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  count: number;
  showPulseDot?: boolean;
  className?: string;
  accent: {
    iconWrap: string;
    icon: string;
    title: string;
    subtitle: string;
    badge: string;
  };
}

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  count,
  showPulseDot = false,
  className,
  accent,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-[0_0_20px_rgba(15,23,42,0.12)]", accent.iconWrap)}>
          <Icon className={cn("h-4 w-4", accent.icon)} strokeWidth={2.4} />
        </div>

        <div className="min-w-0">
          <h2 className={cn("text-[12px] font-bold uppercase tracking-[0.15em]", accent.title)}>
            {title}
          </h2>
          <p className={cn("mt-1 text-[11px]", accent.subtitle)}>
            {subtitle}
          </p>
        </div>
      </div>

      <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide inline-flex items-center gap-1.5", accent.badge)}>
        {showPulseDot && <span className="live-dot shrink-0" style={{ width: 6, height: 6 }} />}
        {count} {count === 1 ? "evento" : "eventos"}
      </span>
    </div>
  );
}