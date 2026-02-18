import Link from "next/link";
import { getTrendingEvents } from "@/lib/queries";
import { getTodayUY } from "@/lib/format";
import { formatTime } from "@/lib/format";
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
  ExternalLink,
  Megaphone,
  Star,
} from "lucide-react";

/**
 * Sidebar fijo full-height en desktop (lg+).
 * Ocupa el margen derecho vacío en pantallas anchas.
 * Contiene: trending events, categorías populares, ads placeholder, quick links.
 * Server component — fetches data directly.
 */
export async function DesktopSidebar() {
  const today = getTodayUY();
  const trending = await getTrendingEvents(today, 6);

  return (
    <aside className="hidden lg:flex flex-col w-[260px] xl:w-[280px] shrink-0">
      {/* Sticky container que ocupa todo el alto visible */}
      <div className="sticky top-[60px] h-[calc(100vh-60px)] flex flex-col gap-4 overflow-y-auto overflow-x-hidden py-4 pr-1 scrollbar-none">

        {/* ── AD PLACEHOLDER ── */}
        <div className="relative rounded-2xl overflow-hidden border border-neon-violet/20 bg-gradient-to-br from-neon-violet/10 via-neon-magenta/5 to-transparent">
          {/* Shimmer accent */}
          <div className="absolute inset-0 bg-gradient-to-br from-neon-violet/5 to-transparent pointer-events-none" />
          <div className="relative p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neon-violet/60">
                Publicidad
              </span>
              <Megaphone className="h-3 w-3 text-neon-violet/40" />
            </div>
            {/* Mock ad content */}
            <div className="flex flex-col gap-2">
              <div className="w-full h-[100px] rounded-xl bg-gradient-to-br from-neon-violet/20 via-neon-magenta/10 to-neon-cyan/10 flex items-center justify-center border border-white/5">
                <div className="text-center">
                  <div className="text-2xl mb-1">🎟️</div>
                  <p className="text-[10px] font-semibold text-white/70">Tu evento aquí</p>
                  <p className="text-[9px] text-white/40">Llegá a miles de personas</p>
                </div>
              </div>
              <a
                href="mailto:hola@dondeeshoy.com"
                className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-semibold text-neon-violet/80 hover:text-neon-violet transition-colors border border-neon-violet/20 hover:border-neon-violet/40 hover:bg-neon-violet/5"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Anunciá tu evento
              </a>
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
                      <span className="shrink-0 mt-0.5 text-[10px] font-bold font-mono text-muted-foreground/40 w-3 text-right">
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[11px] font-semibold text-foreground leading-snug group-hover:text-neon-violet transition-colors line-clamp-2">
                          {event.name}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <EventTypeBadge type={event.eventType} size="sm" />
                          {time && (
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/70">
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
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 transition-colors ${bg} border border-white/5`}
              >
                <Icon className={`h-3 w-3 shrink-0 ${color}`} strokeWidth={2} />
                <span className={`text-[10px] font-semibold ${color}`}>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── NOTICIAS / TIPS ── */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-magenta">
              💡 Sabías que...
            </span>
          </div>
          <div className="space-y-3">
            {[
              {
                emoji: "🎭",
                title: "Carnaval en marcha",
                desc: "El Carnaval uruguayo es el más largo del mundo. Seguí los tablados en tiempo real.",
                tag: "Tendencia",
                tagColor: "text-neon-magenta bg-neon-magenta/10",
              },
              {
                emoji: "🎵",
                title: "Música en vivo",
                desc: "Cada semana hay más de 50 shows en vivo en Montevideo. Filtrá por \"Concierto\".",
                tag: "Tip",
                tagColor: "text-neon-cyan bg-neon-cyan/10",
              },
              {
                emoji: "🆓",
                title: "Eventos gratis",
                desc: "Usá el filtro \"Gratis\" para descubrir actividades sin costo en tu ciudad.",
                tag: "Gratis",
                tagColor: "text-neon-green bg-neon-green/10",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-default"
              >
                <span className="text-base shrink-0 leading-none mt-0.5">{item.emoji}</span>
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-foreground">{item.title}</span>
                    <span className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${item.tagColor}`}>
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── QUICK LINKS ── */}
        <div className="glass-card rounded-2xl p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Explorar
          </h2>
          <div className="space-y-0.5">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <Zap className="h-3 w-3 text-neon-violet shrink-0" strokeWidth={2} />
              Eventos de hoy
            </Link>
            <Link
              href="/proximos"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <CalendarDays className="h-3 w-3 text-neon-cyan shrink-0" strokeWidth={2} />
              Próximos eventos
            </Link>
            <Link
              href="/mapa"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <MapPin className="h-3 w-3 text-neon-magenta shrink-0" strokeWidth={2} />
              Ver en el mapa
            </Link>
          </div>
        </div>

        {/* ── SEGUNDO AD PLACEHOLDER ── */}
        <div className="relative rounded-2xl overflow-hidden border border-neon-cyan/15 bg-gradient-to-br from-neon-cyan/8 via-transparent to-neon-blue/5">
          <div className="p-4 flex flex-col gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neon-cyan/50">
              Patrocinado
            </span>
            <div className="w-full h-[80px] rounded-xl bg-gradient-to-br from-neon-cyan/15 to-neon-blue/10 flex items-center justify-center border border-white/5">
              <div className="text-center">
                <div className="text-xl mb-1">🏟️</div>
                <p className="text-[10px] font-semibold text-white/60">Espacio disponible</p>
              </div>
            </div>
            <a
              href="mailto:hola@dondeeshoy.com"
              className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-semibold text-neon-cyan/70 hover:text-neon-cyan transition-colors border border-neon-cyan/15 hover:border-neon-cyan/35 hover:bg-neon-cyan/5"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Contactanos
            </a>
          </div>
        </div>

        {/* ── FOOTER NOTE ── */}
        <div className="flex flex-col gap-1 px-2 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="live-dot w-1.5 h-1.5" />
            <p className="text-[9px] text-muted-foreground/50 leading-relaxed">
              Actualizado cada 5 minutos
            </p>
          </div>
          <p className="text-[9px] text-muted-foreground/30 leading-relaxed">
            Eventos en Uruguay · ¿Dónde es Hoy?
          </p>
        </div>

      </div>
    </aside>
  );
}
