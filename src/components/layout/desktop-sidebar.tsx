import Link from "next/link";
import {
  getTrendingEvents,
  getSidebarStats,
  getUpcomingHighlights,
} from "@/lib/queries";
import { getTodayUY, getDateOffsetUY, formatTime, getDateLabel } from "@/lib/format";
import { EventTypeBadge } from "@/components/shared/event-type-badge";
import { SidebarLiveClock, AnimatedStat } from "./sidebar-live";
import {
  Flame,
  MapPin,
  CalendarDays,
  Zap,
  Megaphone,
  Sparkles,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  Rocket,
  ExternalLink,
  Tag,
} from "lucide-react";

/**
 * Sidebar fijo full-height en desktop (lg+).
 * Ocupa el margen derecho vacío en pantallas anchas.
 * Contiene: trending events, categorías, próximos destacados, ads, stats, CTA publicar.
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
    <aside className="flex flex-col w-full">
      {/* Container que fluye hacia abajo sin límite de altura ni scroll */}
      <div className="sticky top-[60px] flex flex-col gap-3 overflow-x-hidden py-4 pr-1">

        {/* ── LIVE CLOCK + DATE ── */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(34,211,238,0.06) 100%)",
            border: "1px solid rgba(168,85,247,0.20)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <SidebarLiveClock />
        </div>

        {/* ── TRENDING HOY ── */}
        {trending.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Flame
                className="h-4 w-4 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.7)]"
                strokeWidth={2.5}
              />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-orange-400">
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
                      className="group flex items-start gap-2.5 rounded-xl p-2.5 transition-colors hover:bg-white/[0.06]"
                    >
                      {/* Rank number */}
                      <span className="shrink-0 mt-0.5 text-xs font-bold font-mono text-muted-foreground/40 w-4 text-right">
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[13px] font-semibold text-foreground leading-snug group-hover:text-neon-violet transition-colors line-clamp-2">
                          {event.name}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <EventTypeBadge type={event.eventType} size="sm" />
                          {time && (
                            <span className="text-[10px] text-muted-foreground/60 font-mono">
                              {time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                          <MapPin className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
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

        {/* ── PRÓXIMOS DESTACADOS ── */}
        {highlights.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="h-4 w-4 text-neon-magenta" strokeWidth={2} />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-neon-magenta">
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
                    className="group flex items-start gap-2.5 rounded-xl p-2.5 transition-colors hover:bg-white/[0.06]"
                  >
                    {/* Date pill */}
                    <div className={`shrink-0 flex flex-col items-center justify-center rounded-lg px-2 py-1.5 min-w-[40px] border ${
                      isToday
                        ? "bg-neon-violet/15 border-neon-violet/30 text-neon-violet"
                        : isTomorrow
                        ? "bg-neon-cyan/12 border-neon-cyan/25 text-neon-cyan"
                        : "bg-white/[0.04] border-white/10 text-muted-foreground/70"
                    }`}
                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                    >
                      <span className="text-[9px] font-bold uppercase leading-none">
                        {isToday ? "HOY" : isTomorrow ? "MAÑ" : dateLabel.slice(0, 3).toUpperCase()}
                      </span>
                      {time && (
                        <span className="text-[9px] font-mono leading-none mt-0.5 opacity-80">
                          {time}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[13px] font-semibold text-foreground leading-snug group-hover:text-neon-magenta transition-colors line-clamp-2">
                        {event.name}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <EventTypeBadge type={event.eventType} size="sm" />
                        {event.isFree && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-neon-green bg-neon-green/10 border border-neon-green/20 px-1.5 py-0.5 rounded-full">
                            Gratis
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                        <MapPin className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                        <span className="truncate">{event.venueName}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/proximos"
              className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-neon-magenta/70 hover:text-neon-magenta transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Ver todos los próximos
            </Link>
          </div>
        )}

        {/* ── PUBLICITAR TU EVENTO ── */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(236,72,153,0.10) 60%, rgba(0,0,0,0.4) 100%)",
            border: "1px solid rgba(168,85,247,0.35)",
            boxShadow: "0 6px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(168,85,247,0.12), inset 0 1px 0 rgba(168,85,247,0.15)",
          }}
        >
          {/* Glow accent top-right */}
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-neon-violet/20 blur-2xl pointer-events-none" />

          <div className="relative p-4 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(168,85,247,0.4) 0%, rgba(236,72,153,0.25) 100%)",
                  border: "1px solid rgba(168,85,247,0.35)",
                  boxShadow: "0 2px 12px rgba(168,85,247,0.3)",
                }}
              >
                <Rocket className="h-4 w-4 text-neon-violet" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">
                  ¿Tenés un evento?
                </p>
                <p className="text-[11px] text-muted-foreground/70 leading-snug">
                  Publicalo gratis y llegá a miles
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-neon-green shrink-0" />
                <span className="text-[11px] text-neon-green font-semibold">Gratis para eventos sin costo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-neon-cyan shrink-0" />
                <span className="text-[11px] text-muted-foreground/80">Aparecé en el mapa y en búsquedas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-neon-cyan shrink-0" />
                <span className="text-[11px] text-muted-foreground/80">Llegá a toda Uruguay</span>
              </div>
            </div>

            {/* CTA button */}
            <Link
              href="/publicar"
              className="btn-neon flex items-center justify-center gap-1.5 !py-2.5 !px-3 !text-[11px] !rounded-xl w-full"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Publicar mi evento
            </Link>
          </div>
        </div>

        {/* ── ANUNCIOS ── */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.45) 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 4px 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Label */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
              Publicidad
            </span>
            <Megaphone className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>

          {/* Ad 1 — Venue */}
          <a
            href="#"
            className="group flex items-start gap-3 rounded-xl p-3 mb-2 transition-all cursor-pointer"
            style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.12) 0%, rgba(0,0,0,0.55) 100%)",
              border: "1px solid rgba(34,211,238,0.25)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(34,211,238,0.08)",
            }}
          >
            {/* Logo placeholder */}
            <div
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[15px] font-black"
              style={{
                background: "linear-gradient(135deg, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0.10) 100%)",
                border: "1px solid rgba(34,211,238,0.35)",
                color: "#22D3EE",
                boxShadow: "0 2px 10px rgba(34,211,238,0.2)",
              }}
            >
              MF
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-white leading-tight">Magma Futura</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              </div>
              <span className="text-[11px] text-foreground/75 leading-snug">
                El venue más innovador de Montevideo. Shows en vivo todos los fines de semana.
              </span>
              <span className="text-[10px] font-semibold text-neon-cyan mt-0.5">magmafutura.com.uy →</span>
            </div>
          </a>

          {/* Ad 2 — Ticketing */}
          <a
            href="#"
            className="group flex items-start gap-3 rounded-xl p-3 transition-all cursor-pointer"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(0,0,0,0.55) 100%)",
              border: "1px solid rgba(168,85,247,0.25)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(168,85,247,0.08)",
            }}
          >
            {/* Logo placeholder */}
            <div
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[15px] font-black"
              style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0.10) 100%)",
                border: "1px solid rgba(168,85,247,0.35)",
                color: "#A855F7",
                boxShadow: "0 2px 10px rgba(168,85,247,0.2)",
              }}
            >
              RT
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-white leading-tight">RedTickets</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              </div>
              <span className="text-[11px] text-foreground/75 leading-snug">
                Vendé entradas online para tu evento. Rápido, seguro y sin complicaciones.
              </span>
              <span className="text-[10px] font-semibold text-neon-violet mt-0.5">redtickets.com.uy →</span>
            </div>
          </a>

          {/* CTA para anunciarse */}
          <Link
            href="/publicar#contacto"
            className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl py-1.5 px-3 text-[10px] font-semibold text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors border border-white/[0.06] hover:border-white/[0.1]"
          >
            <Tag className="h-3 w-3" />
            Anunciá tu negocio aquí
          </Link>
        </div>

        {/* ── ESTADÍSTICAS ── */}
        {(stats.todayCount > 0 || stats.weekCount > 0) && (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-neon-cyan" strokeWidth={2} />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-neon-cyan">
                En números
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: stats.todayCount, label: "hoy" },
                { value: stats.weekCount, label: "esta semana" },
                { value: stats.venuesCount, label: "venues" },
              ].map(({ value, label }) => (
                <AnimatedStat key={label} value={value} label={label} />
              ))}
            </div>
          </div>
        )}

        {/* ── QUICK LINKS ── */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.15) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3">
            Explorar
          </h2>
          <div className="space-y-0.5">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.05] transition-colors"
            >
              <Zap className="h-3.5 w-3.5 text-neon-violet shrink-0" strokeWidth={2} />
              Eventos de hoy
            </Link>
            <Link
              href="/proximos"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.05] transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5 text-neon-cyan shrink-0" strokeWidth={2} />
              Próximos eventos
            </Link>
            <Link
              href="/mapa"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.05] transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 text-neon-magenta shrink-0" strokeWidth={2} />
              Ver en el mapa
            </Link>
          </div>
        </div>

        {/* ── FOOTER NOTE ── */}
        <div className="flex flex-col gap-1 px-2 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="live-dot w-1.5 h-1.5" />
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
              Actualizado cada 5 minutos
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground/30 leading-relaxed">
            Eventos en Uruguay · ¿Dónde es Hoy?
          </p>
        </div>

      </div>
    </aside>
  );
}
