/**
 * fix-canelones-mvd-and-reject-nonevents.mjs
 *
 * Two fixes in one script:
 *
 * 1. DEPARTMENT FIX: Events wrongly classified as "Canelones" that are actually
 *    in Montevideo (based on coordinates). The old bounding boxes had an overlap
 *    where Canelones extended south past Montevideo's northern boundary.
 *    Fix: re-run coordinate-based detection with the corrected bounding boxes.
 *
 * 2. NON-EVENT REJECTION: Events that should have been rejected by the pipeline
 *    but weren't (e.g. "Almuerzo Buffet para 2 personas", "Celebración de 15 años",
 *    "BAND x VENUE - Edición Especial"). These are service listings / private
 *    packages / promotional posts, not public events.
 *    Fix: mark them as status='past' (effectively hiding them from the site).
 */

// Load .env if available (optional - can also pass DATABASE_URL directly)
try {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
} catch {
  // dotenv not installed - rely on environment variable being set
}
import pg from 'pg';
const { Pool } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Corrected Montevideo bounding box ────────────────────────────────────────
// These match the updated values in department-detector.ts
const MONTEVIDEO_BOUNDS = {
  minLat: -34.950,
  maxLat: -34.700,
  minLng: -56.415,
  maxLng: -56.000,
};

function isInMontevideo(lat, lng) {
  return (
    lat >= MONTEVIDEO_BOUNDS.minLat &&
    lat <= MONTEVIDEO_BOUNDS.maxLat &&
    lng >= MONTEVIDEO_BOUNDS.minLng &&
    lng <= MONTEVIDEO_BOUNDS.maxLng
  );
}

// ─── Non-event reject patterns (mirrors classifier.ts REJECT_PATTERNS additions) ─
const REJECT_PATTERNS = [
  // Restaurant / food service packages (not public events)
  /\b(almuerzo|cena|desayuno)\s+(buffet|romántic[oa]|para\s+\d+\s+personas?)\b/i,
  /\bbuffet\s+para\s+\d+\s+personas?\b/i,
  /\bmen[uú]\s+para\s+\d+\s+personas?\b/i,
  // Private celebration packages sold as tickets (not public events)
  /\bcelebraci[oó]n\s+de\s+(15|quince)\s+a[nñ]os?\b/i,
  /\bquincea[nñ]era\b/i,
  // "Band x Venue - Edición Especial" promotional format
  /\bx\s+(?:the\s+)?(?:la\s+planta|music\s+box|antel\s+arena|sala\s+zitarrosa)\b.*\b(edici[oó]n\s+especial|collab|colaboraci[oó]n)\b/i,
  // Gift vouchers / experience packages (not events)
  /\bvoucher\s+de\s+(experiencia|regalo|cena|almuerzo)\b/i,
  /\btarjeta\s+de\s+regalo\b/i,
  /\bexperiencia\s+para\s+\d+\s+personas?\b/i,
  /\bregalo\s+para\s+(dos|2|pareja|ella|[eé]l)\b/i,
];

function shouldReject(name, description) {
  const text = `${name} ${description ?? ''}`;
  return REJECT_PATTERNS.some(p => p.test(text));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    // ── Part 1: Fix Canelones → Montevideo based on coordinates ──────────────
    console.log('\n=== Part 1: Fix Canelones → Montevideo (coordinate-based) ===\n');

    const { rows: canelones } = await client.query(`
      SELECT id, name, venue_name, venue_address, city,
             CAST(latitude AS FLOAT) as lat,
             CAST(longitude AS FLOAT) as lng
      FROM events
      WHERE status = 'active'
        AND city = 'Canelones'
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      ORDER BY name
    `);

    console.log(`Found ${canelones.length} active events currently classified as Canelones with coordinates.`);

    const deptFixes = [];
    for (const ev of canelones) {
      if (isInMontevideo(ev.lat, ev.lng)) {
        deptFixes.push(ev);
      }
    }

    console.log(`\n${deptFixes.length} events are actually in Montevideo (coordinates fall within Montevideo bounds):`);
    for (const ev of deptFixes) {
      console.log(`  [Canelones → Montevideo] "${ev.name}" @ ${ev.venue_name} (${ev.lat}, ${ev.lng})`);
    }

    if (deptFixes.length > 0) {
      console.log('\nApplying department fixes...');
      for (const ev of deptFixes) {
        await client.query(
          `UPDATE events SET city = 'Montevideo', updated_at = NOW() WHERE id = $1`,
          [ev.id],
        );
      }
      console.log(`✅ Fixed ${deptFixes.length} events: Canelones → Montevideo`);
    } else {
      console.log('No department fixes needed.');
    }

    // ── Part 2: Reject non-event listings ────────────────────────────────────
    console.log('\n=== Part 2: Reject non-event listings ===\n');

    const { rows: activeEvents } = await client.query(`
      SELECT id, name, description
      FROM events
      WHERE status = 'active'
      ORDER BY name
    `);

    console.log(`Checking ${activeEvents.length} active events against reject patterns...`);

    const toReject = [];
    for (const ev of activeEvents) {
      if (shouldReject(ev.name, ev.description)) {
        toReject.push(ev);
      }
    }

    console.log(`\n${toReject.length} events match non-event reject patterns:`);
    for (const ev of toReject) {
      console.log(`  [REJECT] "${ev.name}"`);
    }

    if (toReject.length > 0) {
      console.log('\nMarking as past (hidden from site)...');
      for (const ev of toReject) {
        await client.query(
          `UPDATE events SET status = 'past', updated_at = NOW() WHERE id = $1`,
          [ev.id],
        );
      }
      console.log(`✅ Rejected ${toReject.length} non-event listings`);
    } else {
      console.log('No non-event listings found to reject.');
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n=== Summary ===');
    console.log(`Department fixes: ${deptFixes.length}`);
    console.log(`Non-event rejections: ${toReject.length}`);

    // Show updated city distribution
    const { rows: dist } = await client.query(`
      SELECT city, count(*) as cnt
      FROM events
      WHERE status = 'active'
      GROUP BY city
      ORDER BY cnt DESC
    `);
    console.log('\nUpdated city distribution (active events):');
    dist.forEach(r => console.log(`  "${r.city}": ${r.cnt}`));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
