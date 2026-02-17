import { Suspense } from "react";
import { getEventsByDate, getActiveGenres, getActiveEventTypes, getTrendingEvents, getActiveDepartments } from "@/lib/queries";
import { getTodayUY, formatDateES } from "@/lib/format";
import { EventList } from "@/components/events/event-list";
import { EventSkeleton } from "@/components/events/event-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { EventFilters } from "@/components/events/event-filters";
import { Zap, Flame } from "lucide-react";
import type { EventType, EventFilters as Filters } from "@/types/events";

export const revalidate = 3600; // ISR: revalidate every hour

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function HomePage({ searchParams }: HomePageProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
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

  const hasFilters = !!(filters.q || filters.type || filters.genre || filters.department || filters.free);

  // Fetch events, genres, types, and trending in parallel
  const [events, genres, types, departments, trending] = await Promise.all([
    getEventsByDate(today, filters),
    getActiveGenres(today),
    getActiveEventTypes(today),
    getActiveDepartments(today),
    hasFilters ? Promise.resolve([]) : getTrendingEvents(today, 3),
  ]);

  // Build set of trending IDs for badge display
  const trendingIds = new Set(trending.map((e) => e.id));

  return (
    <>
      {/* Date header */}
      <div className="mb-4 pt-4 fade-up">
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

      {/* Filters */}
      <div className="mb-5 fade-up">
        <EventFilters
          availableTypes={types}
          availableGenres={genres}
          availableDepartments={departments}
          resultCount={hasFilters ? events.length : undefined}
        />
      </div>

      {/* Trending section (only when no filters active) */}
      {trending.length > 0 && !hasFilters && (
        <div className="mb-6 fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.5)]" strokeWidth={2.5} />
            <h2 className="text-[12px] font-bold uppercase tracking-[0.15em] text-orange-400">
              Trending
            </h2>
          </div>
          <EventList events={trending} trendingIds={trendingIds} />
        </div>
      )}

      {/* Events list or empty state */}
      {events.length > 0 ? (
        <EventList events={events} trendingIds={trendingIds} />
      ) : (
        <EmptyState variant={hasFilters ? "search" : "today"} />
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
