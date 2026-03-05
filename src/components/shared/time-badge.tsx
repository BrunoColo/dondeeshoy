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
        containerClass: "bg-emerald-500/55 text-white border border-emerald-500/60 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
        dotClass: "live-dot",
        showDot: true,
      };
    case "soon":
      return {
        text: status.label,
        containerClass: "bg-amber-500/55 text-white border border-amber-500/60 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
        dotClass: "",
        showDot: false,
      };
    case "later":
      return {
        text: status.label,
        containerClass: "bg-black/50 text-white border border-white/25 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
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
