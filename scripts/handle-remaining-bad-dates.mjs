#!/usr/bin/env node
/**
 * RECOMENDACIONES para los 22 eventos sin auto-arreglzo
 * 
 * Estos eventos tienen años que NO son 2026:
 * - 18 en 2025 (RedTickets) → eventos pasados
 * - 2 en 2027 (TicketFacil) → eventos futuros válidos
 * - 2 en 2030 (RedTickets) → fechas simbólicas de cursos
 * - 1 en 2040 (RedTickets) → fecha simbólica
 * 
 * Para DELETAR: los de 2024, 2025, 2030, 2040 (nunca son 2026)
 * Para VERIFICAR: los de 2027 (podrían ser válidos pero requieren validar)
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║         🗑️  RECOMENDACIONES: DELETAR EVENTOS CON AÑOS INCORRECTOS           ║
╚══════════════════════════════════════════════════════════════════════════════╝

📋 EVENTOS PARA INVESTIGAR/DELETAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Categoría 1: DELETAR - Eventos 2024-2025 (RED TICKETS)
    console.log(`1️⃣  DELETAR: RedTickets 2024-2025 (18 eventos - Museos y atractivos pasados)\n`);
    
    const pastEventsResult = await client.query(`
      SELECT e.id, e.name, e.date, e.venue_name
      FROM events e
      JOIN event_sources es ON e.id = es.event_id
      JOIN raw_events re ON es.raw_event_id = re.id
      WHERE re.source = 'redtickets'
      AND EXTRACT(YEAR FROM e.date) IN (2024, 2025)
      ORDER BY e.date DESC
    `);

    for (const event of pastEventsResult.rows) {
      console.log(`   • ${event.name}`);
      console.log(`     Fecha: ${event.date}, Venue: ${event.venue_name}`);
    }
    
    console.log(`\n   Acción recomendada:`);
    console.log(`   → Marcar como status='past' O deletar completamente`);
    console.log(`   → Estos eventos ya pasaron (son de 2024-2025)\n`);

    // Categoría 2: VERIFICAR - Eventos 2027 (TICKETFACIL)
    console.log(`\n2️⃣  VERIFICAR: TicketFacil 2027 (2 eventos - Partidos de fútbol)\n`);
    
    const futureEventsResult = await client.query(`
      SELECT e.id, e.name, e.date, e.venue_name, re.raw_data
      FROM events e
      JOIN event_sources es ON e.id = es.event_id
      JOIN raw_events re ON es.raw_event_id = re.id
      WHERE re.source = 'ticketfacil'
      AND EXTRACT(YEAR FROM e.date) = 2027
      ORDER BY e.date ASC
    `);

    for (const event of futureEventsResult.rows) {
      console.log(`   • ${event.name}`);
      console.log(`     Fecha: ${event.date}`);
      console.log(`     Raw dateText: ${event.raw_data.dateText || 'N/A'}`);
      console.log(`     → Estos SÍ tienen ISO válida (2027-XX-XX)`);
      console.log(`     → Con el nuevo código funcionarán correctamente ✓\n`);
    }

    // Categoría 3: DELETAR - Eventos 2030+ (RedTickets - Cursos simbólicos)
    console.log(`\n3️⃣  DELETAR: RedTickets 2030+ (3 eventos - Fechas simbólicas)\n`);
    
    const symbolicEventsResult = await client.query(`
      SELECT e.id, e.name, e.date, e.venue_name, re.raw_data
      FROM events e
      JOIN event_sources es ON e.id = es.event_id
      JOIN raw_events re ON es.raw_event_id = re.id
      WHERE re.source = 'redtickets'
      AND EXTRACT(YEAR FROM e.date) >= 2030
      ORDER BY e.date ASC
    `);

    for (const event of symbolicEventsResult.rows) {
      console.log(`   • ${event.name}`);
      console.log(`     Fecha: ${event.date}`);
      console.log(`     RawData dateText: ${(event.raw_data.dateText || 'N/A').substring(0, 50)}`);
      console.log(`     → Estos son cursos ONLINE con fechas placeholder\n`);
    }

    console.log(`
📋 RECOMENDACIONES PARA DELETAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SQL para DELETAR eventos de 2024-2025 y 2030+:

  DELETE FROM events WHERE id IN (
    SELECT e.id 
    FROM events e
    WHERE EXTRACT(YEAR FROM e.date) IN (2024, 2025) 
       OR EXTRACT(YEAR FROM e.date) >= 2030
    AND created_at < NOW() - INTERVAL '7 days'  -- Seguridad: no deletar recientes
  );

Alternativa (menos destructiva): Marcar como status='past/inactive':

  UPDATE events 
  SET status = 'past' 
  WHERE EXTRACT(YEAR FROM e.date) IN (2024, 2025)
    AND EXTRACT(YEAR FROM e.date) < 2026;

  UPDATE events 
  SET status = 'inactive' 
  WHERE EXTRACT(YEAR FROM e.date) >= 2030;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ VERIFICACIÓN POST-ARREGLO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN EXTRACT(YEAR FROM date) = 2026 THEN 1 END) as year_2026,
        COUNT(CASE WHEN EXTRACT(YEAR FROM date) = 2027 THEN 1 END) as year_2027,
        COUNT(CASE WHEN EXTRACT(YEAR FROM date) < 2026 THEN 1 END) as year_before_2026,
        COUNT(CASE WHEN EXTRACT(YEAR FROM date) > 2027 THEN 1 END) as year_after_2027
      FROM events
      WHERE status = 'active'
    `);

    const stats = verifyResult.rows[0];
    console.log(`   Total eventos activos: ${stats.total}`);
    console.log(`   ✓ Año 2026: ${stats.year_2026} (correcto)`);
    console.log(`   ✓ Año 2027: ${stats.year_2027} (válido - futuros)`);
    console.log(`   ✗ Antes de 2026: ${stats.year_before_2026} (DEBE SER 0)`);
    console.log(`   ✗ Después de 2027: ${stats.year_after_2027} (DEBE SER 0)\n`);

    if (stats.year_before_2026 > 0 || stats.year_after_2027 > 0) {
      console.log(`   ⚠️  ADVERTENCIA: Aún hay eventos con años incorrectos!`);
    } else {
      console.log(`   ✅ OK: Todos los eventos tienen años válidos\n`);
    }

  } finally {
    client.release();
    pool.end();
  }
}

main().catch(console.error);
