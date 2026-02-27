import { Suspense } from "react";
import { getUpcomingEvents, getFilterOptions, getEventsBetweenDates } from "@/lib/queries";
import { getTomorrowUY, getDateOffsetUY, getWeekendDatesUY } from "@/lib/format";
import { EventSkeleton } from "@/components/events/event-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { EventFilters } from "@/components/events/event-filters";
import { TimeFilter } from "@/components/events/time-filter";
import { ProximosEventsClient } from "@/components/events/proximos-events-client";
import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import type { EventType, EventFilters as Filters } from "@/types/events";

export const revalidate = 300; // ISR: revalidate every 5 minutes

export const metadata: Metadata = {
  title: "Próximos eventos",
};

interface ProximosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function ProximosPage({ searchParams }: ProximosPageProps) {
  return (
    <div>
      <Suspense fallback={<ProximosLoading />}>
        <ProximosContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProximosContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tomorrow = getTomorrowUY();
  const when = typeof params.when === "string" ? params.when : undefined;
  const fechaParam = typeof params.fecha === "string" ? params.fecha : undefined;

  // Parse filters
  const filters: Filters = {};
  if (typeof params.q === "string" && params.q.trim()) filters.q = params.q.trim();
  if (typeof params.type === "string") filters.type = params.type as EventType;
  if (typeof params.genre === "string") filters.genre = params.genre;
  if (typeof params.department === "string") filters.department = params.department;
  if (params.free === "true") filters.free = true;

  const hasFilters = !!(filters.q || filters.type || filters.genre || filters.department || filters.free);

  let grouped: Map<string, Awaited<ReturnType<typeof getEventsBetweenDates>>>;
  let filterRange: { start: string; end: string };
  let subtitle = "Eventos de los próximos días";

  if (when === "fecha" && fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
    const dateEvents = await getEventsBetweenDates(fechaParam, fechaParam, filters);
    grouped = new Map(dateEvents.length > 0 ? [[fechaParam, dateEvents]] : []);
    filterRange = { start: fechaParam, end: fechaParam };
    // Format date for subtitle
    const [y, m, d] = fechaParam.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    subtitle = `Eventos del ${dayNames[dateObj.getDay()]} ${d} de ${monthNames[dateObj.getMonth()]}`;
  } else if (when === "manana") {
    const tomorrowEvents = await getEventsBetweenDates(tomorrow, tomorrow, filters);
    grouped = new Map(tomorrowEvents.length > 0 ? [[tomorrow, tomorrowEvents]] : []);
    filterRange = { start: tomorrow, end: tomorrow };
    subtitle = "Eventos de mañana";
  } else if (when === "finde") {
    const weekend = getWeekendDatesUY();
    const weekendEvents = await getEventsBetweenDates(weekend.start, weekend.end, filters);

    grouped = new Map<string, typeof weekendEvents>();
    for (const event of weekendEvents) {
      if (!grouped.has(event.date)) grouped.set(event.date, []);
      grouped.get(event.date)!.push(event);
    }

    filterRange = { start: weekend.start, end: weekend.end };
    subtitle = "Eventos de este fin de semana";
  } else {
    grouped = await getUpcomingEvents(tomorrow, 14, filters);
    filterRange = { start: tomorrow, end: getDateOffsetUY(15) };
  }

  // 2 queries instead of 4: events + combined filter options
  const filterOptions = await getFilterOptions(undefined, filterRange);

  const { genres, types, departments } = filterOptions;
  const hasEvents = grouped.size > 0;
  const totalCount = hasFilters ? Array.from(grouped.values()).reduce((sum, evts) => sum + evts.length, 0) : undefined;

  return (
    <>
      {/* Page header */}
      <div className="mb-4 pt-4 fade-up">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent-light/10 border border-accent/20 shadow-[0_0_20px_rgba(13,148,136,0.15)]">
            <CalendarDays className="h-4.5 w-4.5 text-accent-light drop-shadow-[0_0_6px_rgba(20,184,166,0.5)]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-accent-light">
              PRÓXIMOS
            </p>
            <p className="text-[13px] font-medium text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Time quick filters */}
      <div className="mb-3 fade-up">
        <TimeFilter />
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
        <ProximosEventsClient
          groups={Array.from(grouped.entries()).map(([date, allDateEvents]) => ({
            date,
            events: allDateEvents.filter((e) => !e.isRecurring),
            recurringEvents: allDateEvents.filter((e) => e.isRecurring),
          }))}
        />
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
