import { cn } from "@/lib/utils";
import type { EventType } from "@/types/events";

const TYPE_LABELS: Record<EventType, string> = {
  fiesta: "Fiesta",
  festival: "Festival",
  recital: "Recital",
  club: "Club",
  bar: "Bar",
  teatro: "Teatro",
  otro: "Evento",
};

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
      {TYPE_LABELS[type]}
    </span>
  );
}
