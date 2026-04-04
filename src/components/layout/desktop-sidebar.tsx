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
  TrendingUp,
  Mail,
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

        {/* ── LIVE CLOCK — consistente con el resto del sidebar ── */}
        <div
          className="rounded-xl overflow-hidden p-4"
          style={{
            background: "linear-gradient(135deg, rgba(10,10,22,0.90) 0%, rgba(12,10,24,0.93) 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
          }}
        >
          <SidebarLiveClock />
        </div>

        {/* ── TRENDING HOY — Con numeración estilo ranking ── */}
        {trending.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(10,10,22,0.90) 0%, rgba(12,10,24,0.93) 100%)",
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
                            <span className="text-[10px] text-[#A8B8CC] font-mono">
                              {time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#A8B8CC]">
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
            className="rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(10,10,22,0.90) 0%, rgba(12,10,24,0.93) 100%)",
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
                      <div className="flex items-center gap-1 text-[10px] text-[#A8B8CC]">
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
                className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#818CF8]/80 hover:text-[#818CF8] transition-colors"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Ver todos los próximos
              </Link>
            </div>
          </div>
        )}

        {/* ── CTA PUBLICAR — Diseño premium con gradiente ── */}
        <div
          className="relative overflow-hidden rounded-xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(10,10,22,0.90) 0%, rgba(12,10,24,0.93) 100%)",
            border: "1px solid rgba(13,148,136,0.25)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
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
                <p className="text-[11px] text-[#A8B8CC] leading-snug">
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
                <BadgeCheck className="h-3.5 w-3.5 text-[#A8B8CC] shrink-0" />
                <span className="text-[11px] text-[#CBD5E1]">Aparecé en el mapa y en búsquedas</span>
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5 text-[#A8B8CC] shrink-0" />
                <span className="text-[11px] text-[#CBD5E1]">Llegá a toda Uruguay</span>
              </div>
            </div>

            {/* CTA button — gradient visible */}
            <Link
              href="/publicar"
              className="flex items-center justify-center rounded-xl py-2.5 px-4 text-[12px] font-bold text-white transition-all duration-200 hover:brightness-110 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:-translate-y-px active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #0D9488 100%)",
                border: "1px solid rgba(99,102,241,0.40)",
                boxShadow: "0 2px 12px rgba(99,102,241,0.20), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              Publicar mi evento
            </Link>
          </div>
        </div>

        {/* ── BOLETÍN CTA ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(10,10,22,0.90) 0%, rgba(12,10,24,0.93) 100%)",
            border: "1px solid rgba(99,102,241,0.18)",
          }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "rgba(99,102,241,0.12)", background: "rgba(99,102,241,0.04)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.30)" }}
              >
                <Mail className="h-3.5 w-3.5 text-[#818CF8]" strokeWidth={2} />
              </div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#818CF8]">
                Boletín de eventos
              </h2>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <p className="text-[12px] text-[#CBD5E1] leading-relaxed">
              Recibí los mejores eventos de la semana directo en tu correo. Sin spam.
            </p>
            <Link
              href="/suscribirse"
              className="flex items-center justify-center rounded-xl py-2.5 px-4 text-[12px] font-bold text-white transition-all duration-200 hover:brightness-110 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:-translate-y-px active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #0D9488 100%)",
                border: "1px solid rgba(99,102,241,0.40)",
                boxShadow: "0 2px 12px rgba(99,102,241,0.20), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              Suscribirme gratis
            </Link>
          </div>
        </div>

        {/* ── ANUNCIOS ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(10,10,22,0.92) 0%, rgba(14,11,28,0.96) 55%, rgba(9,15,24,0.94) 100%)",
            border: "1px solid rgba(99,102,241,0.16)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
          }}
        >
          {/* Label */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{
              borderColor: "rgba(99,102,241,0.14)",
              background: "linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(13,148,136,0.05) 100%)",
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#B8C5FF]">
              Publicidad
            </span>
            <Megaphone className="h-3.5 w-3.5 text-[#B8C5FF]" />
          </div>

          {/* Ad 1 — Venue */}
          <a
            href="#"
            className="group flex items-start gap-3 p-3.5 border-b border-white/[0.04] transition-all duration-200 hover:bg-white/[0.04] cursor-pointer"
          >
            <div
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-black text-[#B8C5D6]"
              style={{
                background: "linear-gradient(135deg, rgba(20,184,166,0.20) 0%, rgba(99,102,241,0.12) 100%)",
                border: "1px solid rgba(20,184,166,0.18)",
              }}
            >
              MF
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-[#E2E8F0] leading-tight group-hover:text-white transition-colors">Magma Futura</span>
                <ExternalLink className="h-3 w-3 text-[#94A3B8] group-hover:text-[#94A3B8] shrink-0 transition-colors" />
              </div>
              <span className="text-[11px] text-[#A8B8CC] leading-snug">
                El venue más innovador de Montevideo. Shows en vivo todos los fines de semana.
              </span>
              <span className="text-[10px] font-semibold text-[#14B8A6]/75 mt-0.5 group-hover:text-[#14B8A6] transition-colors">magmafutura.com.uy</span>
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
                background: "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(129,140,248,0.10) 100%)",
                border: "1px solid rgba(129,140,248,0.20)",
              }}
            >
              RT
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-[#E2E8F0] leading-tight group-hover:text-white transition-colors">RedTickets</span>
                <ExternalLink className="h-3 w-3 text-[#94A3B8] group-hover:text-[#94A3B8] shrink-0 transition-colors" />
              </div>
              <span className="text-[11px] text-[#A8B8CC] leading-snug">
                Vendé entradas online para tu evento. Rápido, seguro y sin complicaciones.
              </span>
              <span className="text-[10px] font-semibold text-[#818CF8]/75 mt-0.5 group-hover:text-[#818CF8] transition-colors">redtickets.com.uy</span>
            </div>
          </a>

          {/* CTA para anunciarse */}
          <div className="px-3.5 py-2.5 border-t border-white/[0.06]">
            <Link
              href="/publicar#contacto"
              className="flex items-center justify-center rounded-xl py-2.5 px-4 text-[12px] font-bold text-white transition-all duration-200 hover:brightness-110 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:-translate-y-px active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #0D9488 100%)",
                border: "1px solid rgba(99,102,241,0.40)",
                boxShadow: "0 2px 12px rgba(99,102,241,0.20), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              Anunciá tu negocio aquí
            </Link>
          </div>
        </div>

        {/* ── ESTADÍSTICAS — Con diseño de métricas ── */}
        {(stats.todayCount > 0 || stats.weekCount > 0) && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(10,10,22,0.90) 0%, rgba(12,10,24,0.93) 100%)",
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
            background: "linear-gradient(135deg, rgba(10,10,22,0.90) 0%, rgba(12,10,24,0.93) 100%)",
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
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.30)" }}
              >
                <Zap className="h-3.5 w-3.5 text-[#FBBF24]" strokeWidth={2} />
              </div>
              Eventos de hoy
            </Link>
            <Link
              href="/proximos"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.30)" }}
              >
                <CalendarDays className="h-3.5 w-3.5 text-[#818CF8]" strokeWidth={2} />
              </div>
              Próximos eventos
            </Link>
            <Link
              href="/mapa"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(13,148,136,0.12)", border: "1px solid rgba(13,148,136,0.20)" }}
              >
                <MapPin className="h-3.5 w-3.5 text-[#14B8A6]" strokeWidth={2} />
              </div>
              Ver en el mapa
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
          <p className="text-[10px] text-[#A8B8CC] leading-relaxed">
            Eventos en Uruguay · ¿Dónde es Hoy?
          </p>
        </div>

      </div>
    </aside>
  );
}
