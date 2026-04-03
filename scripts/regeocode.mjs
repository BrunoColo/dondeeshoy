/**
 * Re-geocode all events that are missing coordinates.
 * Uses the expanded known venues list and Google Geocoding API fallback.
 *
 * Usage: node scripts/regeocode.mjs
 */
import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let url = process.env.DATABASE_URL;
const p = new URL(url);
if (p.hostname.includes('pooler.supabase.com') && p.port === '5432') {
  p.port = '6543';
  url = p.toString();
}
const sql = postgres(url, { prepare: false, max: 1 });

const googleGeocodingKey =
  process.env.GOOGLE_GEOCODING_API_KEY ||
  process.env.GOOGLE_MAPS_SERVER_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  null;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const knownVenuesPath = path.join(scriptDir, "..", "src", "config", "known-venues.json");
const KNOWN_VENUES = JSON.parse(readFileSync(knownVenuesPath, "utf-8"));

function normalize(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function lookupKnownVenue(venueName, venueAddress) {
  const text = normalize([venueName, venueAddress || ""].join(" "));
  for (const venue of KNOWN_VENUES) {
    if (venue.keys.some(key => text.includes(normalize(key)))) {
      return { latitude: venue.latitude, longitude: venue.longitude, source: 'lookup' };
    }
  }
  return null;
}

async function geocodeGoogle(venueName, venueAddress, city) {
  if (!googleGeocodingKey) return null;

  const parts = [venueAddress, venueName, city || 'Uruguay'].filter(Boolean);
  const params = new URLSearchParams({
    address: parts.join(', '),
    components: 'country:UY',
    region: 'uy',
    language: 'es',
    key: googleGeocodingKey,
  });
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const body = await res.json();
    if (body.status !== 'OK') return null;
    const location = body.results?.[0]?.geometry?.location;
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -36 || lat > -30 || lng < -59 || lng > -53) return null;
    return { latitude: lat, longitude: lng, source: 'google' };
  } catch {
    return null;
  }
}

// ── Main ──
const events = await sql`
  SELECT id, venue_name, venue_address, city
  FROM events
  WHERE latitude IS NULL OR longitude IS NULL
`;

console.log(`Found ${events.length} events without coordinates\n`);
if (!googleGeocodingKey) {
  console.warn('⚠ GOOGLE_GEOCODING_API_KEY / GOOGLE_MAPS_SERVER_API_KEY no está configurada. Solo se usarán venues conocidos.');
}

let updated = 0;
let lookupHits = 0;
let googleHits = 0;
let failed = 0;

for (const event of events) {
  // Try lookup first
  let result = lookupKnownVenue(event.venue_name, event.venue_address);
  
  if (result) {
    lookupHits++;
  } else {
    // Try Google Geocoding
    result = await geocodeGoogle(event.venue_name, event.venue_address, event.city);
    if (result) {
      googleHits++;
    } else {
      failed++;
      console.log(`  ✗ Could not geocode: "${event.venue_name}" (${event.venue_address || 'no address'})`);
      continue;
    }
  }

  await sql`
    UPDATE events 
    SET latitude = ${result.latitude.toString()}, longitude = ${result.longitude.toString()}, updated_at = NOW()
    WHERE id = ${event.id}
  `;
  updated++;
  console.log(`  ✓ [${result.source}] ${event.venue_name} → (${result.latitude}, ${result.longitude})`);
  
  // Rate limit Google Geocoding calls
  if (result.source === 'google') {
    await new Promise(r => setTimeout(r, 120));
  }
}

console.log(`\n── Results ──`);
console.log(`  Updated: ${updated}`);
console.log(`  Lookup hits: ${lookupHits}`);
console.log(`  Google hits: ${googleHits}`);
console.log(`  Failed: ${failed}`);

await sql.end();
process.exit(0);
