import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, Instagram, Mail, Megaphone, Rocket, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Comunidad",
  description: "Conectate con ¿Dónde es Hoy?: suscribite, publicá tu evento y contactanos.",
  alternates: {
    canonical: "/comunidad",
  },
};

export const revalidate = 300;

export default function ComunidadPage() {
  return (
    <div className="pt-4 pb-6 sm:pb-8">
      <section
        className="relative overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5"
        style={{
          background:
            "radial-gradient(100% 70% at 0% 0%, rgba(20,184,166,0.13) 0%, rgba(20,184,166,0.00) 55%), radial-gradient(90% 80% at 100% 0%, rgba(129,140,248,0.14) 0%, rgba(129,140,248,0.00) 60%), linear-gradient(140deg, rgba(10,10,22,0.94) 0%, rgba(12,10,24,0.96) 55%, rgba(9,15,24,0.94) 100%)",
          boxShadow: "0 12px 34px rgba(0,0,0,0.26)",
        }}
      >
        <div className="relative z-10 flex flex-col gap-5">
          <header className="fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/30 bg-[#14B8A6]/10 px-3 py-1">
              <Users className="h-3.5 w-3.5 text-[#6EE7B7]" strokeWidth={2.2} />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FE7C8]">
                Comunidad
              </span>
            </div>

            <h1 className="mt-3 font-display text-[24px] font-extrabold leading-tight text-white sm:text-[28px]">
              Tu punto de partida para
              <span className="bg-[linear-gradient(90deg,#6EE7B7_0%,#14B8A6_35%,#818CF8_100%)] bg-clip-text text-transparent">
                {" "}difundir y descubrir
              </span>
            </h1>

            <p className="mt-2 max-w-[62ch] text-[13px] text-[#CBD5E1] sm:text-sm">
              Acá podés activar novedades por mail, publicar tu evento y hablar con nosotros.
              Todo conectado, sin vueltas.
            </p>

            <div className="mt-3 inline-flex items-center rounded-full border border-[#818CF8]/35 bg-[#818CF8]/12 px-4 py-2">
              <span className="text-[12px] font-semibold text-[#E2E8F0]">
                +500 personas visitaron este sitio esta semana
              </span>
            </div>
          </header>

          <div className="fade-up rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#818CF8]" strokeWidth={2.3} />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A7B4FF]">
                Elegí tu próximo paso
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5">
              <Link
                href="/suscribirse"
                className="group flex items-center gap-3 rounded-xl border border-[#818CF8]/35 bg-[linear-gradient(120deg,rgba(79,70,229,0.28)_0%,rgba(99,102,241,0.16)_50%,rgba(13,148,136,0.18)_100%)] px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-[1px] hover:brightness-110"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/20">
                  <Mail className="h-4.5 w-4.5 text-[#C7D2FE]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-white">Suscribirme gratis</span>
                  <span className="block text-[11px] text-[#CBD5E1]">Recibí eventos seleccionados por email</span>
                </span>
                <ArrowRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
              </Link>

              <Link
                href="/publicar"
                className="group flex items-center gap-3 rounded-xl border border-[#14B8A6]/35 bg-[linear-gradient(120deg,rgba(13,148,136,0.24)_0%,rgba(20,184,166,0.14)_50%,rgba(99,102,241,0.18)_100%)] px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-[1px] hover:brightness-110"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/20">
                  <Rocket className="h-4.5 w-4.5 text-[#99F6E4]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-white">Publicar mi evento</span>
                  <span className="block text-[11px] text-[#CBD5E1]">Aparecé en búsquedas y en el mapa</span>
                </span>
                <ArrowRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
              </Link>
            </div>
          </div>

        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-[linear-gradient(140deg,rgba(10,10,22,0.92)_0%,rgba(12,10,24,0.94)_55%,rgba(9,15,24,0.92)_100%)] p-4 sm:p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#818CF8]/28 bg-[#818CF8]/10 px-3 py-1">
          <Compass className="h-3.5 w-3.5 text-[#A7B4FF]" strokeWidth={2.2} />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C7D2FE]">¿Por qué sumarte?</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[
            "Tu evento puede aparecer en búsquedas, mapa y listados destacados.",
            "Boletín semanal con recomendaciones según gustos y departamento.",
            "Proceso claro: revisamos propuestas y respondemos en menos de 48 horas.",
            "Canales directos para colaboraciones, difusión y campañas.",
          ].map((item) => (
            <div
              key={item}
              className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#34D399]" strokeWidth={2.3} />
              <p className="text-[12px] text-[#CBD5E1] leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="mt-5 rounded-2xl border border-white/10 bg-[linear-gradient(140deg,rgba(10,10,22,0.92)_0%,rgba(12,10,24,0.94)_55%,rgba(9,15,24,0.92)_100%)] p-4 sm:p-5"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/28 bg-[#14B8A6]/10 px-3 py-1">
          <Megaphone className="h-3.5 w-3.5 text-[#6EE7B7]" strokeWidth={2.2} />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FE7C8]">Contacto</span>
        </div>

        <h2 className="mt-3 text-[14px] font-semibold text-white sm:text-[15px]">
          Contacto directo de ¿Dónde es Hoy?
        </h2>
        <p className="mt-1 text-[12px] text-[#CBD5E1]">
          Para colaboraciones, consultas o publicidad escribinos por los canales oficiales.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a
            href="mailto:dondeeshoyuy@gmail.com"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-[#C7D2FE] transition-colors hover:text-white"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={2.2} />
            dondeeshoyuy@gmail.com
          </a>
          <a
            href="https://instagram.com/dondeeshoy.uy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-[#C7D2FE] transition-colors hover:text-white"
          >
            <Instagram className="h-3.5 w-3.5" strokeWidth={2.2} />
            @dondeeshoy.uy
            <ArrowRight className="ml-auto h-3.5 w-3.5" strokeWidth={2.2} />
          </a>
        </div>
      </section>
    </div>
  );
}
