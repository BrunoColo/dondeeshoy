"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle,
  Sparkles,
  CalendarDays,
  MapPin,
  Ticket,
  User,
  Loader2,
  Clock,
  ChevronDown,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: "fiesta", label: "Fiesta" },
  { value: "festival", label: "Festival" },
  { value: "concierto", label: "Concierto" },
  { value: "recital", label: "Recital" },
  { value: "cultural", label: "Cultural" },
  { value: "deportivo", label: "Deportivo" },
  { value: "gastronomico", label: "Gastronómico" },
  { value: "familiar", label: "Familiar" },
  { value: "feria", label: "Feria" },
  { value: "taller", label: "Taller" },
  { value: "club", label: "Club" },
  { value: "bar", label: "Bar" },
  { value: "teatro", label: "Teatro" },
  { value: "otro", label: "Otro" },
] as const;

const DEPARTMENTS = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno",
  "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo",
  "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto",
  "San José", "Soriano", "Tacuarembó", "Treinta y Tres",
];

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const schema = z
  .object({
    eventName: z.string().min(3, "Mínimo 3 caracteres").max(255),
    eventDate: z.string().min(1, "La fecha es requerida"),
    eventTime: z.string().optional(),
    eventType: z.enum([
      "fiesta", "festival", "concierto", "recital", "cultural",
      "deportivo", "gastronomico", "familiar", "feria", "taller",
      "club", "bar", "teatro", "otro",
    ]),
    description: z.string().min(10, "Mínimo 10 caracteres").max(500, "Máximo 500 caracteres"),
    venueName: z.string().min(2, "Mínimo 2 caracteres").max(255),
    venueAddress: z.string().min(5, "Mínimo 5 caracteres").max(512),
    city: z.string().min(1, "Seleccioná un departamento"),
    isFree: z.boolean(),
    priceRange: z.string().max(100).optional(),
    ticketUrl: z.string().url("URL inválida").optional().or(z.literal("")),
    imageUrl: z.string().url("URL inválida").optional().or(z.literal("")),
    contactName: z.string().min(2, "Mínimo 2 caracteres").max(255),
    contactEmail: z.string().email("Email inválido"),
  })
  .refine(
    (d) => d.isFree || (d.priceRange && d.priceRange.length > 0),
    { message: "Indicá el rango de precio", path: ["priceRange"] }
  );

type FormValues = z.infer<typeof schema>;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border", color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-foreground/80">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-foreground/70">
        {label}
        {required && <span className="text-neon-magenta ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground/50">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Input styles ─────────────────────────────────────────────────────────────

const inputCls = (hasError?: boolean) =>
  cn(
    "w-full rounded-xl bg-white/[0.05] border px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/40",
    "focus:outline-none focus:border-neon-violet/50 focus:shadow-[0_0_12px_rgba(168,85,247,0.15)] transition-all duration-200",
    hasError ? "border-red-400/50" : "border-white/[0.1]"
  );

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublicarPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      isFree: true,
      eventType: "otro",
      city: "Montevideo",
    },
  });

  const isFree = watch("isFree");
  const description = watch("description") ?? "";

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.status === 429) {
        setServerError("Demasiadas solicitudes. Intentá de nuevo en una hora.");
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setServerError(json.error ?? "Ocurrió un error. Intentá de nuevo.");
        return;
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setServerError("Error de conexión. Verificá tu internet e intentá de nuevo.");
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          {/* Animated check */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-neon-green/20 blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-neon-green/20 to-neon-cyan/10 border border-neon-green/30 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-neon-green drop-shadow-[0_0_12px_rgba(74,222,128,0.6)]" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-bold text-foreground">
              ¡Solicitud enviada!
            </h1>
            <p className="text-[14px] text-muted-foreground/70 leading-relaxed">
              Tu solicitud fue enviada correctamente.{" "}
              <span className="text-foreground/80">
                Te contactaremos por email cuando sea revisada.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-neon-green/8 border border-neon-green/20 px-4 py-2.5">
            <BadgeCheck className="h-4 w-4 text-neon-green shrink-0" />
            <span className="text-[12px] font-semibold text-neon-green">
              Revisamos en menos de 48 horas
            </span>
          </div>

          <a
            href="/"
            className="text-[12px] font-semibold text-neon-violet/70 hover:text-neon-violet transition-colors"
          >
            ← Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">

      {/* Header */}
      <div className="mb-8 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-magenta/20 border border-neon-violet/25 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-neon-violet" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-violet/70">
            Publicación de eventos
          </span>
        </div>
        <h1 className="text-[26px] sm:text-[30px] font-extrabold text-foreground leading-tight">
          Publicá tu evento
        </h1>
        <p className="text-[14px] text-muted-foreground/70 leading-relaxed max-w-lg">
          Completá el formulario y lo revisamos en menos de 48 horas.
          Los eventos gratuitos (coffee raves, culturales, etc.) son publicados sin costo.
        </p>
        <div className="flex items-center gap-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-neon-green shrink-0" />
          <span className="text-[12px] font-semibold text-neon-green">
            Gratis para eventos sin costo de entrada
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" id="contacto">

        {/* ── Sección: Tu evento ── */}
        <Section
          icon={CalendarDays}
          title="Tu evento"
          color="bg-neon-violet/15 border-neon-violet/25 text-neon-violet"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Nombre del evento" required error={errors.eventName?.message}>
                <input
                  {...register("eventName")}
                  placeholder="Ej: Coffee Rave en el Parque"
                  className={inputCls(!!errors.eventName)}
                />
              </Field>
            </div>

            <Field label="Fecha" required error={errors.eventDate?.message}>
              <input
                type="date"
                {...register("eventDate")}
                className={inputCls(!!errors.eventDate)}
              />
            </Field>

            <Field label="Hora" hint="Opcional" error={errors.eventTime?.message}>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                <input
                  type="time"
                  {...register("eventTime")}
                  className={cn(inputCls(!!errors.eventTime), "pl-9")}
                />
              </div>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Tipo de evento" required error={errors.eventType?.message}>
                <div className="relative">
                  <select
                    {...register("eventType")}
                    className={cn(inputCls(!!errors.eventType), "appearance-none pr-9")}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-[#1a1a2e]">
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field
                label="Descripción"
                required
                error={errors.description?.message}
                hint={`${description.length}/500 caracteres`}
              >
                <textarea
                  {...register("description")}
                  rows={4}
                  placeholder="Contá de qué se trata el evento, artistas, propuesta…"
                  className={cn(inputCls(!!errors.description), "resize-none leading-relaxed")}
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* ── Sección: Ubicación ── */}
        <Section
          icon={MapPin}
          title="Ubicación"
          color="bg-neon-cyan/15 border-neon-cyan/25 text-neon-cyan"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Nombre del venue" required error={errors.venueName?.message}>
                <input
                  {...register("venueName")}
                  placeholder="Ej: Espacio Guambia"
                  className={inputCls(!!errors.venueName)}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Dirección" required error={errors.venueAddress?.message}>
                <input
                  {...register("venueAddress")}
                  placeholder="Ej: Av. 18 de Julio 1234"
                  className={inputCls(!!errors.venueAddress)}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Departamento" required error={errors.city?.message}>
                <div className="relative">
                  <select
                    {...register("city")}
                    className={cn(inputCls(!!errors.city), "appearance-none pr-9")}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d} className="bg-[#1a1a2e]">
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                </div>
              </Field>
            </div>
          </div>
        </Section>

        {/* ── Sección: Entradas ── */}
        <Section
          icon={Ticket}
          title="Entradas"
          color="bg-neon-green/15 border-neon-green/25 text-neon-green"
        >
          <div className="flex flex-col gap-4">
            {/* Free toggle */}
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-foreground">
                  Evento gratuito
                </span>
                <span className="text-[11px] text-muted-foreground/50">
                  Sin costo de entrada
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isFree}
                onClick={() => {
                  const el = document.querySelector<HTMLInputElement>('input[name="isFree"]');
                  if (el) {
                    el.click();
                  }
                }}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors duration-200 border",
                  isFree
                    ? "bg-neon-green/30 border-neon-green/40"
                    : "bg-white/[0.06] border-white/[0.12]"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200",
                    isFree
                      ? "translate-x-5 bg-neon-green shadow-[0_0_8px_rgba(74,222,128,0.5)]"
                      : "translate-x-0 bg-white/40"
                  )}
                />
              </button>
              <input
                type="checkbox"
                {...register("isFree")}
                className="sr-only"
              />
            </div>

            {/* Paid fields */}
            {!isFree && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Rango de precio"
                  required
                  error={errors.priceRange?.message}
                  hint="Ej: $300 – $600 UYU"
                >
                  <input
                    {...register("priceRange")}
                    placeholder="Ej: $300 – $600"
                    className={inputCls(!!errors.priceRange)}
                  />
                </Field>

                <Field
                  label="Link de venta"
                  hint="Opcional"
                  error={errors.ticketUrl?.message}
                >
                  <input
                    {...register("ticketUrl")}
                    type="url"
                    placeholder="https://ticketfacil.com.uy/…"
                    className={inputCls(!!errors.ticketUrl)}
                  />
                </Field>
              </div>
            )}

            {isFree && (
              <Field
                label="Link de inscripción"
                hint="Opcional — si requiere registro previo"
                error={errors.ticketUrl?.message}
              >
                <input
                  {...register("ticketUrl")}
                  type="url"
                  placeholder="https://…"
                  className={inputCls(!!errors.ticketUrl)}
                />
              </Field>
            )}

            <Field
              label="URL de imagen"
              hint="Opcional — imagen del flyer o banner (URL pública)"
              error={errors.imageUrl?.message}
            >
              <input
                {...register("imageUrl")}
                type="url"
                placeholder="https://…"
                className={inputCls(!!errors.imageUrl)}
              />
            </Field>
          </div>
        </Section>

        {/* ── Sección: Contacto ── */}
        <Section
          icon={User}
          title="Contacto"
          color="bg-neon-magenta/15 border-neon-magenta/25 text-neon-magenta"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tu nombre" required error={errors.contactName?.message}>
              <input
                {...register("contactName")}
                placeholder="Nombre completo"
                className={inputCls(!!errors.contactName)}
              />
            </Field>

            <Field label="Email de contacto" required error={errors.contactEmail?.message}>
              <input
                {...register("contactEmail")}
                type="email"
                placeholder="tu@email.com"
                className={inputCls(!!errors.contactEmail)}
              />
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
            Solo usamos tu email para notificarte sobre el estado de tu solicitud.
          </p>
        </Section>

        {/* Server error */}
        {serverError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
            <p className="text-[13px] text-red-400">{serverError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl py-3.5 px-6 text-[14px] font-bold text-white transition-all duration-200",
            "bg-gradient-to-r from-neon-violet to-neon-magenta shadow-[0_4px_20px_rgba(168,85,247,0.35)]",
            "hover:opacity-90 hover:shadow-[0_6px_24px_rgba(168,85,247,0.45)]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Enviar solicitud
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-muted-foreground/40">
          Al enviar aceptás que revisemos tu evento antes de publicarlo.
        </p>
      </form>
    </div>
  );
}
