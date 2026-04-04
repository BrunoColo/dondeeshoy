"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  CheckCircle,
  ArrowLeft,
  Bell,
  MapPin,
  Compass,
  Calendar,
  Loader2,
  XCircle,
  PartyPopper,
  Heart,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno",
  "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo",
  "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto",
  "San José", "Soriano", "Tacuarembó", "Treinta y Tres",
];

const EVENT_TYPES = [
  { value: "fiesta", label: "🎉 Fiestas", color: "#F472B6" },
  { value: "festival", label: "🎪 Festivales", color: "#FBBF24" },
  { value: "concierto", label: "🎵 Conciertos", color: "#818CF8" },
  { value: "recital", label: "🎤 Recitales", color: "#A78BFA" },
  { value: "cultural", label: "🎭 Culturales", color: "#14B8A6" },
  { value: "deportivo", label: "⚽ Deportivos", color: "#34D399" },
  { value: "gastronomico", label: "🍷 Gastronómicos", color: "#FB923C" },
  { value: "familiar", label: "👨‍👩‍👧 Familiar", color: "#F9A8D4" },
  { value: "feria", label: "🛍️ Ferias", color: "#FCD34D" },
  { value: "taller", label: "🎨 Talleres", color: "#67E8F9" },
  { value: "club", label: "🪩 Club", color: "#93C5FD" },
  { value: "teatro", label: "🎬 Teatro", color: "#C084FC" },
  { value: "bar", label: "🍺 Bares", color: "#F87171" },
  { value: "otro", label: "✨ Otros", color: "#94A3B8" },
] as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const FEATURES = [
  { icon: Calendar, text: "Cada jueves: resumen del finde" },
  { icon: MapPin, text: "Filtrado por tu departamento" },
  { icon: Heart, text: "Según tus tipos de evento favoritos" },
  { icon: Bell, text: "Sin spam, cancelá cuando quieras" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function SubscribeForm() {
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");
  const unsubscribed = searchParams.get("unsubscribed");
  const source = searchParams.get("source");
  const fromNotifyLike = source === "notify-like";
  const prefillAppliedRef = useRef(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const frequency = "weekly" as const;
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show verification/unsubscribe messages
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (verified === "true") {
      setStatusMessage({
        type: "success",
        text: "¡Tu email fue verificado! Ya vas a empezar a recibir eventos. 🎉",
      });
    } else if (verified === "already") {
      setStatusMessage({
        type: "info",
        text: "Este email ya estaba verificado.",
      });
    } else if (unsubscribed === "true") {
      setStatusMessage({
        type: "success",
        text: "Te desuscribiste correctamente. ¡Ojalá vuelvas pronto!",
      });
    } else if (unsubscribed === "not-found") {
      setStatusMessage({
        type: "error",
        text: "No encontramos esa suscripción. Puede que ya haya sido cancelada.",
      });
    }
  }, [verified, unsubscribed]);

  useEffect(() => {
    if (prefillAppliedRef.current) return;

    const rawType = searchParams.get("type");
    const rawDepartment = searchParams.get("department");

    const typeValues = rawType
      ? rawType
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter((value) => EVENT_TYPES.some((eventType) => eventType.value === value))
      : [];

    const departmentByNormalized = new Map(
      DEPARTMENTS.map((department) => [normalizeText(department), department] as const),
    );

    const departmentValues = rawDepartment
      ? rawDepartment
          .split(",")
          .map((value) => value.trim())
          .map((value) => departmentByNormalized.get(normalizeText(value)))
          .filter((value): value is string => Boolean(value))
      : [];

    if (typeValues.length > 0) {
      setSelectedTypes((prev) => Array.from(new Set([...prev, ...typeValues])));
    }

    if (departmentValues.length > 0) {
      setSelectedDepartments((prev) => Array.from(new Set([...prev, ...departmentValues])));
    }

    prefillAppliedRef.current = true;
  }, [searchParams]);

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Ingresá tu email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email inválido");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          departments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
          eventTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
          frequency,
          website: honeypot,
        }),
      });

      if (res.status === 429) {
        setError("Demasiadas solicitudes. Intentá de nuevo más tarde.");
        return;
      }

      if (res.status === 409) {
        setError("Este email ya está suscripto.");
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Algo salió mal. Intentá de nuevo.");
        return;
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Error de conexión. Verificá tu internet e intentá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Status message banner ──
  if (statusMessage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center gap-6 text-center max-w-md fade-up">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background:
                statusMessage.type === "success"
                  ? "rgba(52,211,153,0.12)"
                  : statusMessage.type === "error"
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(99,102,241,0.12)",
              border: `1px solid ${
                statusMessage.type === "success"
                  ? "rgba(52,211,153,0.25)"
                  : statusMessage.type === "error"
                    ? "rgba(239,68,68,0.25)"
                    : "rgba(99,102,241,0.25)"
              }`,
            }}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            ) : statusMessage.type === "error" ? (
              <XCircle className="h-8 w-8 text-red-400" />
            ) : (
              <Bell className="h-8 w-8 text-indigo-400" />
            )}
          </div>

          <p className="text-[18px] font-semibold text-[#F8FAFC] leading-relaxed">
            {statusMessage.text}
          </p>

          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-[#94A3B8] hover:text-[#CBD5E1] transition-colors mt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ── Success state ──
  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center gap-6 text-center max-w-md fade-up">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(13,148,136,0.15), rgba(99,102,241,0.15))",
              border: "1px solid rgba(99,102,241,0.25)",
              boxShadow: "0 0 40px rgba(99,102,241,0.10)",
            }}
          >
            <PartyPopper className="h-10 w-10 text-[#818CF8]" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-[26px] font-bold text-[#F8FAFC]">
              ¡Casi listo!
            </h1>
            <p className="text-[14px] text-[#94A3B8] leading-relaxed">
              Te enviamos un email de verificación a{" "}
              <span className="text-[#14B8A6] font-semibold">{email}</span>.
              <br />
              Hacé click en el link para confirmar tu suscripción.
            </p>
          </div>

          <div
            className="w-full rounded-xl px-5 py-4 flex items-center gap-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Mail className="h-5 w-5 text-[#818CF8] shrink-0" />
            <div className="text-left">
              <p className="text-[13px] font-semibold text-[#E2E8F0]">
                Revisá tu bandeja de entrada
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                También la carpeta de spam, por las dudas
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-[#94A3B8] hover:text-[#CBD5E1] transition-colors mt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Hero header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5"
          style={{
            background: "linear-gradient(135deg, rgba(13,148,136,0.12), rgba(99,102,241,0.12))",
            border: "1px solid rgba(99,102,241,0.20)",
          }}
        >
          <Compass className="h-3.5 w-3.5 text-[#818CF8]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#818CF8]">
            Boletín gratuito
          </span>
        </div>

        <h1 className="text-[28px] sm:text-[36px] font-bold text-[#F8FAFC] leading-tight mb-3">
          Los mejores eventos,
          <br />
          <span
            className="text-shimmer"
            style={{
              backgroundImage: "linear-gradient(90deg, #0D9488, #818CF8, #0D9488)",
              backgroundSize: "200%",
            }}
          >
            directo a tu mail
          </span>
        </h1>
        <p className="text-[15px] text-[#94A3B8] leading-relaxed max-w-lg mx-auto">
          Elegí qué te interesa y cada jueves te llega una selección del finde.
          Ejemplo: conciertos en Montevideo + planes familiares en Canelones.
        </p>

        {fromNotifyLike && (
          <div
            className="mt-4 inline-flex items-center rounded-full border border-[#14B8A6]/35 bg-[#14B8A6]/10 px-4 py-2"
          >
            <span className="text-[12px] font-semibold text-[#99F6E4]">
              Preseleccionamos intereses según el evento que te gustó ✨
            </span>
          </div>
        )}
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-2 gap-2 mb-8 max-w-md mx-auto">
        {FEATURES.map((f) => (
          <div
            key={f.text}
            className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <f.icon className="h-4 w-4 text-[#14B8A6] shrink-0" strokeWidth={2} />
            <span className="text-[12px] text-[#CBD5E1] font-medium">{f.text}</span>
          </div>
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => s < step && setStep(s)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300",
              step === s
                ? "bg-[rgba(99,102,241,0.15)] text-[#818CF8] border border-[rgba(99,102,241,0.30)] shadow-[0_0_12px_rgba(99,102,241,0.10)]"
                : step > s
                  ? "bg-[rgba(52,211,153,0.10)] text-[#34D399] border border-[rgba(52,211,153,0.20)] cursor-pointer"
                  : "bg-transparent text-[#475569] border border-[rgba(255,255,255,0.06)]",
            )}
          >
            {step > s ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <span className="w-3 text-center">{s}</span>
            )}
            <span>{s === 1 ? "Email" : s === 2 ? "Intereses" : "Confirmar"}</span>
          </button>
        ))}
      </div>

      {/* Form card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(10,10,22,0.95) 0%, rgba(13,13,26,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.05)",
        }}
      >
        {/* ── Step 1: Email ── */}
        {step === 1 && (
          <div className="p-6 sm:p-8 fade-up">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(13,148,136,0.15)",
                  border: "1px solid rgba(13,148,136,0.30)",
                }}
              >
                <Mail className="h-4 w-4 text-[#14B8A6]" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-[#F8FAFC]">Tu email</h2>
                <p className="text-[11px] text-[#94A3B8]">
                  Donde te mandamos los eventos
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Email input */}
              <div>
                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="tu@email.com"
                  className={cn(
                    "w-full rounded-xl px-4 py-3.5 text-[14px] text-[#F8FAFC]",
                    "bg-[#111120] border transition-all duration-200",
                    "placeholder:text-[#E2E8F0]/85",
                    "focus:outline-none focus:bg-[#16162A]",
                    "focus:border-[rgba(99,102,241,0.50)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]",
                    error
                      ? "border-[rgba(239,68,68,0.45)] shadow-[0_0_0_3px_rgba(239,68,68,0.06)]"
                      : "border-[rgba(255,255,255,0.12)]",
                  )}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Name input (optional) */}
              <div>
                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                  Nombre <span className="text-[#475569] normal-case tracking-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="¿Cómo te llamás?"
                  className={cn(
                    "w-full rounded-xl px-4 py-3.5 text-[14px] text-[#F8FAFC]",
                    "bg-[#111120] border border-[rgba(255,255,255,0.12)] transition-all duration-200",
                    "placeholder:text-[#E2E8F0]/85",
                    "focus:outline-none focus:bg-[#16162A]",
                    "focus:border-[rgba(99,102,241,0.50)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]",
                  )}
                  autoComplete="given-name"
                />
              </div>

              {/* Honeypot — hidden from humans, traps bots */}
              <div className="absolute opacity-0 -z-10 pointer-events-none" aria-hidden="true" tabIndex={-1}>
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Weekly cadence info */}
              <div>
                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-2">
                  Frecuencia
                </label>
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(13,148,136,0.10)",
                    border: "1px solid rgba(13,148,136,0.28)",
                  }}
                >
                  <p className="text-[13px] font-semibold text-[#99F6E4]">
                    📅 Semanal (cada jueves)
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                    Te recomendamos lo mejor del viernes, sábado y domingo según tu departamento y los tipos de eventos que elijas.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-[12px] text-[#F87171] flex items-center gap-1.5 mt-4">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                if (!email.trim()) { setError("Ingresá tu email"); return; }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Email inválido"); return; }
                setError(null);
                setStep(2);
              }}
              className="w-full mt-6 flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-[14px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background: "linear-gradient(135deg, #0D9488 0%, #6366F1 100%)",
                boxShadow: "0 4px 20px rgba(13,148,136,0.25), 0 4px 20px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              Siguiente
            </button>
          </div>
        )}

        {/* ── Step 2: Interests ── */}
        {step === 2 && (
          <div className="p-6 sm:p-8 fade-up">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.30)",
                }}
              >
                <Heart className="h-4 w-4 text-[#818CF8]" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-[#F8FAFC]">Tus intereses</h2>
                <p className="text-[11px] text-[#94A3B8]">
                  Opcional — dejá vacío para recibir de todo
                </p>
              </div>
            </div>

            {/* Event types */}
            <div className="mb-6">
              <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-2.5">
                Tipos de evento
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleType(t.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-all duration-200 border",
                      selectedTypes.includes(t.value)
                        ? "text-[#F8FAFC] border-opacity-40"
                        : "text-[#64748B] border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] hover:text-[#94A3B8]",
                    )}
                    style={
                      selectedTypes.includes(t.value)
                        ? {
                            background: `${t.color}15`,
                            borderColor: `${t.color}40`,
                            color: t.color,
                          }
                        : undefined
                    }
                  >
                    <span className="text-[14px]">{t.label.split(" ")[0]}</span>
                    <span>{t.label.split(" ").slice(1).join(" ")}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Departments */}
            <div className="mb-6">
              <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-2.5">
                Departamentos
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDepartment(dept)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-all duration-200 border",
                      selectedDepartments.includes(dept)
                        ? "bg-[rgba(13,148,136,0.12)] border-[rgba(13,148,136,0.35)] text-[#14B8A6]"
                        : "bg-transparent border-[rgba(255,255,255,0.08)] text-[#64748B] hover:border-[rgba(255,255,255,0.15)] hover:text-[#94A3B8]",
                    )}
                  >
                    <MapPin className="h-3 w-3 shrink-0" />
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary pills */}
            {(selectedTypes.length > 0 || selectedDepartments.length > 0) && (
              <div
                className="rounded-xl px-4 py-3 mb-4"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-[11px] text-[#94A3B8]">
                  Vas a recibir{" "}
                  {selectedTypes.length > 0 && (
                    <span className="text-[#14B8A6] font-semibold">
                      {selectedTypes.length} tipo{selectedTypes.length > 1 ? "s" : ""} de evento
                    </span>
                  )}
                  {selectedTypes.length > 0 && selectedDepartments.length > 0 && " en "}
                  {selectedDepartments.length > 0 && (
                    <span className="text-[#818CF8] font-semibold">
                      {selectedDepartments.length} departamento{selectedDepartments.length > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center justify-center gap-1.5 rounded-xl py-3 px-4 text-[13px] font-semibold text-[#94A3B8] border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.20)] hover:text-[#CBD5E1] transition-all duration-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Atrás
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-[14px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #0D9488 0%, #6366F1 100%)",
                  boxShadow: "0 4px 20px rgba(13,148,136,0.25), 0 4px 20px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 3 && (
          <div className="p-6 sm:p-8 fade-up">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(52,211,153,0.15)",
                  border: "1px solid rgba(52,211,153,0.30)",
                }}
              >
                <CheckCircle className="h-4 w-4 text-[#34D399]" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-[#F8FAFC]">Confirmar suscripción</h2>
                <p className="text-[11px] text-[#94A3B8]">
                  Revisá tus preferencias
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-3 mb-6">
              <SummaryRow label="Email" value={email} />
              {name && <SummaryRow label="Nombre" value={name} />}
              <SummaryRow
                label="Frecuencia"
                value="📅 Semanal (cada jueves)"
              />
              <SummaryRow
                label="Tipos"
                value={
                  selectedTypes.length === 0
                    ? "Todos los tipos"
                    : selectedTypes
                        .map((t) => EVENT_TYPES.find((et) => et.value === t)?.label ?? t)
                        .join(", ")
                }
              />
              <SummaryRow
                label="Departamentos"
                value={
                  selectedDepartments.length === 0
                    ? "Todo Uruguay"
                    : selectedDepartments.join(", ")
                }
              />
            </div>

            {error && (
              <p className="text-[12px] text-[#F87171] flex items-center gap-1.5 mb-4">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center justify-center gap-1.5 rounded-xl py-3 px-4 text-[13px] font-semibold text-[#94A3B8] border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.20)] hover:text-[#CBD5E1] transition-all duration-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Atrás
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-[14px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #0D9488 0%, #6366F1 100%)",
                  boxShadow: "0 4px 20px rgba(13,148,136,0.25), 0 4px 20px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Suscribirme
                  </>
                )}
              </button>
            </div>

            <p className="text-[10px] text-[#475569] text-center mt-4 leading-relaxed">
              Te enviamos un email para confirmar tu suscripción.
              Podés cancelar en cualquier momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Row ──────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider shrink-0 w-24 pt-0.5">
        {label}
      </span>
      <span className="text-[13px] text-[#CBD5E1] font-medium leading-relaxed">
        {value}
      </span>
    </div>
  );
}
