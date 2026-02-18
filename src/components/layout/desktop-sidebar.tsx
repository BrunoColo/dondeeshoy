import Link from "next/link";
import {
  getTrendingEvents,
  getSidebarStats,
  getUpcomingHighlights,
} from "@/lib/queries";
import { getTodayUY, getDateOffsetUY, formatTime, getDateLabel } from "@/lib/format";
import { EventTypeBadge } from "@/components/shared/event-type-badge";
import {
  Flame,
  MapPin,
  CalendarDays,
  Zap,
  TrendingUp,
  Music,
  Theater,
  Dumbbell,
  Palette,
  PartyPopper,
  Star,
  Megaphone,
  Sparkles,
  BadgeCheck,
  Mail,
  BarChart3,
  CalendarCheck,
} from "lucide-react";

/**
 * Sidebar fijo full-height en desktop (lg+).
 * Ocupa el margen derecho vacío en pantallas anchas.
 * Contiene: CTA publicar, trending events, categorías, próximos destacados, stats.
 * Server component — fetches data directly.
 */
export async function DesktopSidebar() {
  const today = getTodayUY();
  const weekEnd = getDateOffsetUY(7);

  const [trending, highlights, stats] = await Promise.all([
    getTrendingEvents(today, 6),
    getUpcomingHighlights(today, 3),
    getSidebarStats(today, weekEnd),
  ]);

  return (
    <aside className="hidden lg:flex flex-col w-[260px] xl:w-[280px] shrink-0">
      {/* Sticky container que ocupa todo el alto visible */}
      <div className="sticky top-[60px] h-[calc(100vh-60px)] flex flex-col gap-4 overflow-y-auto overflow-x-hidden py-4 pr-1 scrollbar-none">

        {/* ── CTA PUBLICAR EVENTO ── */}
        <div className="glass-card relative rounded-2xl overflow-hidden border border-neon-violet/30 bg-gradient-to-br from-neon-violet/12 via-neon-magenta/6 to-transparent">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-violet/8 to-transparent pointer-events-none" />
          <div className="relative p-4 flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neon-violet/70">
                Publicidad
              </span>
              <Megaphone className="h-3 w-3 text-neon-violet/50" />
            </div>

            {/* Main CTA content */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-magenta/20 flex items-center justify-center border border-neon-violet/20">
                  <Sparkles className="h-4 w-4 text-neon-violet" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-[13px] font-bold text-foreground leading-tight">
                    Publicá tu evento
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 leading-snug">
                    Llegá a miles de personas en Uruguay
                  </p>
                </div>
              </div>

              {/* Badge gratis */}
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3 w-3 text-neon-green shrink-0" />
                <span className="text-[10px] font-semibold text-neon-green">
                  Gratis para eventos sin costo
                </span>
              </div>

              {/* CTA button */}
              <Link
                href="/publicar"
                className="btn-neon flex items-center justify-center gap-1.5 !py-2 !px-3 !text-[11px] !rounded-xl w-full"
              >
                <Sparkles className="h-3 w-3" />
                Publicar evento
              </Link>
            </div>
          </div>
        </div>

        {/* ── TRENDING HOY ── */}
        {trending.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame
                className="h-3.5 w-3.5 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]"
                strokeWidth={2.5}
              />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-400">
                Más vistos hoy
              </h2>
            </div>
            <ul className="space-y-0.5">
              {trending.map((event, i) => {
                const time = formatTime(event.startTime);
                return (
                  <li key={event.id}>
                    <Link
                      href={`/evento/${event.slug}`}
                      className="group flex items-start gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/[0.04]"
                    >
                      {/* Rank number */}
                      <span className="shrink-0 mt-0.5 text-[10px] font-bold font-mono text-muted-foreground/50 w-3 text-right">
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[11px] font-semibold text-foreground leading-snug group-hover:text-neon-violet transition-colors line-clamp-2">
                          {event.name}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <EventTypeBadge type={event.eventType} size="sm" />
                          {time && (
                            <span className="text-[9px] text-muted-foreground/70 font-mono">
                              {time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                          <MapPin className="h-2 w-2 shrink-0" strokeWidth={2} />
                          <span className="truncate">{event.venueName}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── CATEGORÍAS POPULARES ── */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-neon-cyan" strokeWidth={2} />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-cyan">
              Categorías
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Música", icon: Music, color: "text-neon-violet", bg: "bg-neon-violet/10 hover:bg-neon-violet/15", href: "/?type=concierto" },
              { label: "Teatro", icon: Theater, color: "text-neon-green", bg: "bg-neon-green/10 hover:bg-neon-green/15", href: "/?type=teatro" },
              { label: "Fiestas", icon: PartyPopper, color: "text-neon-magenta", bg: "bg-neon-magenta/10 hover:bg-neon-magenta/15", href: "/?type=fiesta" },
              { label: "Deporte", icon: Dumbbell, color: "text-neon-amber", bg: "bg-neon-amber/10 hover:bg-neon-amber/15", href: "/?type=deportivo" },
              { label: "Cultural", icon: Palette, color: "text-neon-blue", bg: "bg-neon-blue/10 hover:bg-neon-blue/15", href: "/?type=cultural" },
              { label: "Festivales", icon: Star, color: "text-orange-400", bg: "bg-orange-400/10 hover:bg-orange-400/15", href: "/?type=festival" },
            ].map(({ label, icon: Icon, color, bg, href }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 transition-colors ${bg} border border-white/10`}
              >
                <Icon className={`h-3 w-3 shrink-0 ${color}`} strokeWidth={2} />
                <span className={`text-[10px] font-semibold ${color}`}>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── PRÓXIMOS DESTACADOS ── */}
        {highlights.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="h-3.5 w-3.5 text-neon-magenta" strokeWidth={2} />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-magenta">
                Próximos destacados
              </h2>
            </div>
            <div className="space-y-1">
              {highlights.map((event) => {
                const { label: dateLabel, isToday, isTomorrow } = getDateLabel(event.date);
                const time = formatTime(event.startTime);
                return (
                  <Link
                    key={event.id}
                    href={`/evento/${event.slug}`}
                    className="group flex items-start gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/[0.04]"
                  >
                    {/* Date pill */}
                    <div className={`shrink-0 flex flex-col items-center justify-center rounded-lg px-1.5 py-1 min-w-[36px] border ${
                      isToday
                        ? "bg-neon-violet/15 border-neon-violet/30 text-neon-violet"
                        : isTomorrow
                        ? "bg-neon-cyan/12 border-neon-cyan/25 text-neon-cyan"
                        : "bg-white/[0.04] border-white/10 text-muted-foreground/70"
                    }`}>
                      <span className="text-[8px] font-bold uppercase leading-none">
                        {isToday ? "HOY" : isTomorrow ? "MAÑ" : dateLabel.slice(0, 3).toUpperCase()}
                      </span>
                      {time && (
                        <span className="text-[8px] font-mono leading-none mt-0.5 opacity-80">
                          {time}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[11px] font-semibold text-foreground leading-snug group-hover:text-neon-magenta transition-colors line-clamp-2">
                        {event.name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <EventTypeBadge type={event.eventType} size="sm" />
                        {event.isFree && (
                          <span className="text-[8px] font-bold uppercase tracking-wide text-neon-green bg-neon-green/10 border border-neon-green/20 px-1.5 py-0.5 rounded-full">
                            Gratis
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                        <MapPin className="h-2 w-2 shrink-0" strokeWidth={2} />
                        <span className="truncate">{event.venueName}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/proximos"
              className="mt-2 flex items-center justify-center gap-1 text-[10px] font-semibold text-neon-magenta/70 hover:text-neon-magenta transition-colors"
            >
              <CalendarDays className="h-3 w-3" />
              Ver todos los próximos
            </Link>
          </div>
        )}

        {/* ── ESTADÍSTICAS ── */}
        {(stats.todayCount > 0 || stats.weekCount > 0) && (
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-3.5 w-3.5 text-neon-cyan" strokeWidth={2} />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-cyan">
                En números
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-white/[0.03] border border-white/10 py-2.5 px-1">
                <span className="text-[16px] font-bold text-foreground font-mono leading-none">
                  {stats.todayCount}
                </span>
                <span className="text-[8px] text-muted-foreground/70 text-center leading-tight">
                  hoy
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-white/[0.03] border border-white/10 py-2.5 px-1">
                <span className="text-[16px] font-bold text-foreground font-mono leading-none">
                  {stats.weekCount}
                </span>
                <span className="text-[8px] text-muted-foreground/70 text-center leading-tight">
                  esta semana
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-white/[0.03] border border-white/10 py-2.5 px-1">
                <span className="text-[16px] font-bold text-foreground font-mono leading-none">
                  {stats.venuesCount}
                </span>
                <span className="text-[8px] text-muted-foreground/70 text-center leading-tight">
                  venues
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── QUICK LINKS ── */}
        <div className="glass-card rounded-2xl p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-3">
            Explorar
          </h2>
          <div className="space-y-0.5">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <Zap className="h-3 w-3 text-neon-violet shrink-0" strokeWidth={2} />
              Eventos de hoy
            </Link>
            <Link
              href="/proximos"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <CalendarDays className="h-3 w-3 text-neon-cyan shrink-0" strokeWidth={2} />
              Próximos eventos
            </Link>
            <Link
              href="/mapa"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <MapPin className="h-3 w-3 text-neon-magenta shrink-0" strokeWidth={2} />
              Ver en el mapa
            </Link>
          </div>
        </div>

        {/* ── CTA ORGANIZADORES ── */}
        <div className="glass-card relative rounded-2xl overflow-hidden border border-neon-cyan/20 bg-gradient-to-br from-neon-cyan/8 via-transparent to-neon-blue/5">
          <div className="p-4 flex flex-col gap-3">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neon-cyan/60">
              Patrocinado
            </span>
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-neon-cyan/15 border border-neon-cyan/20 flex items-center justify-center">
                <Mail className="h-3.5 w-3.5 text-neon-cyan" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[12px] font-bold text-foreground leading-tight">
                  ¿Organizás eventos?
                </p>
                <p className="text-[10px] text-muted-foreground/60 leading-snug">
                  Publicá y llegá a tu audiencia
                </p>
              </div>
            </div>
            <Link
              href="/publicar#contacto"
              className="flex items-center justify-center gap-1.5 rounded-xl py-1.5 px-3 text-[10px] font-bold text-neon-cyan border border-neon-cyan/25 hover:border-neon-cyan/45 hover:bg-neon-cyan/8 transition-all"
            >
              <Mail className="h-3 w-3" />
              Contactanos
            </Link>
          </div>
        </div>

        {/* ── FOOTER NOTE ── */}
        <div className="flex flex-col gap-1 px-2 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="live-dot w-1.5 h-1.5" />
            <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
              Actualizado cada 5 minutos
            </p>
          </div>
          <p className="text-[9px] text-muted-foreground/40 leading-relaxed">
            Eventos en Uruguay · ¿Dónde es Hoy?
          </p>
        </div>

      </div>
    </aside>
  );
}
