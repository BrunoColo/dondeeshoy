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
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
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
      <div className="mb-6 pt-4 fade-up">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet/20 to-neon-magenta/10 border border-neon-violet/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
              <Zap className="h-4.5 w-4.5 text-neon-violet drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] bg-gradient-to-r from-neon-violet to-neon-magenta bg-clip-text text-transparent">
                HOY
              </p>
              <p className="text-[13px] font-medium text-muted-foreground capitalize">
                {dateLabel}
              </p>
            </div>
          </div>

          {events.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              <span className="text-[11px] font-bold text-emerald-400">
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
