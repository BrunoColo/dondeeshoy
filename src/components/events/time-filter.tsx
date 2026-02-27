"use client";

import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";
import { CalendarDays, Check } from "lucide-react";

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
    <div className={cn("flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0", isPending && "opacity-60 transition-opacity", className)}>
      {OPTIONS.map((option) => {
        const isActive = activeWhen === option.value;

        return (
          <button
            key={option.value}
            onClick={() => updateWhen(isActive ? null : option.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200",
              isActive
                ? "bg-accent/20 border-accent/45 text-accent-light shadow-[0_0_10px_rgba(13,148,136,0.2)] ring-1 ring-accent/25"
                : "bg-accent/10 border-accent/20 text-accent-light/80 hover:border-accent/30",
            )}
          >
            {isActive ? <Check className="h-3 w-3" strokeWidth={2.8} /> : <CalendarDays className="h-3 w-3" strokeWidth={2.5} />}
            {option.label}
          </button>
        );
      })}

      {/* Date picker button */}
      <div className="relative shrink-0">
        <button
          onClick={handleDateClick}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200",
            isDateActive
              ? "bg-accent/20 border-accent/45 text-accent-light shadow-[0_0_10px_rgba(13,148,136,0.2)] ring-1 ring-accent/25"
              : "bg-accent/10 border-accent/20 text-accent-light/80 hover:border-accent/30",
          )}
        >
          {isDateActive ? <Check className="h-3 w-3" strokeWidth={2.8} /> : <CalendarDays className="h-3 w-3" strokeWidth={2.5} />}
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
  );
}
