/**
 * Skeleton shown while the event detail page loads.
 */
export default function Loading() {
  return (
    <div className="fade-up">
      {/* Hero image skeleton */}
      <div className="skeleton h-64 sm:h-80 md:h-96 rounded-none" />

      {/* Content */}
      <div className="relative -mt-6 rounded-t-3xl bg-background px-5 pt-6 pb-8">
        {/* Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>

        {/* Title */}
        <div className="space-y-2 mb-6">
          <div className="skeleton h-7 w-3/4 rounded" />
          <div className="skeleton h-7 w-1/2 rounded" />
        </div>

        {/* Info cards */}
        <div className="space-y-4">
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
