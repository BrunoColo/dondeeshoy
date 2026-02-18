/**
 * fix-departments.mjs
 *
 * Retroactively fixes the `city` (department) field for all active events
 * that were stored with the hardcoded "Montevideo" default but actually
 * belong to another Uruguay department.
 *
 * Uses the same detection logic as the new department-detector.ts.
 * Run once after deploying the normalizer fix.
 */

import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Department detection rules (mirrors department-detector.ts) ──────────────

const DEPARTMENT_RULES = [
  {
    keywords: [
      "punta del este", "punta shopping", "jose ignacio", "josé ignacio",
      "la barra", "manantiales", "maldonado", "piriapolis", "piriápolis",
      "pan de azucar", "pan de azúcar", "aiguá", "aigua", "garzón", "garzon",
      "solanas", "parador 31", "costero beach club", "isla de lobos",
      "isla gorriti", "torre punta del este", "puerto punta del este",
      "puerto, punta del este", "rambla mansa", "rambla brava",
      "playa brava", "playa mansa", "san carlos",
      "balneario buenos aires",
    ],
    department: "Maldonado",
  },
  {
    keywords: [
      "canelones", "atlantida", "atlántida", "la paz", "las piedras",
      "progreso", "pando", "ciudad de la costa", "solymar", "el pinar",
      "salinas", "santa lucia", "santa lucía", "tala", "sauce", "migues",
      "parque del plata", "cam. de los horneros", "camino de los horneros",
      "camino mainumby", "jardín cervecero", "jardin cervecero",
    ],
    department: "Canelones",
  },
  {
    keywords: [
      "colonia del sacramento", "colonia del sacrament", "carmelo",
      "nueva helvecia", "nueva palmira", "rosario", "juan lacaze",
      "plaza de toros real de san carlos", "real de san carlos",
      "av. rodó esq. tabaré, 70100",
      // NOTE: bare "colonia" is intentionally last to avoid false positives
      "colonia",
    ],
    department: "Colonia",
  },
  {
    keywords: [
      "san jose de mayo", "san josé de mayo", "ciudad del plata",
      "libertad", "genoves beer", "genovés beer",
    ],
    department: "San José",
  },
  {
    keywords: ["mercedes", "dolores", "cardona", "soriano"],
    department: "Soriano",
  },
  {
    keywords: ["fray bentos", "rio negro", "río negro"],
    department: "Río Negro",
  },
  {
    keywords: ["paysandu", "paysandú", "guichon", "guichón"],
    department: "Paysandú",
  },
  {
    keywords: [
      "salto", "costanera norte", "termas del dayman", "termas de arapey",
      "5000 salto", "costanera nte., 5000",
    ],
    department: "Salto",
  },
  {
    keywords: [
      "bella union", "bella unión",
      "carnaval de artigas", "ciudad de artigas",
      "departamento de artigas", "dep. artigas",
      "artigas, uruguay", "55000",
    ],
    department: "Artigas",
  },
  {
    keywords: ["rivera", "tranqueras"],
    department: "Rivera",
  },
  {
    keywords: ["tacuarembo", "tacuarembó", "paso de los toros"],
    department: "Tacuarembó",
  },
  {
    keywords: ["melo", "cerro largo", "rio branco", "río branco"],
    department: "Cerro Largo",
  },
  {
    keywords: ["treinta y tres", "vergara"],
    department: "Treinta y Tres",
  },
  {
    keywords: ["durazno", "villa del carmen", "sarand"],
    department: "Durazno",
  },
  {
    keywords: [
      "florida shopping", "centro de aviacion civil de florida",
      "aviación civil florida", "aviacion civil florida",
      "alberto heber usher", "florida, dep", ", florida",
    ],
    department: "Florida",
  },
  {
    keywords: ["trinidad", "flores"],
    department: "Flores",
  },
  {
    keywords: [
      "minas", "lavalleja", "aguas blancas", "camping aguas blancas",
      "valle de los vientos", "dtectival", "la peña blanca",
      "castillo de cesar batlle",
    ],
    department: "Lavalleja",
  },
  {
    keywords: [
      "la paloma", "rocha", "chuy", "la pedrera", "punta del diablo",
      "cabo polonio", "aguas dulces", "valizas", "puerto de la paloma",
    ],
    department: "Rocha",
  },
];

function normalizeForMatch(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDepartment(venueName, venueAddress, scraperCity, eventName) {
  const parts = [scraperCity, venueAddress, venueName].filter(Boolean);
  const combinedPrimary = normalizeForMatch(parts.join(" "));
  const combinedWithName = normalizeForMatch([...parts, eventName ?? ""].join(" "));

  for (const rule of DEPARTMENT_RULES) {
    for (const keyword of rule.keywords) {
      if (combinedPrimary.includes(normalizeForMatch(keyword))) {
        return rule.department;
      }
    }
  }

  for (const rule of DEPARTMENT_RULES) {
    for (const keyword of rule.keywords) {
      if (combinedWithName.includes(normalizeForMatch(keyword))) {
        return rule.department;
      }
    }
  }

  return "Montevideo";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    // Fetch all active events with their raw data joined
    const { rows: events } = await client.query(`
      SELECT
        e.id,
        e.name,
        e.venue_name,
        e.venue_address,
        e.city,
        -- Get the city field from the most recent raw_event for this event
        (
          SELECT re.raw_data->>'city'
          FROM raw_events re
          JOIN event_sources es ON es.raw_event_id = re.id
          WHERE es.event_id = e.id
          ORDER BY re.scraped_at DESC
          LIMIT 1
        ) as scraper_city
      FROM events e
      WHERE e.status = 'active'
      ORDER BY e.id
    `);

    console.log(`Processing ${events.length} active events...`);

    let updated = 0;
    let unchanged = 0;
    const changes = [];

    for (const event of events) {
      const detected = detectDepartment(
        event.venue_name,
        event.venue_address,
        event.scraper_city,
        event.name,
      );

      if (detected !== event.city) {
        changes.push({
          id: event.id,
          name: event.name,
          venue: event.venue_name,
          addr: event.venue_address,
          scraperCity: event.scraper_city,
          oldCity: event.city,
          newCity: detected,
        });
      } else {
        unchanged++;
      }
    }

    console.log(`\nFound ${changes.length} events to update, ${unchanged} already correct.\n`);

    if (changes.length === 0) {
      console.log('Nothing to update!');
      return;
    }

    // Show preview
    console.log('Changes to apply:');
    for (const c of changes) {
      console.log(`  [${c.oldCity} → ${c.newCity}] ${c.name}`);
      console.log(`    venue: ${c.venue} | addr: ${c.addr || '(null)'} | scraperCity: ${c.scraperCity || '(null)'}`);
    }

    // Apply updates
    console.log('\nApplying updates...');
    for (const c of changes) {
      await client.query(
        `UPDATE events SET city = $1, updated_at = NOW() WHERE id = $2`,
        [c.newCity, c.id],
      );
      updated++;
    }

    console.log(`\n✅ Updated ${updated} events.`);

    // Show final distribution
    const { rows: dist } = await client.query(`
      SELECT city, count(*) as cnt
      FROM events
      WHERE status = 'active'
      GROUP BY city
      ORDER BY cnt DESC
    `);
    console.log('\nFinal city distribution:');
    dist.forEach(r => console.log(`  "${r.city}": ${r.cnt}`));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
