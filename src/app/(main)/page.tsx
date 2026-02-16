import { Suspense } from "react";
import { getEventsByDate } from "@/lib/queries";
import { getTodayUY, formatDateES } from "@/lib/format";
import { EventList } from "@/components/events/event-list";
import { EventSkeleton } from "@/components/events/event-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Zap } from "lucide-react";

export const revalidate = 3600; // ISR: revalidate every hour

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      <Suspense fallback={<HomeLoading />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}

async function HomeContent() {
  const today = getTodayUY();
  const events = await getEventsByDate(today);
  const dateLabel = formatDateES(today);

  return (
    <>
      {/* Date header */}
      <div className="mb-5 pt-4 fade-up">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-violet/10">
              <Zap className="h-4 w-4 text-neon-violet" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-violet">
                HOY
              </p>
              <p className="text-[13px] font-medium text-muted-foreground capitalize">
                {dateLabel}
              </p>
            </div>
          </div>

          {events.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1">
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              <span className="text-[11px] font-semibold text-emerald-400">
                {events.length} {events.length === 1 ? "evento" : "eventos"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Events list or empty state */}
      {events.length > 0 ? (
        <EventList events={events} />
      ) : (
        <EmptyState variant="today" />
      )}
    </>
  );
}

function HomeLoading() {
  return (
    <div className="pt-4">
      {/* Date header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <div className="skeleton h-2.5 w-10 rounded" />
          <div className="skeleton h-3.5 w-36 rounded" />
        </div>
      </div>

      <EventSkeleton count={4} />
    </div>
  );
}
