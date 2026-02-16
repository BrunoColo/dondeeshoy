import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPrice, formatTime, formatDateES, getTimeStatus } from "@/lib/format";
import { EventTypeBadge } from "@/components/shared/event-type-badge";
import {
  MapPin,
  Ticket,
  Calendar,
  ArrowLeft,
  ExternalLink,
  Users,
  Music,
} from "lucide-react";
import type { Event } from "@/lib/db/schema/events";

interface EventDetailProps {
  event: Event;
}

export function EventDetail({ event }: EventDetailProps) {
  const price = formatPrice(event.priceMin, event.priceMax, event.isFree, event.currency);
  const startTime = formatTime(event.startTime);
  const endTime = formatTime(event.endTime);
  const dateLabel = formatDateES(event.date);
  const timeStatus = getTimeStatus(event.startTime, event.endTime, event.date);

  return (
    <div className="fade-up">
      {/* Hero image */}
      <div className="relative">
        {event.imageUrl ? (
          <div className="img-overlay relative h-64 sm:h-80 md:h-96">
            <Image
              src={event.imageUrl}
              alt={event.name}
              fill
              className="object-cover"
              sizes="100vw"
              priority
              unoptimized
            />
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-br from-elevated to-surface" />
        )}

        {/* Back button */}
        <Link
          href="/"
          className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/60"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>

        {/* Now indicator */}
        {timeStatus.type === "now" && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5">
            <span className="live-dot" />
            <span className="text-xs font-semibold text-emerald-300">EN VIVO</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative -mt-6 rounded-t-3xl bg-background px-5 pb-32 pt-6">
        {/* Type badge + genre */}
        <div className="flex items-center gap-3 mb-4">
          <EventTypeBadge type={event.eventType} size="md" />
          {event.musicGenre && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Music className="h-3.5 w-3.5" strokeWidth={2} />
              {event.musicGenre}
            </span>
          )}
        </div>

        {/* Event name */}
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight text-foreground">
          {event.name}
        </h1>

        {/* Info grid */}
        <div className="mt-6 space-y-4">
          {/* Date & Time */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-violet/10">
                <Calendar className="h-5 w-5 text-neon-violet" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {dateLabel}
                </p>
                {(startTime || endTime) && (
                  <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                    {startTime && endTime
                      ? `${startTime} — ${endTime}`
                      : startTime || ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Venue */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-cyan/10">
                <MapPin className="h-5 w-5 text-neon-cyan" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {event.venueName}
                </p>
                {event.venueAddress && (
                  <p className="mt-0.5 text-sm text-muted-foreground truncate">
                    {event.venueAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Price */}
          {price && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-start gap-3.5">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  event.isFree ? "bg-neon-green/10" : "bg-neon-amber/10",
                )}>
                  <Ticket
                    className={cn(
                      "h-5 w-5",
                      event.isFree ? "text-neon-green" : "text-neon-amber",
                    )}
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <p className={cn(
                    "text-sm font-semibold",
                    event.isFree ? "text-neon-green" : "text-foreground",
                  )}>
                    {price}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {event.isFree ? "Entrada libre" : `Moneda: ${event.currency}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Age restriction */}
          {event.ageRestriction && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-red/10">
                  <Users className="h-5 w-5 text-neon-red" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    +{event.ageRestriction} años
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Edad mínima requerida
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="mt-6">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Descripción
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {event.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed CTA button */}
      {event.ticketUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
          style={{ background: "linear-gradient(to top, rgba(6,6,12,0.95) 60%, transparent)" }}
        >
          <div className="mx-auto max-w-2xl">
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-neon flex w-full items-center justify-center gap-2 text-center"
            >
              <Ticket className="h-4.5 w-4.5" strokeWidth={2} />
              <span>Comprar entradas</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-60" strokeWidth={2} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
