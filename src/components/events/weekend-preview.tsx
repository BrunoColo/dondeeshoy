"use client";

import Link from "next/link";
import { EventList } from "./event-list";
import { Calendar, ArrowRight } from "lucide-react";
import type { Event } from "@/lib/db/schema/events";

interface WeekendPreviewProps {
  events: Event[];
  totalCount: number;
  weekendLabel: string;
}

export function WeekendPreview({ events, totalCount, weekendLabel }: WeekendPreviewProps) {
  if (events.length === 0) return null;

  return (
    <div className="mt-8 mb-6 fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/15 border border-violet-400/20">
            <Calendar className="h-3.5 w-3.5 text-violet-300" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.15em] text-violet-300">
              Lo mejor del finde
            </h2>
            <p className="text-[10px] text-violet-200/60">
              {weekendLabel}
            </p>
          </div>
          <span className="ml-1 rounded-full bg-violet-500/15 border border-violet-400/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
            {totalCount} {totalCount === 1 ? "evento" : "eventos"}
          </span>
        </div>
      </div>

      {/* Events */}
      <div className="rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.04] to-indigo-500/[0.02] p-3 sm:p-4">
        <EventList events={events} />

        {/* CTA to see all weekend events */}
        {totalCount > events.length && (
          <Link
            href="/proximos?when=finde"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-[12px] font-semibold text-violet-300 transition-all hover:bg-violet-500/15 hover:border-violet-400/30 hover:shadow-[0_0_16px_rgba(139,92,246,0.15)] group"
          >
            Ver todos los eventos del finde
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
          </Link>
        )}
      </div>
    </div>
  );
}
