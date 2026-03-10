"use client";

import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";
import { Check, X } from "lucide-react";

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
      // Open native date picker
      dateInputRef.current?.showPicker();
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
    },
    [router, pathname, searchParams, startTransition],
  );

  const clearTimeFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("when");
    params.delete("fecha");
    const qs = params.toString();

    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [router, pathname, searchParams, startTransition]);

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
            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </div>

      {hasActiveTimeFilter && (
        <div className="flex items-center justify-end pt-1">
          <button
            onClick={clearTimeFilter}
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
