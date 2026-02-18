"use client";

import { cn } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
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

  const activeWhen = searchParams.get("when") as TimeWhen | null;

  const updateWhen = useCallback(
    (value: TimeWhen | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === null) {
        params.delete("when");
      } else {
        params.set("when", value);
      }

      const qs = params.toString();

      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams, startTransition],
  );

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
                ? "bg-neon-cyan/20 border-neon-cyan/45 text-neon-cyan shadow-[0_0_10px_rgba(34,211,238,0.2)] ring-1 ring-neon-cyan/25"
                : "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan/80 hover:border-neon-cyan/30",
            )}
          >
            {isActive ? <Check className="h-3 w-3" strokeWidth={2.8} /> : <CalendarDays className="h-3 w-3" strokeWidth={2.5} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
