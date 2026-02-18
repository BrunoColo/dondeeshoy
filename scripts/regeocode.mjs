/**
 * Re-geocode all events that are missing coordinates.
 * Uses the expanded known venues list and Mapbox API fallback.
 *
 * Usage: node scripts/regeocode.mjs
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

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ── Same known venues as geocoder.ts ──
const KNOWN_VENUES = [
  { keys: ["antel arena"], latitude: -34.8944, longitude: -56.1328 },
  { keys: ["teatro solis", "teatro solís"], latitude: -34.9077, longitude: -56.2006 },
  { keys: ["sodre", "auditorio nacional", "auditorio adela reta"], latitude: -34.9059, longitude: -56.1893 },
  { keys: ["cloud 7", "cloud7"], latitude: -34.9016, longitude: -56.1788 },
  { keys: ["sala del museo"], latitude: -34.9054, longitude: -56.2081 },
  { keys: ["radisson montevideo", "radisson victoria plaza", "victoria plaza hotel"], latitude: -34.9065, longitude: -56.1935 },
  { keys: ["plaza mateo"], latitude: -34.8823, longitude: -56.1677 },
  { keys: ["lotus, wtc", "lotus wtc", "world trade center montevideo"], latitude: -34.8987, longitude: -56.0734 },
  { keys: ["parque roosevelt", "parque franklin roosevelt"], latitude: -34.8763, longitude: -56.0494 },
  { keys: ["plaza italia shopping"], latitude: -34.8846, longitude: -56.2155 },
  { keys: ["mvd shopping"], latitude: -34.8750, longitude: -56.1417 },
  { keys: ["punta carretas shopping"], latitude: -34.9278, longitude: -56.1578 },
  { keys: ["tres cruces"], latitude: -34.8933, longitude: -56.1703 },
  { keys: ["montevideo shopping"], latitude: -34.8804, longitude: -56.1359 },
  { keys: ["portones shopping"], latitude: -34.8648, longitude: -56.0856 },
  { keys: ["nuevocentro shopping", "nuevo centro"], latitude: -34.8721, longitude: -56.1973 },
  { keys: ["fun fun"], latitude: -34.9078, longitude: -56.1994 },
  { keys: ["sala zitarrosa"], latitude: -34.9060, longitude: -56.1993 },
  { keys: ["bluzz live"], latitude: -34.9044, longitude: -56.1894 },
  { keys: ["la trastienda"], latitude: -34.9053, longitude: -56.1923 },
  { keys: ["sala lazaroff"], latitude: -34.8997, longitude: -56.1716 },
  { keys: ["museo del carnaval"], latitude: -34.9068, longitude: -56.2117 },
  { keys: ["teatro de verano"], latitude: -34.9204, longitude: -56.1617 },
  { keys: ["estadio centenario"], latitude: -34.8946, longitude: -56.1527 },
  { keys: ["palacio peñarol"], latitude: -34.8734, longitude: -56.1925 },
  { keys: ["velódromo", "velodromo"], latitude: -34.8941, longitude: -56.1463 },
  { keys: ["aero club del uruguay", "aero club"], latitude: -34.8442, longitude: -56.0311 },
  { keys: ["mapi", "museo de arte precolombino"], latitude: -34.9067, longitude: -56.1993 },
  { keys: ["museo oceanografico", "museo oceanográfico"], latitude: -34.9272, longitude: -56.1586 },
  { keys: ["atlantico shopping", "atlántico shopping"], latitude: -34.9240, longitude: -56.1552 },
  { keys: ["car one center"], latitude: -34.8880, longitude: -56.1760 },
  { keys: ["el muelle paintball"], latitude: -34.8600, longitude: -56.0500 },
  { keys: ["futvolt"], latitude: -34.8700, longitude: -56.1400 },
  { keys: ["ludus tactical"], latitude: -34.8700, longitude: -56.1200 },
  { keys: ["polo 33 paintball"], latitude: -34.8550, longitude: -56.0700 },
  { keys: ["tabare", "tabaré"], latitude: -34.9050, longitude: -56.2000 },
  { keys: ["jardin de eventos", "camino conde"], latitude: -34.8400, longitude: -56.1500 },
  { keys: ["museo el juguetero"], latitude: -34.9100, longitude: -56.1900 },
  { keys: ["la martina"], latitude: -34.8900, longitude: -56.1700 },
  { keys: ["magma futura"], latitude: -34.9058, longitude: -56.1882 },
  { keys: ["espacio odeón", "espacio odeon"], latitude: -34.9060, longitude: -56.1950 },
  { keys: ["papacho"], latitude: -34.9050, longitude: -56.1900 },
  { keys: ["teatro metro"], latitude: -34.9065, longitude: -56.1940 },
  { keys: ["teatro florencio sanchez", "teatro florencio sánchez"], latitude: -34.9072, longitude: -56.1930 },
  { keys: ["teatro del notariado"], latitude: -34.9080, longitude: -56.1960 },
  { keys: ["teatro del anglo"], latitude: -34.9070, longitude: -56.1920 },
  { keys: ["teatro 18 de julio"], latitude: -34.9060, longitude: -56.1870 },
  { keys: ["teatro camara"], latitude: -34.9055, longitude: -56.1910 },
  { keys: ["espacio cultural"], latitude: -34.9060, longitude: -56.1900 },
  { keys: ["punta shopping"], latitude: -34.9418, longitude: -54.9418 },
  { keys: ["solanas vacation", "solanas crystal", "solanas beach"], latitude: -34.8780, longitude: -55.0650 },
  { keys: ["parador 31", "costero beach club"], latitude: -34.9397, longitude: -54.9444 },
  { keys: ["torre punta del este"], latitude: -34.9380, longitude: -54.9415 },
  { keys: ["isla de lobos"], latitude: -35.0158, longitude: -54.8767 },
  { keys: ["pueblo arriba", "punta del diablo"], latitude: -34.0432, longitude: -53.8717 },
  { keys: ["plaza de toros real de san carlos"], latitude: -34.4696, longitude: -57.8576 },
  { keys: ["florida shopping"], latitude: -34.0979, longitude: -56.2149 },
  { keys: ["centro de aviacion civil de florida", "aviación civil florida"], latitude: -34.1000, longitude: -56.2200 },
  { keys: ["genoves beer", "genovés beer", "san jose de mayo"], latitude: -34.3370, longitude: -56.7130 },
  { keys: ["camino mainumby"], latitude: -34.8420, longitude: -55.9880 },
];

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
