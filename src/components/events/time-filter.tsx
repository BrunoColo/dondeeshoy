"use client";

import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, X } from "lucide-react";

type TimeWhen = "manana" | "finde";

interface TimeFilterProps {
  className?: string;
}

const OPTIONS: Array<{ value: TimeWhen; label: string }> = [
  { value: "manana", label: "Mañana" },
  { value: "finde", label: "Este finde" },
];

export function TimeFilter({ className }: TimeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const mobileDateInputRef = useRef<HTMLInputElement>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const activeWhen = searchParams.get("when") as TimeWhen | "fecha" | null;
  const activeDate = searchParams.get("fecha");

  // Determine if a specific date is selected
  const isDateActive = activeWhen === "fecha" && !!activeDate;
  const hasActiveTimeFilter = activeWhen === "manana" || activeWhen === "finde" || isDateActive;

  const updateWhen = useCallback(
    (value: TimeWhen | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === null) {
        params.delete("when");
        params.delete("fecha");
      } else {
        params.set("when", value);
        params.delete("fecha");
      }

      const qs = params.toString();

      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams, startTransition],
  );

  const handleDateClick = useCallback(() => {
    if (isDateActive) {
      // Deselect date
      const params = new URLSearchParams(searchParams.toString());
      params.delete("when");
      params.delete("fecha");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    } else {
      const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

      if (isMobile) {
        setIsDateModalOpen(true);
        return;
      }

      // Desktop native picker + fallback for browsers without showPicker
      const input = dateInputRef.current;
      if (!input) return;

      const maybePicker = input as HTMLInputElement & { showPicker?: () => void };
      if (typeof maybePicker.showPicker === "function") {
        maybePicker.showPicker();
      } else {
        input.focus();
        input.click();
      }
    }
  }, [isDateActive, router, pathname, searchParams, startTransition]);

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (!value) return;

      const params = new URLSearchParams(searchParams.toString());
      params.set("when", "fecha");
      params.set("fecha", value);
      const qs = params.toString();

      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });

      setIsDateModalOpen(false);
    },
    [router, pathname, searchParams, startTransition],
  );

  // Format the selected date for display
  const formatSelectedDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return `${days[date.getDay()]} ${day}/${month}`;
  };

  // Min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // Max date = 3 months from now
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);
  const maxDateStr = maxDate.toISOString().split("T")[0];

  const modalDateValue = useMemo(() => {
    if (isDateActive && activeDate) return activeDate;
    return minDate;
  }, [activeDate, isDateActive, minDate]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isDateModalOpen || !isClient) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDateModalOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isDateModalOpen, isClient]);

  return (
    <div className={cn("space-y-3", isPending && "opacity-60 transition-opacity", className)}>
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {OPTIONS.map((option) => {
          const isActive = activeWhen === option.value;

          return (
            <button
              key={option.value}
              onClick={() => updateWhen(isActive ? null : option.value)}
              className={cn(
                "shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
                isActive
                  ? "bg-teal-500/25 border-teal-400/55 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.25)] ring-1 ring-teal-400/30"
                  : "bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25 hover:border-teal-400/55",
              )}
            >
              {isActive && <Check className="mr-1 h-3 w-3" strokeWidth={2.8} />}
              {option.label}
            </button>
          );
        })}

        {/* Date picker button */}
        <div className="relative shrink-0">
          <button
            onClick={handleDateClick}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
              isDateActive
                ? "bg-teal-500/25 border-teal-400/55 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.25)] ring-1 ring-teal-400/30"
                : "bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25 hover:border-teal-400/55",
            )}
          >
            {isDateActive && <Check className="mr-1 h-3 w-3" strokeWidth={2.8} />}
            {isDateActive && activeDate ? formatSelectedDate(activeDate) : "Elegir fecha"}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            min={minDate}
            max={maxDateStr}
            onChange={handleDateChange}
            className="absolute inset-0 w-px h-px opacity-0"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </div>

      {isClient && isDateModalOpen && createPortal(
        <div
          className="sm:hidden fixed inset-0 z-[2001] flex items-end bg-[rgba(3,6,14,0.72)] backdrop-blur-sm"
          onClick={() => setIsDateModalOpen(false)}
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
                  Elegir fecha
                </p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Filtrá eventos de un día puntual
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDateModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-[#B8C5D6] hover:text-white hover:bg-white/[0.1] transition-colors"
                aria-label="Cerrar selector de fecha"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <label className="block text-[11px] uppercase tracking-wide text-[#94A3B8] font-semibold">
                Fecha
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8AA2BE] pointer-events-none" />
                <input
                  ref={mobileDateInputRef}
                  type="date"
                  min={minDate}
                  max={maxDateStr}
                  defaultValue={modalDateValue}
                  onChange={handleDateChange}
                  className="w-full rounded-xl border border-white/[0.14] bg-white/[0.05] pl-10 pr-3 py-3 text-[14px] text-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsDateModalOpen(false)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.2] bg-white/[0.06] px-4 py-2.5 text-[13px] font-medium text-[#CBD5E1] hover:text-white hover:border-white/[0.32] hover:bg-white/[0.1] transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

    </div>
  );
}
