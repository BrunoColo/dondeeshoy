import { EventSkeleton } from "@/components/events/event-skeleton";

export default function Loading() {
  return (
    <div className="pt-4">
      {/* Header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="skeleton h-9 w-9 rounded-xl" />
        <div className="space-y-1.5">
          <div className="skeleton h-2.5 w-16 rounded" />
          <div className="skeleton h-3.5 w-44 rounded" />
        </div>
      </div>

      {/* Time filter skeleton */}
      <div className="mb-3 flex gap-2 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Filter chips skeleton */}
      <div className="mb-5 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>

      <div className="space-y-8">
        <div>
          <div className="skeleton mb-3 h-4 w-40 rounded" />
          <EventSkeleton count={2} />
        </div>
        <div>
          <div className="skeleton mb-3 h-4 w-48 rounded" />
          <EventSkeleton count={2} />
        </div>
      </div>
    </div>
  );
}
