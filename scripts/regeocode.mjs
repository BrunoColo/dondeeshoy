/**
 * Re-geocode all events that are missing coordinates.
 * Uses the expanded known venues list and Mapbox API fallback.
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

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

async function geocodeMapbox(venueName, venueAddress, city) {
  if (!mapboxToken) return null;
  const parts = [venueAddress, venueName, city || 'Uruguay'].filter(Boolean);
  const query = encodeURIComponent(parts.join(', '));
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?limit=1&country=uy&access_token=${mapboxToken}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const body = await res.json();
    const center = body.features?.[0]?.center;
    if (!center || center.length < 2) return null;
    const [lng, lat] = center;
    if (lat < -36 || lat > -30 || lng < -59 || lng > -53) return null;
    return { latitude: lat, longitude: lng, source: 'mapbox' };
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

let updated = 0;
let lookupHits = 0;
let mapboxHits = 0;
let failed = 0;

for (const event of events) {
  // Try lookup first
  let result = lookupKnownVenue(event.venue_name, event.venue_address);
  
  if (result) {
    lookupHits++;
  } else {
    // Try Mapbox
    result = await geocodeMapbox(event.venue_name, event.venue_address, event.city);
    if (result) {
      mapboxHits++;
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
  
  // Rate limit Mapbox calls
  if (result.source === 'mapbox') {
    await new Promise(r => setTimeout(r, 200));
  }
}

console.log(`\n── Results ──`);
console.log(`  Updated: ${updated}`);
console.log(`  Lookup hits: ${lookupHits}`);
console.log(`  Mapbox hits: ${mapboxHits}`);
console.log(`  Failed: ${failed}`);

await sql.end();
process.exit(0);
