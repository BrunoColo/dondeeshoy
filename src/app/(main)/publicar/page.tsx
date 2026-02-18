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
  BadgeCheck,
  ChevronDown,
  DollarSign,
  Gift,
  Link2,
  Image,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: "fiesta", label: "🎉 Fiesta" },
  { value: "festival", label: "🎪 Festival" },
  { value: "concierto", label: "🎵 Concierto" },
  { value: "recital", label: "🎸 Recital" },
  { value: "cultural", label: "🎭 Cultural" },
  { value: "deportivo", label: "⚽ Deportivo" },
  { value: "gastronomico", label: "🍽️ Gastronómico" },
  { value: "familiar", label: "👨‍👩‍👧 Familiar" },
  { value: "feria", label: "🛍️ Feria" },
  { value: "taller", label: "🎨 Taller" },
  { value: "club", label: "🎧 Club" },
  { value: "bar", label: "🍺 Bar" },
  { value: "teatro", label: "🎬 Teatro" },
  { value: "otro", label: "✨ Otro" },
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
    { message: "Indicá el rango de precio para eventos pagos", path: ["priceRange"] }
  );

type FormValues = z.infer<typeof schema>;

// ─── Shared input class ───────────────────────────────────────────────────────

const inputBase = (hasError?: boolean) =>
  cn(
    "w-full rounded-xl px-4 py-3 text-[14px] text-foreground",
    "bg-[rgba(255,255,255,0.04)] border transition-all duration-200",
    "placeholder:text-[#64748B]",
    "focus:outline-none focus:bg-[rgba(255,255,255,0.06)]",
    "focus:border-[rgba(168,85,247,0.5)] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.1)]",
    hasError
      ? "border-[rgba(239,68,68,0.5)] shadow-[0_0_0_3px_rgba(239,68,68,0.08)]"
      : "border-[rgba(255,255,255,0.1)]"
  );

// ─── Select class (dark background for dropdown) ──────────────────────────────

const selectBase = (hasError?: boolean) =>
  cn(
    inputBase(hasError),
    "appearance-none pr-10 cursor-pointer",
    // Force dark background on the select element itself
    "[color-scheme:dark]"
  );

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  subtitle,
  accentColor,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.07)]">
      {/* Section header */}
      <div className={cn("px-5 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)]", accentColor)}>
        <Icon className="h-4 w-4 shrink-0" />
        <div>
          <h2 className="text-[13px] font-bold tracking-wide">{title}</h2>
          {subtitle && (
            <p className="text-[11px] opacity-70 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {/* Section body */}
      <div className="bg-[rgba(255,255,255,0.02)] p-5 sm:p-6">
        {children}
      </div>
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
    <div className="flex flex-col gap-2">
      <label className="text-[12px] font-semibold text-[#94A3B8] uppercase tracking-wider">
        {label}
        {required && <span className="text-[#EC4899] ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-[#64748B]">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-[#F87171] flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublicarPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center gap-8 text-center max-w-md">
          {/* Animated check */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#34D399]/15 blur-2xl animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#34D399]/20 to-[#22D3EE]/10 border border-[#34D399]/30 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-[#34D399] drop-shadow-[0_0_16px_rgba(52,211,153,0.7)]" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-[28px] font-extrabold text-foreground">
              ¡Solicitud enviada!
            </h1>
            <p className="text-[15px] text-[#94A3B8] leading-relaxed">
              Tu solicitud fue enviada.{" "}
              <span className="text-foreground font-medium">
                Te contactaremos por email cuando sea revisada.
              </span>
            </p>
          </div>

          <div className="w-full rounded-2xl bg-[rgba(52,211,153,0.06)] border border-[rgba(52,211,153,0.2)] px-5 py-4 flex items-center gap-3">
            <BadgeCheck className="h-5 w-5 text-[#34D399] shrink-0" />
            <div className="text-left">
              <p className="text-[13px] font-semibold text-[#34D399]">Revisamos en menos de 48 horas</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Te avisamos al email que ingresaste</p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] font-semibold text-[#A855F7]/70 hover:text-[#A855F7] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

      {/* ── Page header ── */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#A855F7]/25 to-[#EC4899]/15 border border-[#A855F7]/25 flex items-center justify-center">
            <Sparkles className="h-4.5 w-4.5 text-[#A855F7]" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#A855F7]/70">
            Publicación de eventos
          </span>
        </div>

        <h1 className="text-[30px] sm:text-[36px] font-extrabold text-foreground leading-tight mb-3">
          Publicá tu evento
        </h1>
        <p className="text-[15px] text-[#94A3B8] leading-relaxed max-w-lg mb-5">
          Completá el formulario y lo revisamos en menos de 48 horas.
          Los eventos gratuitos son publicados sin costo.
        </p>

        <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.2)] px-4 py-2">
          <BadgeCheck className="h-4 w-4 text-[#34D399] shrink-0" />
          <span className="text-[12px] font-semibold text-[#34D399]">
            Gratis para eventos sin costo de entrada
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" id="contacto" noValidate>

        {/* ── 1. Tu evento ── */}
        <Section
          icon={CalendarDays}
          title="Tu evento"
          subtitle="Información principal del evento"
          accentColor="bg-[rgba(168,85,247,0.08)] text-[#A855F7]"
        >
          <div className="flex flex-col gap-5">
            <Field label="Nombre del evento" required error={errors.eventName?.message}>
              <input
                {...register("eventName")}
                placeholder="Ej: Coffee Rave en el Parque Rodó"
                className={inputBase(!!errors.eventName)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Fecha" required error={errors.eventDate?.message}>
                <input
                  type="date"
                  {...register("eventDate")}
                  className={inputBase(!!errors.eventDate)}
                />
              </Field>

              <Field label="Hora de inicio" hint="Opcional" error={errors.eventTime?.message}>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
                  <input
                    type="time"
                    {...register("eventTime")}
                    className={cn(inputBase(!!errors.eventTime), "pl-10")}
                  />
                </div>
              </Field>
            </div>

            <Field label="Tipo de evento" required error={errors.eventType?.message}>
              <div className="relative">
                <select
                  {...register("eventType")}
                  className={selectBase(!!errors.eventType)}
                  style={{ backgroundColor: "#0C0C16", color: "#F1F5F9" }}
                >
                  {EVENT_TYPES.map((t) => (
                    <option
                      key={t.value}
                      value={t.value}
                      style={{ backgroundColor: "#141424", color: "#F1F5F9" }}
                    >
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
              </div>
            </Field>

            <Field
              label="Descripción"
              required
              error={errors.description?.message}
              hint={`${description.length} / 500 caracteres`}
            >
              <textarea
                {...register("description")}
                rows={5}
                placeholder="Contá de qué se trata el evento: artistas, propuesta, ambiente, qué pueden esperar los asistentes…"
                className={cn(inputBase(!!errors.description), "resize-none leading-relaxed")}
              />
            </Field>
          </div>
        </Section>

        {/* ── 2. Ubicación ── */}
        <Section
          icon={MapPin}
          title="Ubicación"
          subtitle="¿Dónde se realiza el evento?"
          accentColor="bg-[rgba(34,211,238,0.08)] text-[#22D3EE]"
        >
          <div className="flex flex-col gap-5">
            <Field label="Nombre del venue" required error={errors.venueName?.message}>
              <input
                {...register("venueName")}
                placeholder="Ej: Espacio Guambia, Club Montevideo, Parque Rodó"
                className={inputBase(!!errors.venueName)}
              />
            </Field>

            <Field label="Dirección" required error={errors.venueAddress?.message}>
              <input
                {...register("venueAddress")}
                placeholder="Ej: Av. 18 de Julio 1234, Montevideo"
                className={inputBase(!!errors.venueAddress)}
              />
            </Field>

            <Field label="Departamento" required error={errors.city?.message}>
              <div className="relative">
                <select
                  {...register("city")}
                  className={selectBase(!!errors.city)}
                  style={{ backgroundColor: "#0C0C16", color: "#F1F5F9" }}
                >
                  {DEPARTMENTS.map((d) => (
                    <option
                      key={d}
                      value={d}
                      style={{ backgroundColor: "#141424", color: "#F1F5F9" }}
                    >
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
              </div>
            </Field>
          </div>
        </Section>

        {/* ── 3. Entradas ── */}
        <Section
          icon={Ticket}
          title="Entradas"
          subtitle="¿El evento es gratuito o tiene costo?"
          accentColor="bg-[rgba(52,211,153,0.08)] text-[#34D399]"
        >
          <div className="flex flex-col gap-5">

            {/* Free / Paid toggle — two big cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Gratis */}
              <button
                type="button"
                onClick={() => setValue("isFree", true, { shouldValidate: true })}
                className={cn(
                  "relative flex flex-col items-center gap-2.5 rounded-xl p-4 border-2 transition-all duration-200 text-center",
                  isFree
                    ? "border-[#34D399] bg-[rgba(52,211,153,0.1)] shadow-[0_0_20px_rgba(52,211,153,0.15)]"
                    : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.15)]"
                )}
              >
                {isFree && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#34D399] flex items-center justify-center">
                    <span className="text-[8px] text-black font-bold">✓</span>
                  </span>
                )}
                <Gift className={cn("h-6 w-6", isFree ? "text-[#34D399]" : "text-[#64748B]")} />
                <div>
                  <p className={cn("text-[13px] font-bold", isFree ? "text-[#34D399]" : "text-[#94A3B8]")}>
                    Gratuito
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">Sin costo de entrada</p>
                </div>
              </button>

              {/* Pago */}
              <button
                type="button"
                onClick={() => setValue("isFree", false, { shouldValidate: true })}
                className={cn(
                  "relative flex flex-col items-center gap-2.5 rounded-xl p-4 border-2 transition-all duration-200 text-center",
                  !isFree
                    ? "border-[#FBBF24] bg-[rgba(251,191,36,0.08)] shadow-[0_0_20px_rgba(251,191,36,0.12)]"
                    : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.15)]"
                )}
              >
                {!isFree && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#FBBF24] flex items-center justify-center">
                    <span className="text-[8px] text-black font-bold">✓</span>
                  </span>
                )}
                <DollarSign className={cn("h-6 w-6", !isFree ? "text-[#FBBF24]" : "text-[#64748B]")} />
                <div>
                  <p className={cn("text-[13px] font-bold", !isFree ? "text-[#FBBF24]" : "text-[#94A3B8]")}>
                    Con costo
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">Tiene precio de entrada</p>
                </div>
              </button>
            </div>

            {/* Hidden checkbox for RHF */}
            <input type="checkbox" {...register("isFree")} className="sr-only" />

            {/* Paid-only fields */}
            {!isFree && (
              <div className="rounded-xl bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.15)] p-4 flex flex-col gap-4">
                <p className="text-[11px] font-semibold text-[#FBBF24]/80 uppercase tracking-wider">
                  Detalles del precio
                </p>
                <Field
                  label="Rango de precio"
                  required
                  error={errors.priceRange?.message}
                  hint="Ej: $300 – $600 UYU · Entrada general $400"
                >
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
                    <input
                      {...register("priceRange")}
                      placeholder="Ej: $300 – $600 UYU"
                      className={cn(inputBase(!!errors.priceRange), "pl-10")}
                    />
                  </div>
                </Field>

                <Field
                  label="Link de venta de entradas"
                  hint="Opcional — Ticketfacil, RedTickets, etc."
                  error={errors.ticketUrl?.message}
                >
                  <div className="relative">
                    <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
                    <input
                      {...register("ticketUrl")}
                      type="url"
                      placeholder="https://ticketfacil.com.uy/…"
                      className={cn(inputBase(!!errors.ticketUrl), "pl-10")}
                    />
                  </div>
                </Field>
              </div>
            )}

            {/* Free-only: optional registration link */}
            {isFree && (
              <Field
                label="Link de inscripción"
                hint="Opcional — si el evento requiere registro previo"
                error={errors.ticketUrl?.message}
              >
                <div className="relative">
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
                  <input
                    {...register("ticketUrl")}
                    type="url"
                    placeholder="https://…"
                    className={cn(inputBase(!!errors.ticketUrl), "pl-10")}
                  />
                </div>
              </Field>
            )}

            {/* Image URL — always visible */}
            <Field
              label="URL de imagen / flyer"
              hint="Opcional — URL pública de la imagen del evento (JPG, PNG, WebP)"
              error={errors.imageUrl?.message}
            >
              <div className="relative">
                <Image className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none" />
                <input
                  {...register("imageUrl")}
                  type="url"
                  placeholder="https://…"
                  className={cn(inputBase(!!errors.imageUrl), "pl-10")}
                />
              </div>
            </Field>
          </div>
        </Section>

        {/* ── 4. Contacto ── */}
        <Section
          icon={User}
          title="Contacto"
          subtitle="¿Quién organiza el evento?"
          accentColor="bg-[rgba(236,72,153,0.08)] text-[#EC4899]"
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Tu nombre" required error={errors.contactName?.message}>
                <input
                  {...register("contactName")}
                  placeholder="Nombre completo"
                  className={inputBase(!!errors.contactName)}
                />
              </Field>

              <Field label="Email de contacto" required error={errors.contactEmail?.message}>
                <input
                  {...register("contactEmail")}
                  type="email"
                  placeholder="tu@email.com"
                  className={inputBase(!!errors.contactEmail)}
                />
              </Field>
            </div>

            <div className="rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] px-4 py-3">
              <p className="text-[12px] text-[#64748B] leading-relaxed">
                🔒 Tu email solo se usa para notificarte sobre el estado de tu solicitud. No lo compartimos con terceros.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Server error ── */}
        {serverError && (
          <div className="rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-4 py-3.5 flex items-start gap-3">
            <span className="text-[#F87171] text-[16px] shrink-0">⚠</span>
            <p className="text-[13px] text-[#F87171] leading-relaxed">{serverError}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 px-6",
            "text-[15px] font-bold text-white tracking-wide",
            "bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#EC4899]",
            "shadow-[0_4px_24px_rgba(168,85,247,0.4)]",
            "hover:shadow-[0_6px_32px_rgba(168,85,247,0.55)] hover:opacity-95",
            "active:scale-[0.98] transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Enviando solicitud…
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Enviar solicitud
            </>
          )}
        </button>

        <p className="text-center text-[12px] text-[#64748B]">
          Al enviar aceptás que revisemos tu evento antes de publicarlo en ¿Dónde es Hoy?
        </p>
      </form>
    </div>
  );
}
