import { Suspense } from "react";
import { getUpcomingEvents } from "@/lib/queries";
import { getTomorrowUY, formatDateES, getDateLabel } from "@/lib/format";
import { EventList } from "@/components/events/event-list";
import { EventSkeleton } from "@/components/events/event-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Próximos eventos",
};

export default function ProximosPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      <Suspense fallback={<ProximosLoading />}>
        <ProximosContent />
      </Suspense>
    </div>
  );
}

async function ProximosContent() {
  const tomorrow = getTomorrowUY();
  const grouped = await getUpcomingEvents(tomorrow, 14);

  const hasEvents = grouped.size > 0;

  return (
    <>
      {/* Page header */}
      <div className="mb-5 pt-4 fade-up">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-cyan/10">
            <CalendarDays className="h-4 w-4 text-neon-cyan" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-cyan">
              PRÓXIMOS
            </p>
            <p className="text-[13px] font-medium text-muted-foreground">
              Eventos de los próximos días
            </p>
          </div>
        </div>
      </div>

      {hasEvents ? (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([date, events]) => {
            const { label, isTomorrow } = getDateLabel(date);

            return (
              <section key={date} className="fade-up">
                {/* Date group header */}
                <div className="mb-3 flex items-center gap-2.5">
                  {isTomorrow && (
                    <span className="rounded-md bg-neon-amber/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-amber border border-neon-amber/20">
                      Mañana
                    </span>
                  )}
                  <h2 className="font-display text-sm font-semibold text-muted-foreground capitalize">
                    {isTomorrow ? formatDateES(date) : label}
                  </h2>
                  <span className="text-[11px] text-text-muted">
                    ({events.length})
                  </span>
                </div>

                <EventList events={events} />
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState variant="upcoming" />
      )}
    </>
  );
}

function ProximosLoading() {
  return (
    <div className="pt-4">
      <div className="mb-5 flex items-center gap-3">
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <div className="skeleton h-2.5 w-16 rounded" />
          <div className="skeleton h-3.5 w-44 rounded" />
        </div>
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
