import "dotenv/config";
import postgres from "postgres";

const targetVenues = [
  "Teatro de la Candela",
  "Espacio Palermo",
  "Alejandria Café de las Artes",
  "Montevideo Music Box",
  "Magnolio Sala",
  "Teatro ACJ",
  "Sala Camacuá",
  "Centro de Eventos LATU",
  "Hipódromo Nacional de Maroñas",
  "Sala Jorge Lazaroff",
  "ACJ Montevideo",
  "Bluzz Bar",
  "Teatro Florencio Sánchez",
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

let url = process.env.DATABASE_URL;
const p = new URL(url);
if (p.hostname.includes("pooler.supabase.com") && p.port === "5432") {
  p.port = "6543";
  url = p.toString();
}

const sql = postgres(url, { prepare: false, max: 1 });

const rows = await sql`
  SELECT
    venue_name,
    count(*)::int AS cnt,
    round(avg((latitude)::numeric), 6) AS lat,
    round(avg((longitude)::numeric), 6) AS lng,
    round(stddev_pop((latitude)::numeric), 6) AS lat_std,
    round(stddev_pop((longitude)::numeric), 6) AS lng_std,
    min(city) AS city
  FROM events
  WHERE status = 'active'
    AND venue_name = ANY(${targetVenues})
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
  GROUP BY venue_name
  ORDER BY cnt DESC
`;

for (const row of rows) {
  console.log(JSON.stringify(row));
}

await sql.end();
