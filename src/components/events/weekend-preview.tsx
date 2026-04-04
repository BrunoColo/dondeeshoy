"use client";

import Link from "next/link";
import { EventList } from "./event-list";
import { SectionHeader } from "./section-header";
import { SubscriptionCompactCta } from "@/components/shared/subscription-compact-cta";
import { Calendar } from "lucide-react";
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
      <SectionHeader
        icon={Calendar}
        title="Lo mejor del finde"
        subtitle={weekendLabel}
        count={totalCount}
        accent={{
          iconWrap: "border-sky-400/20 bg-gradient-to-br from-sky-500/18 to-cyan-500/10",
          icon: "text-sky-300",
          title: "text-sky-300",
          subtitle: "text-sky-100/70",
          badge: "border-sky-400/20 bg-sky-500/12 text-sky-200",
        }}
      />

      {/* Events */}
      <div className="rounded-2xl border border-sky-400/15 bg-gradient-to-br from-sky-500/[0.04] to-cyan-500/[0.02] p-3 sm:p-4">
        <EventList events={events} />

        {/* CTA to see all weekend events */}
        {totalCount > events.length && (
          <Link
            href="/proximos?when=finde"
            className="mt-3 flex items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2.5 text-[12px] font-semibold text-sky-300 transition-all hover:bg-sky-500/15 hover:border-sky-400/30 hover:shadow-[0_0_16px_rgba(56,189,248,0.15)]"
          >
            Ver todos los eventos del finde
          </Link>
        )}
      </div>

      <SubscriptionCompactCta
        className="mt-3"
        title="Recibí esta curaduría cada jueves por mail"
        description="Te mandamos lo mejor del finde según tus gustos y departamento, sin ruido ni spam."
        href="/suscribirse?utm_source=home-weekend&utm_medium=cta&utm_campaign=newsletter"
      />
    </div>
  );
}
