/**
 * Fix wrong coordinates for Magma Futura events.
 * Mapbox geocoded "Magma Futura" to Rocha (~-34.047, -53.543) instead of Montevideo.
 * Correct location: Zelmar Michelini 1252, Montevideo (-34.9058, -56.1882)
 *
 * Usage: node scripts/fix-magma-coords.mjs
 */
import 'dotenv/config';
import postgres from 'postgres';

let url = process.env.DATABASE_URL;
const p = new URL(url);
if (p.hostname.includes('pooler.supabase.com') && p.port === '5432') {
  p.port = '6543';
  url = p.toString();
}
const sql = postgres(url, { prepare: false, max: 1 });

const MAGMA_LAT = -34.9058;
const MAGMA_LNG = -56.1882;

// Fix all events at Magma Futura that have wrong coordinates
const result = await sql`
  UPDATE events
  SET
    latitude  = ${MAGMA_LAT.toString()},
    longitude = ${MAGMA_LNG.toString()},
    updated_at = NOW()
  WHERE lower(venue_name) LIKE '%magma futura%'
    AND (
      latitude  IS NULL
      OR longitude IS NULL
      OR (latitude::float BETWEEN -34.1 AND -33.9 AND longitude::float BETWEEN -53.7 AND -53.4)
    )
  RETURNING id, name, venue_name, city
`;

if (result.length === 0) {
  console.log('No events needed fixing (already correct or none found).');
} else {
  console.log(`Fixed ${result.length} event(s):`);
  result.forEach(r => console.log(`  ✓ [${r.city}] ${r.name} (venue: ${r.venue_name})`));
}

await sql.end();
