import "server-only";

import { Resend } from "resend";
import type { NewEventSubmission } from "@/lib/db/schema";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = "hola@dondeeshoy.com";
const FROM_EMAIL = "noreply@dondeeshoy.com";

/**
 * Sends an email notification to the admin when a new event submission arrives.
 */
export async function notifyNewSubmission(
  submission: NewEventSubmission & { id: string }
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Link to Supabase table editor for quick review
  const reviewLink = supabaseUrl
    ? `${supabaseUrl.replace(".supabase.co", ".supabase.co")}/project/default/editor`
    : "https://supabase.com";

  const isFreeLabel = submission.isFree ? "✅ Gratis" : `💰 ${submission.priceRange ?? "Pago"}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><title>Nueva solicitud de evento</title></head>
<body style="font-family: sans-serif; background: #0f0f13; color: #e2e8f0; padding: 24px; max-width: 600px; margin: 0 auto;">
  <div style="background: #1a1a2e; border: 1px solid #7c3aed33; border-radius: 12px; padding: 24px;">
    <h1 style="color: #a855f7; font-size: 20px; margin: 0 0 4px;">🎉 Nueva solicitud de evento</h1>
    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 24px;">ID: <code style="background:#ffffff10; padding: 2px 6px; border-radius: 4px;">${submission.id}</code></p>

    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 8px 0; color: #94a3b8; width: 140px;">Evento</td><td style="padding: 8px 0; font-weight: bold;">${submission.eventName}</td></tr>
      <tr><td style="padding: 8px 0; color: #94a3b8;">Fecha</td><td style="padding: 8px 0;">${submission.eventDate}${submission.eventTime ? ` a las ${submission.eventTime}` : ""}</td></tr>
      <tr><td style="padding: 8px 0; color: #94a3b8;">Tipo</td><td style="padding: 8px 0; text-transform: capitalize;">${submission.eventType}</td></tr>
      <tr><td style="padding: 8px 0; color: #94a3b8;">Venue</td><td style="padding: 8px 0;">${submission.venueName}</td></tr>
      <tr><td style="padding: 8px 0; color: #94a3b8;">Dirección</td><td style="padding: 8px 0;">${submission.venueAddress}</td></tr>
      <tr><td style="padding: 8px 0; color: #94a3b8;">Ciudad</td><td style="padding: 8px 0;">${submission.city}</td></tr>
      <tr><td style="padding: 8px 0; color: #94a3b8;">Entradas</td><td style="padding: 8px 0;">${isFreeLabel}</td></tr>
      ${submission.ticketUrl ? `<tr><td style="padding: 8px 0; color: #94a3b8;">Link tickets</td><td style="padding: 8px 0;"><a href="${submission.ticketUrl}" style="color: #a855f7;">${submission.ticketUrl}</a></td></tr>` : ""}
      <tr><td style="padding: 8px 0; color: #94a3b8; vertical-align: top;">Descripción</td><td style="padding: 8px 0;">${submission.description}</td></tr>
    </table>

    <hr style="border: none; border-top: 1px solid #ffffff10; margin: 20px 0;" />

    <h2 style="color: #e2e8f0; font-size: 15px; margin: 0 0 12px;">Contacto</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #94a3b8; width: 140px;">Nombre</td><td style="padding: 6px 0;">${submission.contactName}</td></tr>
      <tr><td style="padding: 6px 0; color: #94a3b8;">Email</td><td style="padding: 6px 0;"><a href="mailto:${submission.contactEmail}" style="color: #a855f7;">${submission.contactEmail}</a></td></tr>
    </table>

    <div style="margin-top: 24px; text-align: center;">
      <a href="${reviewLink}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #db2777); color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">
        Revisar en la base de datos →
      </a>
    </div>
  </div>
  <p style="text-align: center; color: #475569; font-size: 11px; margin-top: 16px;">¿Dónde es Hoy? · Sistema de publicación de eventos</p>
</body>
</html>
  `.trim();

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `[Nueva solicitud] ${submission.eventName} — ${submission.eventDate}`,
    html,
  });
}
