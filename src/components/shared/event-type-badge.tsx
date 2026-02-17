import { cn } from "@/lib/utils";
import type { EventType } from "@/types/events";
import { EVENT_TYPE_LABELS } from "@/types/events";

interface EventTypeBadgeProps {
  type: EventType;
  className?: string;
  size?: "sm" | "md";
}

export function EventTypeBadge({ type, className, size = "sm" }: EventTypeBadgeProps) {
  return (
    <span
      className={cn(
        `badge-${type}`,
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wider",
        size === "sm" && "px-2.5 py-0.5 text-[10px]",
        size === "md" && "px-3 py-1 text-xs",
        className,
      )}
    >
      {EVENT_TYPE_LABELS[type]}
    </span>
  );
}
