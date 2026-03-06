"use client";

import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Ticket, X, Check, Moon } from "lucide-react";
import type { EventType } from "@/types/events";
import { EVENT_TYPE_LABELS } from "@/types/events";

interface EventFiltersProps {
  /** Available event types to show as filter chips */
  availableTypes?: EventType[];
  /** Available genres to show as filter chips */
  availableGenres?: string[];
  /** Available departments/cities to show as filter chips */
  availableDepartments?: string[];
  /** Total results count (shown when filters are active) */
  resultCount?: number;
  className?: string;
}

// Chip color classes matching existing badge-* CSS
const TYPE_CHIP_STYLES: Record<EventType, { bg: string; activeBg: string; text: string }> = {
  fiesta: { bg: "bg-orange-500/15 border-orange-500/35", activeBg: "bg-orange-500/30 border-orange-400/60", text: "text-orange-300" },
  festival: { bg: "bg-pink-500/15 border-pink-500/35", activeBg: "bg-pink-500/30 border-pink-400/60", text: "text-pink-300" },
  concierto: { bg: "bg-sky-500/15 border-sky-500/35", activeBg: "bg-sky-500/30 border-sky-400/60", text: "text-sky-300" },
  recital: { bg: "bg-cyan-500/15 border-cyan-500/35", activeBg: "bg-cyan-500/30 border-cyan-400/60", text: "text-cyan-300" },
  cultural: { bg: "bg-indigo-500/15 border-indigo-500/35", activeBg: "bg-indigo-500/30 border-indigo-400/60", text: "text-indigo-300" },
  deportivo: { bg: "bg-green-500/15 border-green-500/35", activeBg: "bg-green-500/30 border-green-400/60", text: "text-green-300" },
  gastronomico: { bg: "bg-teal-500/15 border-teal-500/35", activeBg: "bg-teal-500/30 border-teal-400/60", text: "text-teal-300" },
  familiar: { bg: "bg-emerald-500/15 border-emerald-500/35", activeBg: "bg-emerald-500/30 border-emerald-400/60", text: "text-emerald-300" },
  feria: { bg: "bg-rose-500/15 border-rose-500/35", activeBg: "bg-rose-500/30 border-rose-400/60", text: "text-rose-300" },
  taller: { bg: "bg-teal-500/15 border-teal-500/35", activeBg: "bg-teal-500/30 border-teal-400/60", text: "text-teal-300" },
  club: { bg: "bg-blue-500/15 border-blue-500/35", activeBg: "bg-blue-500/30 border-blue-400/60", text: "text-blue-300" },
  bar: { bg: "bg-amber-500/15 border-amber-500/35", activeBg: "bg-amber-500/30 border-amber-400/60", text: "text-amber-300" },
  teatro: { bg: "bg-lime-500/15 border-lime-500/35", activeBg: "bg-lime-500/30 border-lime-400/60", text: "text-lime-300" },
  otro: { bg: "bg-slate-500/15 border-slate-500/35", activeBg: "bg-slate-500/30 border-slate-400/60", text: "text-slate-300" },
};

export function EventFilters({
  availableTypes = [],
  availableGenres = [],
  availableDepartments = [],
  resultCount,
  className,
}: EventFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeType = searchParams.get("type") as EventType | null;
  const activeGenre = searchParams.get("genre");
  const activeDepartment = searchParams.get("department");
  const activeFree = searchParams.get("free") === "true";
  const activeNight = searchParams.get("night") === "true";
  const activeSearch = searchParams.get("q");

  const hasActiveFilters = !!(activeType || activeGenre || activeDepartment || activeFree || activeNight || activeSearch);

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams, startTransition],
  );

  const clearAllFilters = useCallback(() => {
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  }, [router, pathname, startTransition]);

  const toggleType = (type: EventType) => {
    updateFilter("type", activeType === type ? null : type);
  };

  const toggleGenre = (genre: string) => {
    updateFilter("genre", activeGenre === genre ? null : genre);
  };

  const toggleDepartment = (department: string) => {
    updateFilter("department", activeDepartment === department ? null : department);
  };

  const toggleFree = () => {
    updateFilter("free", activeFree ? null : "true");
  };

  const toggleNight = () => {
    updateFilter("night", activeNight ? null : "true");
  };

  return (
    <div className={cn("space-y-3", isPending && "opacity-60 transition-opacity", className)}>
      {/* Type chips row */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {/* Free chip */}
        <button
          onClick={toggleFree}
          aria-pressed={activeFree}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
            activeFree
              ? "bg-amber-500/30 border-amber-400/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/40"
              : "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/55",
          )}
        >
          {activeFree && <Check className="h-3 w-3" strokeWidth={2.8} />}
          <Ticket className="h-3 w-3" strokeWidth={2.5} />
          Gratis
        </button>

        {/* Night chip */}
        <button
          onClick={toggleNight}
          aria-pressed={activeNight}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
            activeNight
              ? "bg-indigo-500/30 border-indigo-400/60 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400/40"
              : "bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25 hover:border-indigo-400/55",
          )}
        >
          {activeNight && <Check className="h-3 w-3" strokeWidth={2.8} />}
          <Moon className="h-3 w-3" strokeWidth={2.5} />
          Noche
        </button>

        {/* Divider */}
        {availableTypes.length > 0 && (
          <div className="shrink-0 w-px bg-white/[0.06] my-1" />
        )}

        {/* Event type chips */}
        {availableTypes.map((type) => {
          const style = TYPE_CHIP_STYLES[type];
          const isActive = activeType === type;

          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              aria-pressed={isActive}
              className={cn(
                "shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
                isActive
                  ? cn(style.activeBg, style.text, "shadow-sm ring-1 ring-white/25")
                  : cn(style.bg, style.text, "hover:brightness-125"),
              )}
            >
              {isActive && <Check className="mr-1 h-3 w-3" strokeWidth={2.8} />}
              {EVENT_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      {/* Department chips row (Uruguay departments/cities from data) */}
      {availableDepartments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {availableDepartments.map((department) => {
            const isActive = activeDepartment === department;
            return (
              <button
                key={department}
                onClick={() => toggleDepartment(department)}
                aria-pressed={isActive}
                className={cn(
                  "shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-accent/25 border-accent/55 text-accent-light shadow-[0_0_12px_rgba(13,148,136,0.22)] ring-1 ring-accent/30"
                    : "bg-white/[0.07] border-white/[0.18] text-[#CBD5E1] hover:border-accent/35 hover:text-white hover:bg-white/[0.10]",
                )}
              >
                {isActive && <Check className="mr-1 h-3 w-3" strokeWidth={2.8} />}
                {department}
              </button>
            );
          })}
        </div>
      )}

      {/* Active filter indicator + clear */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[12px] text-muted-foreground">
            {resultCount !== undefined && (
              <>
                <span className="font-semibold text-foreground">{resultCount}</span>
                {" "}{resultCount === 1 ? "resultado" : "resultados"}
              </>
            )}
          </p>
          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] border border-white/[0.20] px-2.5 py-1 text-[11px] font-medium text-[#CBD5E1] hover:text-white hover:border-white/[0.35] hover:bg-white/[0.12] transition-all duration-200 cursor-pointer"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
