"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle,
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
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
    { message: "Indicá el rango de precio para eventos pagos", path: ["priceRange"] }
  );

type FormValues = z.infer<typeof schema>;

// ─── Shared input class ───────────────────────────────────────────────────────

const inputBase = (hasError?: boolean) =>
  cn(
    "w-full rounded-lg px-4 py-3 text-[14px] text-foreground",
    "bg-[#111120] border transition-all duration-150",
    "placeholder:text-[#5A6A80]",
    "focus:outline-none focus:bg-[#16162A]",
    "focus:border-[rgba(99,102,241,0.50)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]",
    hasError
      ? "border-[rgba(239,68,68,0.45)] shadow-[0_0_0_3px_rgba(239,68,68,0.06)]"
      : "border-[rgba(255,255,255,0.15)]"
  );

// ─── Select class ─────────────────────────────────────────────────────────────

const selectBase = (hasError?: boolean) =>
  cn(
    inputBase(hasError),
    "appearance-none pr-10 cursor-pointer",
    "[color-scheme:dark]"
  );

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  subtitle,
  accent = "#0D9488",
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", borderLeft: `3px solid ${accent}` }}>
      {/* Section header */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)]" style={{ backgroundColor: "#0D0D18" }}>
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}18`, border: `1px solid ${accent}35` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        </div>
        <div>
          <h2 className="text-[13px] font-semibold text-[#E2E8F0] tracking-wide">{title}</h2>
          {subtitle && (
            <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {/* Section body */}
      <div className="p-5 sm:p-6" style={{ backgroundColor: "#0D0D1A" }}>
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
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
        {label}
        {required && <span className="text-[#94A3B8] ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-[#475569]">{hint}</p>
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
          {/* Check icon */}
          <div className="w-20 h-20 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-[#34D399]" />
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-[26px] font-bold text-foreground">
              Solicitud enviada
            </h1>
            <p className="text-[14px] text-[#94A3B8] leading-relaxed">
              Tu solicitud fue recibida.{" "}
              <span className="text-foreground font-medium">
                Te contactaremos por email cuando sea revisada.
              </span>
            </p>
          </div>

          <div className="w-full rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] px-5 py-4 flex items-center gap-3">
            <BadgeCheck className="h-5 w-5 text-[#94A3B8] shrink-0" />
            <div className="text-left">
              <p className="text-[13px] font-semibold text-[#E2E8F0]">Revisamos en menos de 48 horas</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Te avisamos al email que ingresaste</p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-[#64748B] hover:text-[#94A3B8] transition-colors"
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
      <div className="mb-8 border-b border-[rgba(255,255,255,0.06)] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#818CF8] mb-3">
          Publicación de eventos
        </p>
        <h1 className="text-[28px] sm:text-[34px] font-bold text-foreground leading-tight mb-3">
          Publicá tu evento
        </h1>
        <p className="text-[14px] text-[#64748B] leading-relaxed max-w-lg mb-5">
          Completá el formulario y lo revisamos en menos de 48 horas.
          Los eventos gratuitos son publicados sin costo.
        </p>

        <div className="inline-flex items-center gap-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] px-3.5 py-2">
          <BadgeCheck className="h-3.5 w-3.5 text-[#34D399] shrink-0" />
          <span className="text-[12px] text-[#94A3B8]">
            Gratis para eventos sin costo de entrada
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" id="contacto" noValidate>

        {/* ── 1. Tu evento ── */}
        <Section
          icon={CalendarDays}
          title="Tu evento"
          subtitle="Información principal del evento"
          accent="#0D9488"
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
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none" />
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
                  style={{ backgroundColor: "#111120", color: "#F1F5F9" }}
                >
                  {EVENT_TYPES.map((t) => (
                    <option
                      key={t.value}
                      value={t.value}
                      style={{ backgroundColor: "#111120", color: "#F1F5F9" }}
                    >
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none" />
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
          accent="#14b8a6"
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
                  style={{ backgroundColor: "#111120", color: "#F1F5F9" }}
                >
                  {DEPARTMENTS.map((d) => (
                    <option
                      key={d}
                      value={d}
                      style={{ backgroundColor: "#111120", color: "#F1F5F9" }}
                    >
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none" />
              </div>
            </Field>
          </div>
        </Section>

        {/* ── 3. Entradas ── */}
        <Section
          icon={Ticket}
          title="Entradas"
          subtitle="¿El evento es gratuito o tiene costo?"
          accent="#10b981"
        >
          <div className="flex flex-col gap-5">

            {/* Free / Paid toggle */}
            <div className="grid grid-cols-2 gap-3">
              {/* Gratis */}
              <button
                type="button"
                onClick={() => setValue("isFree", true, { shouldValidate: true })}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-lg p-4 border transition-all duration-150 text-center",
                  isFree
                    ? "border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)]"
                    : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.1)]"
                )}
              >
                {isFree && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">✓</span>
                  </span>
                )}
                <Gift className={cn("h-5 w-5", isFree ? "text-[#E2E8F0]" : "text-[#475569]")} />
                <div>
                  <p className={cn("text-[13px] font-semibold", isFree ? "text-[#E2E8F0]" : "text-[#64748B]")}>
                    Gratuito
                  </p>
                  <p className="text-[10px] text-[#475569] mt-0.5">Sin costo de entrada</p>
                </div>
              </button>

              {/* Pago */}
              <button
                type="button"
                onClick={() => setValue("isFree", false, { shouldValidate: true })}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-lg p-4 border transition-all duration-150 text-center",
                  !isFree
                    ? "border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)]"
                    : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.1)]"
                )}
              >
                {!isFree && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">✓</span>
                  </span>
                )}
                <DollarSign className={cn("h-5 w-5", !isFree ? "text-[#E2E8F0]" : "text-[#475569]")} />
                <div>
                  <p className={cn("text-[13px] font-semibold", !isFree ? "text-[#E2E8F0]" : "text-[#64748B]")}>
                    Con costo
                  </p>
                  <p className="text-[10px] text-[#475569] mt-0.5">Tiene precio de entrada</p>
                </div>
              </button>
            </div>

            {/* Hidden checkbox for RHF */}
            <input type="checkbox" {...register("isFree")} className="sr-only" />

            {/* Paid-only fields */}
            {!isFree && (
              <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] p-4 flex flex-col gap-4">
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  Detalles del precio
                </p>
                <Field
                  label="Rango de precio"
                  required
                  error={errors.priceRange?.message}
                  hint="Ej: $300 – $600 UYU · Entrada general $400"
                >
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none" />
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
                    <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none" />
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
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none" />
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
                <Image className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] pointer-events-none" />
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
          accent="#0D9488"
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

            <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] px-4 py-3">
              <p className="text-[12px] text-[#475569] leading-relaxed">
                Tu email solo se usa para notificarte sobre el estado de tu solicitud. No lo compartimos con terceros.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Server error ── */}
        {serverError && (
          <div className="rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.18)] px-4 py-3.5 flex items-start gap-3">
            <span className="text-[#F87171] text-[16px] shrink-0">⚠</span>
            <p className="text-[13px] text-[#F87171] leading-relaxed">{serverError}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 rounded-xl py-4 px-6",
            "text-[15px] font-bold text-white tracking-wide",
            "transition-all duration-200 active:scale-[0.99]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "hover:-translate-y-0.5"
          )}
          style={{
            background: "linear-gradient(135deg, #0D9488 0%, #6366F1 100%)",
            boxShadow: "0 4px 20px rgba(13,148,136,0.3), 0 4px 20px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando solicitud…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Enviar solicitud
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-[#475569]">
          Al enviar aceptás que revisemos tu evento antes de publicarlo en ¿Dónde es Hoy?
        </p>
      </form>
    </div>
  );
}
