/**
 * Build Top-100 venue verification queue for manual validation in Google Maps.
 *
 * Output:
 * - scripts/output/top-venues-100.json
 * - scripts/output/top-venues-verification.md
 *
 * Usage: node scripts/prepare-venue-verification.mjs
 */
import "dotenv/config";
import postgres from "postgres";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(scriptDir, "output");
mkdirSync(outputDir, { recursive: true });

const knownVenuesPath = path.join(scriptDir, "..", "src", "config", "known-venues.json");
const knownVenues = JSON.parse(readFileSync(knownVenuesPath, "utf-8"));

let url = process.env.DATABASE_URL;
const p = new URL(url);
if (p.hostname.includes("pooler.supabase.com") && p.port === "5432") {
  p.port = "6543";
  url = p.toString();
}

const sql = postgres(url, { prepare: false, max: 1 });

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isKnownVenue(venueName, sampleAddress) {
  const text = normalize(`${venueName ?? ""} ${sampleAddress ?? ""}`);
  return knownVenues.find((entry) =>
    (entry.keys ?? []).some((key) => text.includes(normalize(key))),
  );
}

function googleMapsSearchUrl(venueName, sampleCity, sampleAddress) {
  const query = [venueName, sampleAddress, sampleCity, "Uruguay"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const topVenues = await sql`
  SELECT
    venue_name,
    count(*)::int AS total_events,
    count(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL)::int AS missing_coords,
    min(city) AS sample_city,
    min(venue_address) AS sample_address,
    max(updated_at) AS last_seen_at
  FROM events
  WHERE status = 'active'
    AND venue_name IS NOT NULL
    AND btrim(venue_name) <> ''
  GROUP BY venue_name
  ORDER BY total_events DESC, venue_name ASC
  LIMIT 100
`;

const rows = topVenues.map((row, index) => {
  const known = isKnownVenue(row.venue_name, row.sample_address);
  return {
    rank: index + 1,
    venueName: row.venue_name,
    totalEvents: row.total_events,
    missingCoords: row.missing_coords,
    sampleCity: row.sample_city,
    sampleAddress: row.sample_address,
    lastSeenAt: row.last_seen_at,
    status: known ? "known" : "needs-review",
    knownCoords: known
      ? { latitude: known.latitude, longitude: known.longitude }
      : null,
    googleMapsUrl: googleMapsSearchUrl(row.venue_name, row.sample_city, row.sample_address),
  };
});

const jsonPath = path.join(outputDir, "top-venues-100.json");
writeFileSync(jsonPath, JSON.stringify(rows, null, 2), "utf-8");

const mdLines = [
  "# Top 100 venues para validación manual",
  "",
  "Regla sugerida: hardcodear solo si Google Maps confirma claramente venue + ubicación en Uruguay.",
  "",
  "| # | Venue | Eventos | Sin coords | Estado | Maps |",
  "|---:|---|---:|---:|---|---|",
  ...rows.map((r) => {
    const maps = `[Abrir](${r.googleMapsUrl})`;
    return `| ${r.rank} | ${r.venueName.replace(/\|/g, "\\|")} | ${r.totalEvents} | ${r.missingCoords} | ${r.status} | ${maps} |`;
  }),
  "",
  `Generado: ${new Date().toISOString()}`,
];

const mdPath = path.join(outputDir, "top-venues-verification.md");
writeFileSync(mdPath, mdLines.join("\n"), "utf-8");

const knownCount = rows.filter((r) => r.status === "known").length;
const reviewCount = rows.length - knownCount;

console.log(`Top-100 generado: ${rows.length}`);
console.log(`Ya cubiertos por known venues: ${knownCount}`);
console.log(`Pendientes de revisión manual: ${reviewCount}`);
console.log(`JSON: ${jsonPath}`);
console.log(`Markdown: ${mdPath}`);

await sql.end();
