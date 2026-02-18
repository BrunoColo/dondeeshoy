"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Check, Ticket, Moon, MapPin, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventType } from "@/types/events";
import { EVENT_TYPE_LABELS } from "@/types/events";

// Chip color styles matching the existing filter system
const TYPE_STYLES: Record<
  EventType,
  { dot: string; activeBg: string; activeText: string; activeBorder: string; inactiveBg: string; inactiveText: string }
> = {
  fiesta:       { dot: "bg-violet-400",  activeBg: "bg-violet-500/20",  activeText: "text-violet-300",  activeBorder: "border-violet-500/40",  inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  festival:     { dot: "bg-pink-400",    activeBg: "bg-pink-500/20",    activeText: "text-pink-300",    activeBorder: "border-pink-500/40",    inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  concierto:    { dot: "bg-sky-400",     activeBg: "bg-sky-500/20",     activeText: "text-sky-300",     activeBorder: "border-sky-500/40",     inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  recital:      { dot: "bg-cyan-400",    activeBg: "bg-cyan-500/20",    activeText: "text-cyan-300",    activeBorder: "border-cyan-500/40",    inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  cultural:     { dot: "bg-indigo-400",  activeBg: "bg-indigo-500/20",  activeText: "text-indigo-300",  activeBorder: "border-indigo-500/40",  inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  deportivo:    { dot: "bg-green-400",   activeBg: "bg-green-500/20",   activeText: "text-green-300",   activeBorder: "border-green-500/40",   inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  gastronomico: { dot: "bg-orange-400",  activeBg: "bg-orange-500/20",  activeText: "text-orange-300",  activeBorder: "border-orange-500/40",  inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  familiar:     { dot: "bg-lime-400",    activeBg: "bg-lime-500/20",    activeText: "text-lime-300",    activeBorder: "border-lime-500/40",    inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  feria:        { dot: "bg-rose-400",    activeBg: "bg-rose-500/20",    activeText: "text-rose-300",    activeBorder: "border-rose-500/40",    inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  taller:       { dot: "bg-teal-400",    activeBg: "bg-teal-500/20",    activeText: "text-teal-300",    activeBorder: "border-teal-500/40",    inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  club:         { dot: "bg-blue-400",    activeBg: "bg-blue-500/20",    activeText: "text-blue-300",    activeBorder: "border-blue-500/40",    inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  bar:          { dot: "bg-amber-400",   activeBg: "bg-amber-500/20",   activeText: "text-amber-300",   activeBorder: "border-amber-500/40",   inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  teatro:       { dot: "bg-emerald-400", activeBg: "bg-emerald-500/20", activeText: "text-emerald-300", activeBorder: "border-emerald-500/40", inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
  otro:         { dot: "bg-slate-400",   activeBg: "bg-slate-500/20",   activeText: "text-slate-300",   activeBorder: "border-slate-500/40",   inactiveBg: "bg-white/[0.02]", inactiveText: "text-muted-foreground/70" },
};

interface LeftFilterPanelProps {
  availableTypes?: EventType[];
  availableDepartments?: string[];
}

/**
 * Panel de filtros vertical persistente para el lado izquierdo en xl+.
 * Se sincroniza con los query params de la URL igual que EventFilters.
 * Client component — usa useSearchParams para leer/escribir filtros.
 */
export function LeftFilterPanel({
  availableTypes = [],
  availableDepartments = [],
}: LeftFilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeType = searchParams.get("type") as EventType | null;
  const activeDepartment = searchParams.get("department");
  const activeFree = searchParams.get("free") === "true";
  const activeNight = searchParams.get("night") === "true";

  const hasActiveFilters = !!(activeType || activeDepartment || activeFree || activeNight);

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
    [router, pathname, searchParams],
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  }, [router, pathname]);

  return (
    <aside className="hidden xl:flex flex-col w-[240px] shrink-0">
      <div className="sticky top-[60px] h-[calc(100vh-60px)] flex flex-col gap-4 overflow-y-auto overflow-x-hidden py-4 pl-4 xl:pl-6 scrollbar-none">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-neon-violet" strokeWidth={2} />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-violet">
              Filtros
            </span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70 hover:text-foreground hover:border-white/[0.15] transition-all"
            >
              <X className="h-2.5 w-2.5" />
              Limpiar
            </button>
          )}
        </div>

        {/* ── FILTROS RÁPIDOS ── */}
        <div className="glass-card rounded-2xl p-3 flex flex-col gap-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 px-1 mb-1">
            Rápidos
          </p>

          {/* Gratis */}
          <button
            onClick={() => updateFilter("free", activeFree ? null : "true")}
            aria-pressed={activeFree}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all border",
              isPending && "opacity-60",
              activeFree
                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                : "bg-white/[0.02] border-white/[0.06] text-muted-foreground/70 hover:text-foreground hover:border-white/[0.12]",
            )}
          >
            <Ticket className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="flex-1 text-left">Gratis</span>
            {activeFree && <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
          </button>

          {/* Noche */}
          <button
            onClick={() => updateFilter("night", activeNight ? null : "true")}
            aria-pressed={activeNight}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all border",
              isPending && "opacity-60",
              activeNight
                ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-300"
                : "bg-white/[0.02] border-white/[0.06] text-muted-foreground/70 hover:text-foreground hover:border-white/[0.12]",
            )}
          >
            <Moon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="flex-1 text-left">Noche</span>
            {activeNight && <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
          </button>
        </div>

        {/* ── TIPO DE EVENTO ── */}
        {availableTypes.length > 0 && (
          <div className="glass-card rounded-2xl p-3 flex flex-col gap-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 px-1 mb-1.5">
              Tipo de evento
            </p>
            {availableTypes.map((type) => {
              const style = TYPE_STYLES[type];
              const isActive = activeType === type;
              return (
                <button
                  key={type}
                  onClick={() => updateFilter("type", isActive ? null : type)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all border",
                    isPending && "opacity-60",
                    isActive
                      ? cn(style.activeBg, style.activeText, style.activeBorder)
                      : cn(style.inactiveBg, style.inactiveText, "border-white/[0.06] hover:border-white/[0.12] hover:text-foreground"),
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", style.dot)} />
                  <span className="flex-1 text-left">{EVENT_TYPE_LABELS[type]}</span>
                  {isActive && <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        )}

        {/* ── DEPARTAMENTO ── */}
        {availableDepartments.length > 0 && (
          <div className="glass-card rounded-2xl p-3 flex flex-col gap-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 px-1 mb-1.5">
              Departamento
            </p>
            {availableDepartments.map((dept) => {
              const isActive = activeDepartment === dept;
              return (
                <button
                  key={dept}
                  onClick={() => updateFilter("department", isActive ? null : dept)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all border",
                    isPending && "opacity-60",
                    isActive
                      ? "bg-neon-cyan/15 border-neon-cyan/35 text-neon-cyan"
                      : "bg-white/[0.02] border-white/[0.06] text-muted-foreground/70 hover:text-foreground hover:border-white/[0.12]",
                  )}
                >
                  <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
                  <span className="flex-1 text-left truncate">{dept}</span>
                  {isActive && <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        )}

      </div>
    </aside>
  );
}
