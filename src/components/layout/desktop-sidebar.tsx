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
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  Rocket,
  ExternalLink,
  Tag,
  Send,
} from "lucide-react";

/**
 * Sidebar fijo full-height en desktop (lg+).
 * Ocupa el margen derecho vacío en pantallas anchas.
 * Contiene: trending events, categorías, próximos destacados, ads, stats, CTA publicar.
 * Server component — fetches data directly.
 */

// Shared card style — solid dark background, subtle border
const cardStyle: React.CSSProperties = {
  backgroundColor: "#0f0f1a",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "12px",
  padding: "16px",
};

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
      <div className="sticky top-[60px] flex flex-col gap-3 overflow-x-hidden py-4 pr-1">

        {/* ── LIVE CLOCK + DATE ── */}
        <div style={{ ...cardStyle, borderLeft: "3px solid #6366f1" }}>
          <SidebarLiveClock />
        </div>

        {/* ── TRENDING HOY ── */}
        {trending.length > 0 && (
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-orange-400" strokeWidth={2.5} />
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
                      className="group flex items-start gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-white/[0.05]"
                    >
                      <span className="shrink-0 mt-0.5 text-xs font-bold font-mono text-muted-foreground/30 w-4 text-right">
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[13px] font-semibold text-foreground leading-snug group-hover:text-white transition-colors line-clamp-2">
                          {event.name}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <EventTypeBadge type={event.eventType} size="sm" />
                          {time && (
                            <span className="text-[10px] text-muted-foreground/50 font-mono">
                              {time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
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
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="h-4 w-4 text-[#14b8a6]" strokeWidth={2} />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#14b8a6]">
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
                    className="group flex items-start gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-white/[0.05]"
                  >
                    {/* Date pill */}
                    <div
                      className="shrink-0 flex flex-col items-center justify-center rounded-lg px-2 py-1.5 min-w-[40px]"
                      style={{
                        backgroundColor: isToday ? "rgba(20,184,166,0.12)" : isTomorrow ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.04)",
                        border: isToday ? "1px solid rgba(20,184,166,0.3)" : isTomorrow ? "1px solid rgba(99,102,241,0.25)" : "1px solid rgba(255,255,255,0.09)",
                      }}
                    >
                      <span className="text-[9px] font-bold uppercase leading-none" style={{ color: isToday ? "#14b8a6" : isTomorrow ? "#818cf8" : "#64748B" }}>
                        {isToday ? "HOY" : isTomorrow ? "MAÑ" : dateLabel.slice(0, 3).toUpperCase()}
                      </span>
                      {time && (
                        <span className="text-[9px] font-mono leading-none mt-0.5 text-muted-foreground/50">
                          {time}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[13px] font-semibold text-foreground leading-snug group-hover:text-white transition-colors line-clamp-2">
                        {event.name}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <EventTypeBadge type={event.eventType} size="sm" />
                        {event.isFree && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8] bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded-full">
                            Gratis
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
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
              className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Ver todos los próximos
            </Link>
          </div>
        )}

        {/* ── PUBLICITAR TU EVENTO ── */}
        <div
          style={{
            backgroundColor: "#0f0f1a",
            border: "1px solid rgba(99,102,241,0.25)",
            borderLeft: "3px solid #6366f1",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.25)",
                }}
              >
                <Rocket className="h-4 w-4 text-[#818cf8]" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">
                  ¿Tenés un evento?
                </p>
                <p className="text-[11px] text-muted-foreground/60 leading-snug">
                  Publicalo gratis y llegá a miles
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-[#34D399] shrink-0" />
                <span className="text-[11px] text-[#34D399] font-semibold">Gratis para eventos sin costo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <span className="text-[11px] text-muted-foreground/60">Aparecé en el mapa y en búsquedas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <span className="text-[11px] text-muted-foreground/60">Llegá a toda Uruguay</span>
              </div>
            </div>

            {/* CTA button */}
            <Link
              href="/publicar"
              className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-[12px] font-semibold text-[#c7d2fe] transition-colors hover:text-white"
              style={{
                backgroundColor: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            >
              <Send className="h-3.5 w-3.5" />
              Publicar mi evento
            </Link>
          </div>
        </div>

        {/* ── ANUNCIOS ── */}
        <div style={cardStyle}>
          {/* Label */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40">
              Publicidad
            </span>
            <Megaphone className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>

          {/* Ad 1 — Venue */}
          <a
            href="#"
            className="group flex items-start gap-3 rounded-lg p-3 mb-2 transition-colors hover:bg-white/[0.04] cursor-pointer"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-[14px] font-black text-[#94A3B8]"
              style={{
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              MF
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-foreground leading-tight">Magma Futura</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              </div>
              <span className="text-[11px] text-muted-foreground/60 leading-snug">
                El venue más innovador de Montevideo. Shows en vivo todos los fines de semana.
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground/40 mt-0.5">magmafutura.com.uy →</span>
            </div>
          </a>

          {/* Ad 2 — Ticketing */}
          <a
            href="#"
            className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-white/[0.04] cursor-pointer"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-[14px] font-black text-[#94A3B8]"
              style={{
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              RT
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-foreground leading-tight">RedTickets</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              </div>
              <span className="text-[11px] text-muted-foreground/60 leading-snug">
                Vendé entradas online para tu evento. Rápido, seguro y sin complicaciones.
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground/40 mt-0.5">redtickets.com.uy →</span>
            </div>
          </a>

          {/* CTA para anunciarse */}
          <Link
            href="/publicar#contacto"
            className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-[10px] font-semibold text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <Tag className="h-3 w-3" />
            Anunciá tu negocio aquí
          </Link>
        </div>

        {/* ── ESTADÍSTICAS ── */}
        {(stats.todayCount > 0 || stats.weekCount > 0) && (
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-[#10b981]" strokeWidth={2} />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#10b981]">
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
        <div style={cardStyle}>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3">
            Explorar
          </h2>
          <div className="space-y-0.5">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <Zap className="h-3.5 w-3.5 text-[#fbbf24] shrink-0" strokeWidth={2} />
              Eventos de hoy
            </Link>
            <Link
              href="/proximos"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5 text-[#6366f1] shrink-0" strokeWidth={2} />
              Próximos eventos
            </Link>
            <Link
              href="/mapa"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 text-[#14b8a6] shrink-0" strokeWidth={2} />
              Ver en el mapa
            </Link>
          </div>
        </div>

        {/* ── FOOTER NOTE ── */}
        <div className="flex flex-col gap-1 px-2 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="live-dot w-1.5 h-1.5" />
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
              Actualizado cada 5 minutos
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground/25 leading-relaxed">
            Eventos en Uruguay · ¿Dónde es Hoy?
          </p>
        </div>

      </div>
    </aside>
  );
}
