import { Suspense } from "react";
import { getEventsByDate, getFilterOptions, getHourlyTrendingEvents } from "@/lib/queries";
import { getTodayUY, formatDateES } from "@/lib/format";
import { EventSkeleton } from "@/components/events/event-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { EventFilters } from "@/components/events/event-filters";
import { HomeEventsClient } from "@/components/events/home-events-client";
import { Zap } from "lucide-react";
import type { EventType, EventFilters as Filters } from "@/types/events";

export const revalidate = 300; // ISR: revalidate every 5 minutes

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function HomePage({ searchParams }: HomePageProps) {
  return (
    <div id="top">
      <Suspense fallback={<HomeLoading />}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function HomeContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const today = getTodayUY();
  const dateLabel = formatDateES(today);

  // Parse filters from search params
  const filters: Filters = {};
  if (typeof params.q === "string" && params.q.trim()) filters.q = params.q.trim();
  if (typeof params.type === "string") filters.type = params.type as EventType;
  if (typeof params.genre === "string") filters.genre = params.genre;
  if (typeof params.department === "string") filters.department = params.department;
  if (params.free === "true") filters.free = true;
  if (params.night === "true") filters.night = true;

  const hasFilters = !!(filters.q || filters.type || filters.genre || filters.department || filters.free || filters.night);

  // Fetch events + filter options + trending in parallel (3 queries instead of 5)
  const [allEvents, filterOptions, trending] = await Promise.all([
    getEventsByDate(today, filters),
    getFilterOptions(today),
    hasFilters ? Promise.resolve([]) : getHourlyTrendingEvents(today, 3),
  ]);

  // Separate recurring (daily/weekly) from unique (one-time) events
  const events = allEvents.filter((e) => !e.isRecurring);
  const recurringEvents = allEvents.filter((e) => e.isRecurring);

  const { genres, types, departments } = filterOptions;

  // Build set of trending IDs for badge display
  const trendingIds = trending.map((e) => e.id);

  return (
    <>
      {/* Hero tagline */}
      <section className="pt-4 pb-2 fade-up">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white-light">
          Descubrí Uruguay
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-[30px] font-extrabold leading-tight">
          <span className="bg-[linear-gradient(90deg,#8B5CF6_0%,#A78BFA_28%,#C4B5FD_52%,#A78BFA_76%,#8B5CF6_100%)] bg-[length:220%_auto] bg-clip-text text-transparent animate-[text-shimmer_4.4s_linear_infinite]">
            Donde comienza tu próxima salida
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] sm:text-sm text-[#CBD5E1]">
          Todo lo que pasa en Uruguay, en un solo lugar: conciertos, ferias, teatro, deporte y más.
        </p>
      </section>

      {/* Date header */}
      <div className="mb-4 pt-4 fade-up">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 to-fuchsia-400/10 shadow-[0_0_20px_rgba(139,92,246,0.18)] glow-pulse">
              <Zap className="h-4.5 w-4.5 text-violet-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.45)]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-300">
                HOY
              </p>
              <p className="text-[13px] font-medium text-[#CBD5E1] capitalize">
                {dateLabel}
              </p>
            </div>
          </div>

{allEvents.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 whitespace-nowrap">
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              <span className="text-[11px] font-bold text-emerald-400">
                {events.length > 0 ? (
                  <>
                    {events.length} {events.length === 1 ? "evento" : "eventos"}
                    {recurringEvents.length > 0 && (
                      <span className="text-text-muted font-normal"> + {recurringEvents.length} recurrentes</span>
                    )}
                  </>
                ) : (
                  <>{recurringEvents.length} recurrentes</>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 fade-up">
        <EventFilters
          availableTypes={types}
          availableGenres={genres}
          availableDepartments={departments}
          resultCount={hasFilters ? allEvents.length : undefined}
        />
      </div>

      {/* Client wrapper: Nearby button + Trending + Events + Recurring */}
      <HomeEventsClient
        events={events}
        recurringEvents={recurringEvents}
        trending={trending}
        trendingIds={trendingIds}
        hasFilters={hasFilters}
      />

      {/* Global empty state only when there are truly no events at all */}
      {events.length === 0 && recurringEvents.length === 0 && (
        <div className="mt-6">
          <EmptyState variant={hasFilters ? "search" : "today"} />
        </div>
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

      {/* Filter skeleton */}
      <div className="mb-5 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>

      <EventSkeleton count={4} />
    </div>
  );
}
