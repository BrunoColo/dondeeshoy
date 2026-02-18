import { EventSkeleton } from "@/components/events/event-skeleton";

/**
 * Shown by Next.js App Router while the page is loading (navigation between routes).
 * Provides instant visual feedback instead of a blank screen.
 */
export default function Loading() {
  return (
    <div className="pt-4">
      {/* Header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="skeleton h-9 w-9 rounded-xl" />
        <div className="space-y-1.5">
          <div className="skeleton h-2.5 w-12 rounded" />
          <div className="skeleton h-3.5 w-40 rounded" />
        </div>
      </div>

      {/* Filter chips skeleton */}
      <div className="mb-5 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>

      <EventSkeleton count={6} />
    </div>
  );
}
