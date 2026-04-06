import "server-only";

import { Resend } from "resend";
import { escapeHtml } from "@/lib/utils";
import { siteConfig } from "@/config/site";

const FROM_EMAIL = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url;

/** Lazy singleton */
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        "RESEND_API_KEY is not configured — email notifications are disabled.",
      );
    }
    _resend = new Resend(key);
  }
  return _resend;
}

/* ─── Shared styles ─── */

const emailStyles = {
  body: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #06060C; color: #E2E8F0; padding: 0; margin: 0;',
  container: "max-width: 600px; margin: 0 auto; padding: 24px;",
  card: "background: linear-gradient(135deg, #0D0D18 0%, #111120 100%); border: 1px solid rgba(255,255,255,0.10); border-radius: 16px; padding: 32px; margin-bottom: 16px;",
  heading: "color: #F8FAFC; font-size: 24px; font-weight: 700; margin: 0 0 8px 0; line-height: 1.3;",
  subheading: "color: #94A3B8; font-size: 14px; margin: 0 0 24px 0; line-height: 1.5;",
  button: "display: inline-block; background: linear-gradient(135deg, #0D9488, #6366F1); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px;",
  buttonSecondary: "display: inline-block; background: rgba(255,255,255,0.08); color: #CBD5E1; text-decoration: none; padding: 10px 24px; border-radius: 10px; font-weight: 600; font-size: 13px; border: 1px solid rgba(255,255,255,0.12);",
  footer: "text-align: center; padding: 16px 0; color: #475569; font-size: 11px; line-height: 1.6;",
  divider: "border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0;",
  badge: (color: string) =>
    `display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: ${color}20; color: ${color}; border: 1px solid ${color}30;`,
} as const;

function renderPreheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">${escapeHtml(text)}</div>`;
}

function renderPrimaryButton(url: string, label: string): string {
  return `
    <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
      <tr>
        <td style="border-radius: 12px; background: linear-gradient(135deg, #0D9488, #6366F1);">
          <a href="${url}" style="display: inline-block; color: #FFFFFF; text-decoration: none; padding: 14px 32px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; border-radius: 12px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  fiesta: "#F472B6",
  festival: "#FBBF24",
  concierto: "#818CF8",
  recital: "#A78BFA",
  cultural: "#14B8A6",
  deportivo: "#34D399",
  gastronomico: "#FB923C",
  familiar: "#F9A8D4",
  feria: "#FCD34D",
  taller: "#67E8F9",
  club: "#E879F9",
  bar: "#F87171",
  teatro: "#C084FC",
  otro: "#94A3B8",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  fiesta: "Fiesta",
  festival: "Festival",
  concierto: "Concierto",
  recital: "Recital",
  cultural: "Cultural",
  deportivo: "Deportivo",
  gastronomico: "Gastronómico",
  familiar: "Familiar",
  feria: "Feria",
  taller: "Taller",
  club: "Club",
  bar: "Bar",
  teatro: "Teatro",
  otro: "Otro",
};

/* ─── Verification Email ─── */

export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
): Promise<void> {
  const verifyUrl = `${BASE_URL}/api/subscriptions/verify?token=${verificationToken}`;
  const preheader = "Confirmá tu email y empezá a recibir los mejores eventos del finde.";

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Verificá tu suscripción</title></head>
<body style="${emailStyles.body}">
  ${renderPreheader(preheader)}
  <div style="${emailStyles.container}">
    <div style="${emailStyles.card}">
      <!-- Logo -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px;">📬</span>
      </div>

      <h1 style="${emailStyles.heading} text-align: center;">
        Confirmá tu suscripción
      </h1>
      <p style="${emailStyles.subheading} text-align: center;">
        ¡Falta un paso! Confirmá tu email para empezar a recibir los mejores eventos de Uruguay en tu bandeja de entrada.
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        ${renderPrimaryButton(verifyUrl, "✓ Confirmar suscripción")}
      </div>

      <hr style="${emailStyles.divider}" />

      <div style="text-align: center;">
        <p style="color: #64748B; font-size: 12px; margin: 0 0 8px 0;">
          ¿No funciona el botón? Copiá y pegá este link en tu navegador:
        </p>
        <p style="color: #818CF8; font-size: 11px; word-break: break-all; margin: 0;">
          ${verifyUrl}
        </p>
      </div>
    </div>

    <p style="${emailStyles.footer}">
      ${siteConfig.name} · ${siteConfig.description}<br/>
      Si no te suscribiste, podés ignorar este email.
    </p>
  </div>
</body>
</html>`.trim();

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Confirmá tu suscripción — ${siteConfig.name}`,
    html,
  });
}

export async function sendSubscriptionConfirmedEmail(
  email: string,
  subscriberName: string | null,
  frequency: "weekly" | "daily",
  unsubscribeToken: string,
): Promise<void> {
  const unsubscribeUrl = `${BASE_URL}/api/subscriptions/unsubscribe?token=${unsubscribeToken}`;
  const greeting = subscriberName ? `¡Hola ${subscriberName}!` : "¡Hola!";
  const cadenceText =
    frequency === "weekly"
      ? "Cada jueves te vamos a enviar una selección del finde (viernes a domingo), filtrada por tus intereses y departamentos elegidos."
      : "Te vamos a escribir con recomendaciones frescas según tus preferencias.";
  const preheader =
    frequency === "weekly"
      ? "Suscripción confirmada: cada jueves vas a recibir una curaduría del finde."
      : "Suscripción confirmada: te vamos a enviar recomendaciones frescas según tus preferencias.";

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Suscripción confirmada</title></head>
<body style="${emailStyles.body}">
  ${renderPreheader(preheader)}
  <div style="${emailStyles.container}">
    <div style="${emailStyles.card}">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px;">✅</span>
      </div>

      <h1 style="${emailStyles.heading} text-align: center;">
        Suscripción confirmada
      </h1>
      <p style="${emailStyles.subheading} text-align: center; margin-bottom: 12px;">
        ${greeting}
      </p>
      <p style="${emailStyles.subheading} text-align: center; margin-top: 0;">
        ${cadenceText}
      </p>

      <div style="text-align: center; margin: 28px 0 10px;">
        ${renderPrimaryButton(BASE_URL, "Ver eventos ahora →")}
      </div>
    </div>

    <div style="${emailStyles.footer}">
      ${siteConfig.name} · ${siteConfig.description}<br/>
      <a href="${unsubscribeUrl}" style="color: #64748B; text-decoration: underline;">Cancelar suscripción</a>
    </div>
  </div>
</body>
</html>`.trim();

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `✅ Suscripción confirmada — ${siteConfig.name}`,
    html,
  });
}

/* ─── Boletín digest email ─── */

export type DigestEvent = {
  name: string;
  slug: string;
  date: string;
  startTime: string | null;
  venueName: string;
  city: string;
  eventType: string;
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
};

const DAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles",
  "Jueves", "Viernes", "Sábado",
] as const;

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

function formatDateEs(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = DAYS_ES[d.getDay()];
  const dayNum = d.getDate();
  const monthName = MONTHS_ES[d.getMonth()];
  return `${dayName} ${dayNum} de ${monthName}`;
}

function formatTimeShort(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${h}:${m}`;
}

function formatPrice(event: DigestEvent): string {
  if (event.isFree) return "Gratis";
  if (event.priceMin && event.priceMax && event.priceMin !== event.priceMax) {
    return `$${event.priceMin}–$${event.priceMax} ${event.currency}`;
  }
  if (event.priceMin) return `$${event.priceMin} ${event.currency}`;
  if (event.priceMax) return `$${event.priceMax} ${event.currency}`;
  return "Pago";
}

export async function sendDigestEmail(
  email: string,
  unsubscribeToken: string,
  subscriberName: string | null,
  eventsByDay: Map<string, DigestEvent[]>,
  isWeekly: boolean,
): Promise<void> {
  const unsubscribeUrl = `${BASE_URL}/api/subscriptions/unsubscribe?token=${unsubscribeToken}`;

  const greeting = subscriberName ? `¡Hola ${subscriberName}!` : "¡Hola!";
  const subject = isWeekly
    ? `🎉 Tu fin de semana — lo mejor que viene`
    : `☀️ Buenos días — eventos de mañana`;
  const preheader = isWeekly
    ? "Tu selección del finde ya está lista: abrí para ver los eventos recomendados."
    : "Tu resumen está listo: abrí para ver los eventos de mañana.";

  // Build day sections
  let daysSections = "";
  for (const [dateStr, dayEvents] of eventsByDay) {
    const dateLabel = formatDateEs(dateStr);

    daysSections += `
      <!-- Day header -->
      <div style="margin-top: 24px; margin-bottom: 12px;">
        <div style="display: inline-block; background: linear-gradient(135deg, rgba(13,148,136,0.15), rgba(99,102,241,0.15)); border: 1px solid rgba(99,102,241,0.20); border-radius: 10px; padding: 6px 14px;">
          <span style="font-size: 13px; font-weight: 700; color: #818CF8; letter-spacing: 0.3px;">
            📅 ${dateLabel}
          </span>
        </div>
      </div>
    `;

    for (const event of dayEvents) {
      const time = formatTimeShort(event.startTime);
      const price = formatPrice(event);
      const typeColor = EVENT_TYPE_COLORS[event.eventType] ?? "#94A3B8";
      const typeLabel = EVENT_TYPE_LABELS[event.eventType] ?? "Evento";
      const eventUrl = `${BASE_URL}/evento/${event.slug}`;

      daysSections += `
      <!-- Event card -->
      <a href="${eventUrl}" style="display: block; text-decoration: none; margin-bottom: 8px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
          <tr>
            <td style="padding: 14px 16px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: top;">
                    <div style="font-size: 14px; font-weight: 600; color: #F8FAFC; margin-bottom: 6px; line-height: 1.4;">
                      ${escapeHtml(event.name)}
                    </div>
                    <div style="margin-bottom: 6px;">
                      <span style="${emailStyles.badge(typeColor)}">${typeLabel}</span>
                      ${time ? `<span style="font-size: 12px; color: #94A3B8; font-family: monospace; margin-left: 8px;">🕐 ${time}</span>` : ""}
                    </div>
                    <div style="font-size: 12px; color: #94A3B8;">📍 ${escapeHtml(event.venueName)}</div>
                    <div style="margin-top: 6px; font-size: 12px; color: ${event.isFree ? "#34D399" : "#CBD5E1"}; font-weight: 600;">
                      ${price}
                    </div>
                  </td>
                  <td style="vertical-align: top; width: 20px; text-align: right; color: #475569; font-size: 18px; padding-top: 4px;">→</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </a>
      `;
    }
  }

  // Count total events
  let totalEvents = 0;
  for (const evts of eventsByDay.values()) totalEvents += evts.length;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${subject}</title></head>
<body style="${emailStyles.body}">
  ${renderPreheader(preheader)}
  <div style="${emailStyles.container}">
    <!-- Main card -->
    <div style="${emailStyles.card}">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 32px;">${isWeekly ? "🎉" : "☀️"}</span>
      </div>

      <h1 style="${emailStyles.heading} text-align: center;">
        ${greeting}
      </h1>
      <p style="${emailStyles.subheading} text-align: center;">
        ${isWeekly
          ? `Preparamos una selección de <strong style="color: #14B8A6;">${totalEvents} eventos</strong> para este fin de semana.`
          : `Preparamos una selección de <strong style="color: #14B8A6;">${totalEvents} eventos</strong> para mañana.`
        }
      </p>

      <hr style="${emailStyles.divider}" />

      <!-- Events by day -->
      ${daysSections}

      <hr style="${emailStyles.divider}" />

      <!-- CTA -->
      <div style="text-align: center; margin: 24px 0 8px;">
        ${renderPrimaryButton(BASE_URL, "Ver todos los eventos →")}
      </div>
    </div>

    <!-- Footer -->
    <div style="${emailStyles.footer}">
      <p style="margin: 0 0 8px 0;">
        ${siteConfig.name} · ${siteConfig.description}
      </p>
      <a href="${unsubscribeUrl}" style="color: #64748B; text-decoration: underline; font-size: 11px;">
        Cancelar suscripción
      </a>
    </div>
  </div>
</body>
</html>`.trim();

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${subject} — ${siteConfig.name}`,
    html,
  });
}
