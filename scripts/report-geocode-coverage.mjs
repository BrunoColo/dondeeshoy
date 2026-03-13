import "dotenv/config";
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

const [summary] = await sql`
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS with_coords,
    count(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL)::int AS missing_coords,
    count(*) FILTER (WHERE department IS NULL OR btrim(department) = '')::int AS missing_department
  FROM events
  WHERE status = 'active'
`;

const byDepartment = await sql`
  SELECT
    COALESCE(NULLIF(btrim(department), ''), 'Sin departamento') AS department,
    count(*)::int AS events,
    count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS with_coords
  FROM events
  WHERE status = 'active'
  GROUP BY 1
  ORDER BY events DESC, department ASC
`;

const withCoordsPct = summary.total > 0 ? ((summary.with_coords / summary.total) * 100).toFixed(2) : "0.00";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(scriptDir, "output");
mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "geocode-coverage-report.md");

const lines = [
  "# Geocode coverage report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `- Total eventos activos: **${summary.total}**`,
  `- Con coordenadas: **${summary.with_coords}** (${withCoordsPct}%)`,
  `- Sin coordenadas: **${summary.missing_coords}**`,
  `- Sin departamento: **${summary.missing_department}**`,
  "",
  "## Distribución por departamento",
  "",
  "| Departamento | Eventos | Con coords |",
  "|---|---:|---:|",
  ...byDepartment.map((row) => `| ${row.department} | ${row.events} | ${row.with_coords} |`),
];

writeFileSync(outputPath, lines.join("\n"), "utf-8");

console.log(summary);
console.log(`Report: ${outputPath}`);

await sql.end();
