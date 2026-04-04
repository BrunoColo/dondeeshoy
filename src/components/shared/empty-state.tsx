import Link from "next/link";
import { cn } from "@/lib/utils";
import { CalendarOff, Compass, Music } from "lucide-react";

interface EmptyStateProps {
  variant?: "today" | "upcoming" | "search";
  className?: string;
}

const VARIANTS = {
  today: {
    icon: Music,
    title: "No hay eventos hoy",
    description: "Parece que hoy Uruguay descansa. Revisá los próximos días para planear tu salida.",
    accentColor: "text-accent-light",
  },
  upcoming: {
    icon: CalendarOff,
    title: "No hay eventos próximos",
    description: "Todavía no tenemos eventos cargados para los próximos días. Volvé pronto.",
    accentColor: "text-accent2",
  },
  search: {
    icon: Compass,
    title: "Sin resultados",
    description: "No encontramos eventos que coincidan. Probá con otro filtro.",
    accentColor: "text-accent3",
    ctaHref: "/suscribirse?utm_source=empty-search&utm_medium=cta&utm_campaign=newsletter",
    ctaLabel: "Recibir recomendaciones por mail",
  },
} as const;

export function EmptyState({ variant = "today", className }: EmptyStateProps) {
  const config = VARIANTS[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center fade-up",
        className,
      )}
    >
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <Icon className={cn("h-8 w-8", config.accentColor)} strokeWidth={1.5} />
        </div>
        {/* Subtle glow behind icon */}
        <div
          className={cn(
            "absolute inset-0 -z-10 rounded-2xl opacity-20 blur-2xl",
            variant === "today" && "bg-accent",
            variant === "upcoming" && "bg-accent2",
            variant === "search" && "bg-accent3",
          )}
        />
      </div>

      <div className="space-y-2">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {config.title}
        </h3>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {config.description}
        </p>

        {"ctaHref" in config && config.ctaHref && "ctaLabel" in config && config.ctaLabel && (
          <div className="pt-1.5">
            <Link
              href={config.ctaHref}
              className="inline-flex min-h-10 items-center rounded-full border border-indigo-400/35 bg-gradient-to-r from-indigo-500/20 to-teal-500/20 px-4 py-2 text-[12px] font-semibold text-white transition hover:brightness-110"
            >
              {config.ctaLabel}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
