"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatPrice, formatTime } from "@/lib/format";
import { EventTypeBadge } from "@/components/shared/event-type-badge";
import { TimeBadge } from "@/components/shared/time-badge";
import { MapPin, Clock, Ticket, Music, Flame } from "lucide-react";
import type { EventType } from "@/types/events";
import { useState } from "react";

const TYPE_GRADIENT: Record<string, string> = {
  fiesta: "from-violet-600/30 via-fuchsia-600/20 to-transparent",
  baile: "from-fuchsia-600/30 via-pink-600/20 to-transparent",
  festival: "from-pink-600/30 via-rose-600/20 to-transparent",
  concierto: "from-sky-600/30 via-blue-600/20 to-transparent",
  recital: "from-cyan-500/30 via-sky-600/20 to-transparent",
  cultural: "from-indigo-600/30 via-violet-600/20 to-transparent",
  deportivo: "from-green-600/30 via-emerald-600/20 to-transparent",
  gastronomico: "from-orange-600/30 via-amber-600/20 to-transparent",
  familiar: "from-lime-500/30 via-green-500/20 to-transparent",
  feria: "from-rose-600/30 via-pink-600/20 to-transparent",
  taller: "from-teal-600/30 via-cyan-600/20 to-transparent",
  club: "from-blue-600/30 via-indigo-600/20 to-transparent",
  bar: "from-amber-500/30 via-yellow-600/20 to-transparent",
  teatro: "from-emerald-500/30 via-teal-600/20 to-transparent",
  otro: "from-slate-500/20 via-slate-600/10 to-transparent",
};

interface EventCardProps {
  id: string;
  slug: string;
  name: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string;
  eventType: EventType;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  currency?: string;
  musicGenre?: string | null;
  isTrending?: boolean;
  className?: string;
}

export function EventCard({
  slug,
  name,
  date,
  startTime,
  endTime,
  venueName,
  eventType,
  imageUrl,
  priceMin,
  priceMax,
  isFree,
  currency = "UYU",
  musicGenre,
  isTrending,
  className,
}: EventCardProps) {
  const price = formatPrice(priceMin, priceMax, isFree, currency);
  const timeLabel = formatTime(startTime);
  const [imgError, setImgError] = useState(false);

  const showImage = imageUrl && !imgError;
  const gradientClass = TYPE_GRADIENT[eventType] ?? TYPE_GRADIENT.otro;

  return (
    <Link 
      href={`/evento/${slug}`}
      className={cn("group block card-animate", className)}
    >
      <article className="glass-card card-glow relative overflow-hidden rounded-2xl">
        {showImage ? (
          /* ── With image ── */
          <div className="img-overlay relative h-44 sm:h-52">
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 600px"
              unoptimized
              onError={() => setImgError(true)}
            />
            {/* Badges over image */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between">
              <EventTypeBadge type={eventType} />
              <TimeBadge startTime={startTime} endTime={endTime} eventDate={date} />
            </div>

            {/* Content over image */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
              <h3 className="font-display text-[17px] font-bold leading-tight text-white line-clamp-2 drop-shadow-lg">
                {name}
              </h3>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} />
                  <span className="text-[13px] font-medium truncate">{venueName}</span>
                </div>
                {timeLabel && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2} />
                    <span className="font-mono text-[12px]">{timeLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── No image / broken image fallback ── */
          <div className="relative h-44 sm:h-52">
            {/* Colored gradient background based on event type */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity duration-300 group-hover:opacity-80",
              gradientClass,
            )} />

            {/* Decorative icon watermark */}
            <div className="absolute right-3 top-3 opacity-[0.07]">
              <Music className="h-20 w-20 text-white" strokeWidth={1} />
            </div>

            <div className="relative z-10 flex h-full flex-col px-4 pt-4 pb-4">
              {/* Top row: badges */}
              <div className="flex items-start justify-between mb-3">
                <EventTypeBadge type={eventType} />
                <TimeBadge startTime={startTime} endTime={endTime} eventDate={date} />
              </div>

              {/* Event name */}
              <h3 className="font-display text-[17px] font-bold leading-tight text-foreground line-clamp-2">
                {name}
              </h3>

              {/* Venue + time row */}
              <div className="mt-auto flex items-center gap-4 pt-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} />
                  <span className="text-[13px] font-medium truncate">{venueName}</span>
                </div>
                {timeLabel && (
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Clock className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2} />
                    <span className="font-mono text-[12px]">{timeLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom info bar */}
        <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5">
          <div className="flex items-center gap-2">
            {isTrending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
                <Flame className="h-2.5 w-2.5" strokeWidth={2.5} />
                Popular
              </span>
            )}
            {musicGenre && (
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                {musicGenre}
              </span>
            )}
          </div>
          {price && (
            <div className="flex items-center gap-1.5">
              <Ticket className="h-3 w-3 text-text-muted" strokeWidth={2} />
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  isFree
                    ? "text-neon-green"
                    : "text-foreground",
                )}
              >
                {price}
              </span>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
