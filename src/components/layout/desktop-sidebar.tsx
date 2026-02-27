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
  TrendingUp,
  ArrowRight,
} from "lucide-react";

/**
 * Sidebar fijo full-height en desktop (lg+).
 * Diseño premium inspirado en Linear/Vercel.
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
      <div className="sticky top-[60px] flex flex-col gap-2.5 overflow-x-hidden py-4 pr-1">

        {/* ── LIVE CLOCK — Premium card con gradiente ── */}
        <div
          className="relative overflow-hidden rounded-xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(3,3,10,0.98) 0%, rgba(5,4,14,0.98) 50%, rgba(3,5,10,0.98) 100%)",
            border: "1px solid rgba(99,102,241,0.35)",
            boxShadow: "0 6px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.10), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {/* Gradient overlay — más intenso para que resalte */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.16) 0%, rgba(13,148,136,0.10) 100%)",
            }}
          />
          {/* Glow orb */}
          <div
            className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)",
              filter: "blur(12px)",
            }}
          />
          <SidebarLiveClock />
        </div>

        {/* ── TRENDING HOY — Con numeración estilo ranking ── */}
        {trending.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(6,6,16,0.92) 0%, rgba(8,6,18,0.95) 100%)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            }}
          >
            {/* Header con gradiente */}
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ borderColor: "rgba(251,146,60,0.15)", background: "rgba(251,146,60,0.05)" }}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.25)" }}
              >
                <Flame className="h-3.5 w-3.5 text-orange-400" strokeWidth={2.5} />
              </div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-400">
                Más vistos hoy
              </h2>
              <TrendingUp className="h-3 w-3 text-orange-400/50 ml-auto" strokeWidth={2} />
            </div>

            <ul className="divide-y divide-white/[0.04]">
              {trending.map((event, i) => {
                const time = formatTime(event.startTime);
                return (
                  <li key={event.id}>
                    <Link
                      href={`/evento/${event.slug}`}
                      className="group flex items-start gap-3 px-4 py-3 transition-all duration-200 hover:bg-white/[0.04]"
                    >
                      {/* Rank number */}
                      <span
                        className="shrink-0 mt-0.5 text-[11px] font-black font-mono w-5 text-center leading-none"
                        style={{
                          color: i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7C2F" : "rgba(100,116,139,0.4)",
                        }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-[13px] font-semibold text-[#E2E8F0] leading-snug group-hover:text-white transition-colors line-clamp-2">
                          {event.name}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <EventTypeBadge type={event.eventType} size="sm" />
                          {time && (
                            <span className="text-[10px] text-[#94A3B8] font-mono">
                              {time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                          <MapPin className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                          <span className="truncate">{event.venueName}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-white/0 group-hover:text-white/30 transition-all shrink-0 mt-1 -translate-x-1 group-hover:translate-x-0" strokeWidth={2} />
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
            className="rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(6,6,16,0.92) 0%, rgba(8,6,18,0.95) 100%)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ borderColor: "rgba(129,140,248,0.15)", background: "rgba(99,102,241,0.06)" }}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}
              >
                <CalendarCheck className="h-3.5 w-3.5 text-[#818CF8]" strokeWidth={2} />
              </div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#818CF8]">
                Próximos destacados
              </h2>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {highlights.map((event) => {
                const { label: dateLabel, isToday, isTomorrow } = getDateLabel(event.date);
                const time = formatTime(event.startTime);
                return (
                  <Link
                    key={event.id}
                    href={`/evento/${event.slug}`}
                    className="group flex items-start gap-3 px-4 py-3 transition-all duration-200 hover:bg-white/[0.04]"
                  >
                    {/* Date pill — más visual */}
                    <div
                      className="shrink-0 flex flex-col items-center justify-center rounded-lg px-2 py-1.5 min-w-[42px]"
                      style={{
                        backgroundColor: isToday
                          ? "rgba(20,184,166,0.15)"
                          : isTomorrow
                          ? "rgba(99,102,241,0.12)"
                          : "rgba(255,255,255,0.05)",
                        border: isToday
                          ? "1px solid rgba(20,184,166,0.35)"
                          : isTomorrow
                          ? "1px solid rgba(99,102,241,0.30)"
                          : "1px solid rgba(255,255,255,0.10)",
                        boxShadow: isToday
                          ? "0 0 12px rgba(20,184,166,0.15)"
                          : isTomorrow
                          ? "0 0 12px rgba(99,102,241,0.12)"
                          : "none",
                      }}
                    >
                      <span
                        className="text-[9px] font-black uppercase leading-none tracking-wide"
                        style={{
                          color: isToday ? "#14B8A6" : isTomorrow ? "#818CF8" : "#94A3B8",
                        }}
                      >
                        {isToday ? "HOY" : isTomorrow ? "MAÑ" : dateLabel.slice(0, 3).toUpperCase()}
                      </span>
                      {time && (
                        <span className="text-[9px] font-mono leading-none mt-0.5 text-[#94A3B8]">
                          {time}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-[13px] font-semibold text-[#E2E8F0] leading-snug group-hover:text-white transition-colors line-clamp-2">
                        {event.name}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <EventTypeBadge type={event.eventType} size="sm" />
                        {event.isFree && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-[#14B8A6] bg-[rgba(20,184,166,0.10)] border border-[rgba(20,184,166,0.20)] px-1.5 py-0.5 rounded-full">
                            Gratis
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                        <MapPin className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                        <span className="truncate">{event.venueName}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div
              className="px-4 py-2.5 border-t"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <Link
                href="/proximos"
                className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#818CF8]/60 hover:text-[#818CF8] transition-colors group"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Ver todos los próximos
                <ArrowRight className="h-3 w-3 -translate-x-0.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        )}

        {/* ── CTA PUBLICAR — Diseño premium con gradiente ── */}
        <div
          className="relative overflow-hidden rounded-xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(6,6,16,0.92) 0%, rgba(8,6,18,0.95) 100%)",
            border: "1px solid rgba(13,148,136,0.25)",
            boxShadow: "0 4px 24px rgba(13,148,136,0.10), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Glow orb teal */}
          <div
            className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(13,148,136,0.25) 0%, transparent 70%)",
              filter: "blur(10px)",
            }}
          />

          <div className="relative flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(13,148,136,0.25) 0%, rgba(99,102,241,0.15) 100%)",
                  border: "1px solid rgba(13,148,136,0.30)",
                  boxShadow: "0 2px 8px rgba(13,148,136,0.15)",
                }}
              >
                <Rocket className="h-5 w-5 text-[#14B8A6]" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[14px] font-bold text-white leading-tight">
                  ¿Tenés un evento?
                </p>
                <p className="text-[11px] text-[#94A3B8] leading-snug">
                  Publicalo gratis y llegá a miles
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-col gap-1.5 pl-1">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5 text-[#34D399] shrink-0" />
                <span className="text-[11px] text-[#34D399] font-semibold">Gratis para eventos sin costo</span>
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
                <span className="text-[11px] text-[#B8C5D6]">Aparecé en el mapa y en búsquedas</span>
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
                <span className="text-[11px] text-[#B8C5D6]">Llegá a toda Uruguay</span>
              </div>
            </div>

            {/* CTA button — gradient sólido */}
            <Link
              href="/publicar"
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-[12px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 group"
              style={{
                background: "linear-gradient(135deg, #0D9488 0%, #6366F1 100%)",
                boxShadow: "0 4px 16px rgba(13,148,136,0.25), 0 4px 16px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <Send className="h-3.5 w-3.5" />
              Publicar mi evento
              <ArrowRight className="h-3.5 w-3.5 -translate-x-0.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* ── ANUNCIOS ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(6,6,16,0.92) 0%, rgba(8,6,18,0.95) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Label */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">
              Publicidad
            </span>
            <Megaphone className="h-3.5 w-3.5 text-[#94A3B8]" />
          </div>

          {/* Ad 1 — Venue */}
          <a
            href="#"
            className="group flex items-start gap-3 p-3.5 border-b border-white/[0.04] transition-all duration-200 hover:bg-white/[0.04] cursor-pointer"
          >
            <div
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-black text-[#B8C5D6]"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              MF
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-[#E2E8F0] leading-tight group-hover:text-white transition-colors">Magma Futura</span>
                <ExternalLink className="h-3 w-3 text-[#94A3B8] group-hover:text-[#94A3B8] shrink-0 transition-colors" />
              </div>
              <span className="text-[11px] text-[#94A3B8] leading-snug">
                El venue más innovador de Montevideo. Shows en vivo todos los fines de semana.
              </span>
              <span className="text-[10px] font-semibold text-[#14B8A6]/60 mt-0.5 group-hover:text-[#14B8A6] transition-colors">magmafutura.com.uy →</span>
            </div>
          </a>

          {/* Ad 2 — Ticketing */}
          <a
            href="#"
            className="group flex items-start gap-3 p-3.5 transition-all duration-200 hover:bg-white/[0.04] cursor-pointer"
          >
            <div
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-black text-[#B8C5D6]"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              RT
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-[#E2E8F0] leading-tight group-hover:text-white transition-colors">RedTickets</span>
                <ExternalLink className="h-3 w-3 text-[#94A3B8] group-hover:text-[#94A3B8] shrink-0 transition-colors" />
              </div>
              <span className="text-[11px] text-[#94A3B8] leading-snug">
                Vendé entradas online para tu evento. Rápido, seguro y sin complicaciones.
              </span>
              <span className="text-[10px] font-semibold text-[#818CF8]/60 mt-0.5 group-hover:text-[#818CF8] transition-colors">redtickets.com.uy →</span>
            </div>
          </a>

          {/* CTA para anunciarse */}
          <div className="px-3.5 py-2.5 border-t border-white/[0.06]">
            <Link
              href="/publicar#contacto"
              className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-[10px] font-semibold text-[#94A3B8] hover:text-[#B8C5D6] transition-colors border border-white/[0.08] hover:border-white/[0.15]"
            >
              <Tag className="h-3 w-3" />
              Anunciá tu negocio aquí
            </Link>
          </div>
        </div>

        {/* ── ESTADÍSTICAS — Con diseño de métricas ── */}
        {(stats.todayCount > 0 || stats.weekCount > 0) && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(6,6,16,0.92) 0%, rgba(8,6,18,0.95) 100%)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ borderColor: "rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.04)" }}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                <BarChart3 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
              </div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                En números
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3">
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

        {/* ── QUICK LINKS — Más visual ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(6,6,16,0.92) 0%, rgba(8,6,18,0.95) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">
              Explorar
            </h2>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5">
            <Link
              href="/"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.20)" }}
              >
                <Zap className="h-3.5 w-3.5 text-[#FBBF24]" strokeWidth={2} />
              </div>
              Eventos de hoy
              <ArrowRight className="h-3 w-3 ml-auto text-white/0 group-hover:text-white/30 transition-all -translate-x-1 group-hover:translate-x-0" strokeWidth={2} />
            </Link>
            <Link
              href="/proximos"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.20)" }}
              >
                <CalendarDays className="h-3.5 w-3.5 text-[#818CF8]" strokeWidth={2} />
              </div>
              Próximos eventos
              <ArrowRight className="h-3 w-3 ml-auto text-white/0 group-hover:text-white/30 transition-all -translate-x-1 group-hover:translate-x-0" strokeWidth={2} />
            </Link>
            <Link
              href="/mapa"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(13,148,136,0.12)", border: "1px solid rgba(13,148,136,0.20)" }}
              >
                <MapPin className="h-3.5 w-3.5 text-[#14B8A6]" strokeWidth={2} />
              </div>
              Ver en el mapa
              <ArrowRight className="h-3 w-3 ml-auto text-white/0 group-hover:text-white/30 transition-all -translate-x-1 group-hover:translate-x-0" strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* ── FOOTER NOTE ── */}
        <div className="flex flex-col gap-1 px-2 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="live-dot w-1.5 h-1.5" />
            <p className="text-[10px] text-[#94A3B8] leading-relaxed">
              Actualizado cada 5 minutos
            </p>
          </div>
          <p className="text-[10px] text-[#2D3748] leading-relaxed">
            Eventos en Uruguay · ¿Dónde es Hoy?
          </p>
        </div>

      </div>
    </aside>
  );
}
