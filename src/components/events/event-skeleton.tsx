import { cn } from "@/lib/utils";

interface EventSkeletonProps {
  count?: number;
  className?: string;
}

function SingleSkeleton() {
  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      {/* Image area */}
      <div className="skeleton h-44 sm:h-52 rounded-none" />

      {/* Bottom info */}
      <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-3">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-3 w-14 rounded" />
      </div>
    </div>
  );
}

export function EventSkeleton({ count = 3, className }: EventSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SingleSkeleton key={i} />
      ))}
    </div>
  );
}
