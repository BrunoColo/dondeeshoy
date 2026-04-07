"use client";

import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Filter } from "lucide-react";
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
  extraClearKeys?: string[];
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
  extraClearKeys = [],
  className,
}: EventFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [mobileSheet, setMobileSheet] = useState<"type" | "department" | null>(null);
  const isClient = typeof window !== "undefined";

  const activeType = searchParams.get("type") as EventType | null;
  const activeGenre = searchParams.get("genre");
  const activeDepartment = searchParams.get("department");
  const activeFree = searchParams.get("free") === "true";
  const activeNight = searchParams.get("night") === "true";
  const activeNear = searchParams.get("near") === "true";
  const activeSearch = searchParams.get("q");
  const hasActiveExtraFilters = extraClearKeys.some((key) => {
    const value = searchParams.get(key);
    return value !== null && value !== "";
  });

  const hasActiveFilters = !!(activeType || activeGenre || activeDepartment || activeFree || activeNight || activeNear || activeSearch || hasActiveExtraFilters);

  const activeFilterLabels: string[] = [];
  if (activeFree) activeFilterLabels.push("Gratis");
  if (activeNight) activeFilterLabels.push("Noche");
  if (activeNear) activeFilterLabels.push("Cerca de mí");
  if (activeType) activeFilterLabels.push(EVENT_TYPE_LABELS[activeType]);
  if (activeGenre) activeFilterLabels.push(`Género: ${activeGenre}`);
  if (activeDepartment) activeFilterLabels.push(activeDepartment);
  if (activeSearch) activeFilterLabels.push(`"${activeSearch}"`);

  const activeWhen = searchParams.get("when");
  const activeFecha = searchParams.get("fecha");
  if (activeWhen === "manana") activeFilterLabels.push("Mañana");
  if (activeWhen === "finde") activeFilterLabels.push("Finde");
  if (activeWhen === "fecha" && activeFecha) activeFilterLabels.push(`Fecha: ${activeFecha}`);

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

  const toggleNear = () => {
    updateFilter("near", activeNear ? null : "true");
  };

  const sortedDepartments = useMemo(
    () => {
      const sorted = [...new Set(availableDepartments)].sort((a, b) => a.localeCompare(b, "es"));
      const montevideoIndex = sorted.indexOf("Montevideo");
      if (montevideoIndex > 0) {
        sorted.splice(montevideoIndex, 1);
        sorted.unshift("Montevideo");
      }
      return sorted;
    },
    [availableDepartments],
  );

  const orderedTypes = useMemo(() => {
    const unique = Array.from(new Set(availableTypes));
    return unique.sort((a, b) => {
      if (a === "otro") return 1;
      if (b === "otro") return -1;
      return 0;
    });
  }, [availableTypes]);

  useEffect(() => {
    if (!mobileSheet || !isClient) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileSheet(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileSheet, isClient]);

  return (
    <div className={cn("space-y-3", isPending && "opacity-60 transition-opacity", className)}>
      {/* Mobile compact row */}
      <div className="sm:hidden -mx-4 px-4 space-y-3">
        <div className="flex flex-wrap gap-2">
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
            Gratis
          </button>

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
            Noche
          </button>

          <button
            onClick={() => setMobileSheet("type")}
            aria-haspopup="dialog"
            aria-expanded={mobileSheet === "type"}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
              activeType
                ? "bg-violet-500/28 border-violet-300/70 text-violet-100 shadow-[0_0_16px_rgba(139,92,246,0.35)] ring-1 ring-violet-300/45"
                : "bg-violet-500/18 border-violet-400/45 text-violet-200 hover:bg-violet-500/28 hover:border-violet-300/65 hover:text-violet-100",
            )}
          >
            {activeType ? EVENT_TYPE_LABELS[activeType] : "Tipo de Evento"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMobileSheet("department")}
            aria-haspopup="dialog"
            aria-expanded={mobileSheet === "department"}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
              activeDepartment
                ? "bg-sky-500/24 border-sky-300/62 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.28)] ring-1 ring-sky-300/38"
                : "bg-sky-500/14 border-sky-400/45 text-sky-200 hover:bg-sky-500/24 hover:border-sky-300/65 hover:text-sky-100",
            )}
          >
            {activeDepartment ?? "Departamento"}
          </button>

          <button
            type="button"
            onClick={toggleNear}
            aria-pressed={activeNear}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
              activeNear
                ? "bg-accent/25 border-accent/55 text-accent-light shadow-[0_0_12px_rgba(13,148,136,0.25)] ring-1 ring-accent/30"
                : "bg-white/[0.08] border-white/[0.22] text-[#CBD5E1] hover:border-accent/40 hover:text-white hover:bg-white/[0.12]",
            )}
          >
            Cerca de mí
          </button>
        </div>
      </div>

      {/* Desktop chips row */}
      <div className="hidden sm:flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
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
          Noche
        </button>

        {/* Divider */}
        {orderedTypes.length > 0 && (
          <div className="shrink-0 w-px bg-white/[0.06] my-1" />
        )}

        {/* Event type chips */}
        {orderedTypes.map((type) => {
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
              {EVENT_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      {/* Department chips row (Uruguay departments/cities from data) */}
      {availableDepartments.length > 0 && (
        <div className="hidden sm:flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {sortedDepartments.map((department) => {
            const isActive = activeDepartment === department;
            return (
              <button
                key={department}
                onClick={() => toggleDepartment(department)}
                aria-pressed={isActive}
                className={cn(
                  "shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-accent/25 border-accent/55 text-accent-light shadow-[0_0_12px_rgba(13,148,136,0.22)] ring-1 ring-accent/30"
                    : "bg-white/[0.07] border-white/[0.18] text-[#CBD5E1] hover:border-accent/35 hover:text-white hover:bg-white/[0.10]",
                )}
              >
                {department}
              </button>
            );
          })}
        </div>
      )}

      {/* Nearby row */}
      <div className="hidden sm:flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        <button
          type="button"
          onClick={toggleNear}
          aria-pressed={activeNear}
          className={cn(
            "shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
            activeNear
              ? "bg-accent/25 border-accent/55 text-accent-light shadow-[0_0_12px_rgba(13,148,136,0.25)] ring-1 ring-accent/30"
              : "bg-white/[0.08] border-white/[0.22] text-[#CBD5E1] hover:border-accent/40 hover:text-white hover:bg-white/[0.12]",
          )}
        >
          Cerca de mí
        </button>
      </div>

      {/* Active filter indicator + clear */}
      {hasActiveFilters && (
        <div className="pt-1 space-y-2">
          <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2">
            <p className="flex items-start gap-1.5 text-[11px] text-[#CBD5E1] leading-relaxed">
              <Filter className="h-3.5 w-3.5 mt-0.5 text-[#A7B4FF] shrink-0" strokeWidth={2.2} />
              <span>
                {resultCount !== undefined ? (
                  <>
                    <span className="font-semibold text-white">{resultCount}</span>{" "}
                    {resultCount === 1 ? "resultado" : "resultados"} filtrados por:{" "}
                    <span className="text-[#A7F3D0]">{activeFilterLabels.join(" · ") || "filtros activos"}</span>
                  </>
                ) : (
                  <>
                    Filtrado por <span className="text-[#A7F3D0]">{activeFilterLabels.join(" · ") || "filtros activos"}</span>
                  </>
                )}
              </span>
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] border border-white/[0.20] px-2.5 py-1 text-[11px] font-medium text-[#CBD5E1] hover:text-white hover:border-white/[0.35] hover:bg-white/[0.12] transition-all duration-200 cursor-pointer"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Mobile sheets */}
      {isClient && mobileSheet && createPortal(
        <div
          className="sm:hidden fixed inset-0 z-[2000] flex items-end bg-[rgba(3,6,14,0.72)] backdrop-blur-sm"
          onClick={() => setMobileSheet(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full rounded-t-3xl border border-white/[0.14] bg-[linear-gradient(180deg,rgba(10,14,28,0.98)_0%,rgba(6,9,18,0.98)_100%)] shadow-[0_-24px_60px_rgba(0,0,0,0.5)] pb-2"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-3 pb-2 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <p className="text-[12px] uppercase tracking-[0.16em] font-semibold text-[#94A3B8]">
                  {mobileSheet === "type" ? "Filtrar por tipo" : "Filtrar por departamento"}
                </p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Tocá una opción para aplicar al instante
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheet(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-[#B8C5D6] hover:text-white hover:bg-white/[0.1] transition-colors"
                aria-label="Cerrar selector"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-2">
              {mobileSheet === "type" && (
                <button
                  type="button"
                  onClick={() => {
                    updateFilter("type", null);
                    setMobileSheet(null);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-medium transition-all",
                    !activeType
                      ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-100"
                      : "bg-white/[0.04] border-white/[0.12] text-[#CBD5E1] hover:border-white/[0.24] hover:bg-white/[0.08]",
                  )}
                >
                  <span>Todos los tipos</span>
                </button>
              )}

              {mobileSheet === "type" &&
                orderedTypes.map((type) => {
                  const isActive = activeType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        toggleType(type);
                        setMobileSheet(null);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-medium transition-all",
                        isActive
                          ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-100"
                          : "bg-white/[0.04] border-white/[0.12] text-[#CBD5E1] hover:border-white/[0.24] hover:bg-white/[0.08]",
                      )}
                    >
                      <span>{EVENT_TYPE_LABELS[type]}</span>
                    </button>
                  );
                })}

              {mobileSheet === "department" && (
                <button
                  type="button"
                  onClick={() => {
                    updateFilter("department", null);
                    setMobileSheet(null);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-medium transition-all",
                    !activeDepartment
                      ? "bg-accent/20 border-accent/60 text-[#A7F3D0]"
                      : "bg-white/[0.04] border-white/[0.12] text-[#CBD5E1] hover:border-white/[0.24] hover:bg-white/[0.08]",
                  )}
                >
                  <span>Todos los departamentos</span>
                </button>
              )}

              {mobileSheet === "department" &&
                sortedDepartments.map((department) => {
                  const isActive = activeDepartment === department;
                  return (
                    <button
                      key={department}
                      type="button"
                      onClick={() => {
                        toggleDepartment(department);
                        setMobileSheet(null);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-medium transition-all",
                        isActive
                          ? "bg-accent/20 border-accent/60 text-[#A7F3D0]"
                          : "bg-white/[0.04] border-white/[0.12] text-[#CBD5E1] hover:border-white/[0.24] hover:bg-white/[0.08]",
                      )}
                    >
                      <span>{department}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
