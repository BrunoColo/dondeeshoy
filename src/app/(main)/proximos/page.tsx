import { Suspense } from "react";
import { getUpcomingEvents, getFilterOptions } from "@/lib/queries";
import { getTomorrowUY, formatDateES, getDateLabel, getDateOffsetUY } from "@/lib/format";
import { EventList } from "@/components/events/event-list";
import { EventSkeleton } from "@/components/events/event-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { EventFilters } from "@/components/events/event-filters";
import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import type { EventType, EventFilters as Filters } from "@/types/events";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Próximos eventos",
};

interface ProximosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function ProximosPage({ searchParams }: ProximosPageProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <Suspense fallback={<ProximosLoading />}>
        <ProximosContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProximosContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tomorrow = getTomorrowUY();

  // Parse filters
  const filters: Filters = {};
  if (typeof params.q === "string" && params.q.trim()) filters.q = params.q.trim();
  if (typeof params.type === "string") filters.type = params.type as EventType;
  if (typeof params.genre === "string") filters.genre = params.genre;
  if (typeof params.department === "string") filters.department = params.department;
  if (params.free === "true") filters.free = true;

  const hasFilters = !!(filters.q || filters.type || filters.genre || filters.department || filters.free);

  // 2 queries instead of 4: events + combined filter options
  const [grouped, filterOptions] = await Promise.all([
    getUpcomingEvents(tomorrow, 14, filters),
    getFilterOptions(undefined, { start: tomorrow, end: getDateOffsetUY(15) }),
  ]);

  const { genres, types, departments } = filterOptions;
  const hasEvents = grouped.size > 0;
  const totalCount = hasFilters ? Array.from(grouped.values()).reduce((sum, evts) => sum + evts.length, 0) : undefined;

  return (
    <>
      {/* Page header */}
      <div className="mb-4 pt-4 fade-up">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-blue/10 border border-neon-cyan/20 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <CalendarDays className="h-4.5 w-4.5 text-neon-cyan drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] bg-gradient-to-r from-neon-cyan to-neon-blue bg-clip-text text-transparent">
              PRÓXIMOS
            </p>
            <p className="text-[13px] font-medium text-muted-foreground">
              Eventos de los próximos días
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 fade-up">
        <EventFilters
          availableTypes={types}
          availableGenres={genres}
          availableDepartments={departments}
          resultCount={totalCount}
        />
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
        <EmptyState variant={hasFilters ? "search" : "upcoming"} />
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

      {/* Filter skeleton */}
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
