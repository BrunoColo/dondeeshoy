import { cn } from "@/lib/utils";
import { getTimeStatus, type TimeStatus } from "@/lib/format";

interface TimeBadgeProps {
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  eventDate: string;
  className?: string;
}

function getBadgeStyles(status: TimeStatus) {
  switch (status.type) {
    case "now":
      return {
        text: "AHORA",
        containerClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
        dotClass: "live-dot",
        showDot: true,
      };
    case "soon":
      return {
        text: status.label,
        containerClass: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
        dotClass: "",
        showDot: false,
      };
    case "later":
      return {
        text: status.label,
        containerClass: "bg-white/5 text-slate-300 border border-white/8",
        dotClass: "",
        showDot: false,
      };
    default:
      return null;
  }
}

export function TimeBadge({ startTime, endTime, eventDate, className }: TimeBadgeProps) {
  const status = getTimeStatus(startTime, endTime, eventDate);
  const styles = getBadgeStyles(status);

  if (!styles) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-medium",
        styles.containerClass,
        className,
      )}
    >
      {styles.showDot && <span className={styles.dotClass} />}
      {styles.text}
    </span>
  );
}
