import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔧 Arreglando eventos con fechas incorrectas...\n');

    // Obtener todos los eventos con años incorrectos y su rawData asociado
    const badEventsResult = await client.query(`
      SELECT 
        e.id, 
        e.name, 
        e.date, 
        e.venue_name,
        re.raw_data,
        re.id as raw_event_id
      FROM events e
      JOIN event_sources es ON e.id = es.event_id
      JOIN raw_events re ON es.raw_event_id = re.id
      WHERE EXTRACT(YEAR FROM e.date) != 2026
      ORDER BY e.date ASC
    `);

    console.log(`Found ${badEventsResult.rows.length} bad event-rawdata pairs\n`);

    let fixedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const row of badEventsResult.rows) {
      const rawData = row.raw_data || {};
      
      // Try to extract correct date from rawData
      let correctDate = null;

      // Strategy 1: Check for ISO dates in ranges that might be legit
      if (rawData.dateIso && typeof rawData.dateIso === 'string') {
        const match = rawData.dateIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const year = Number.parseInt(match[1], 10);
          // If it's 2026 or 2027, perhaps the initial parse was wrong
          if ((year === 2026 || year === 2027) && !correctDate) {
            correctDate = match[0]; // YYYY-MM-DD
          }
        }
      }

      if (rawData.dateText && typeof rawData.dateText === 'string' && !correctDate) {
        const match = rawData.dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const year = Number.parseInt(match[1], 10);
          if ((year === 2026 || year === 2027) && !correctDate) {
            correctDate = match[0]; // YYYY-MM-DD
          }
        }
      }

      if (!correctDate) {
        // Strategy 2: Try parsing Spanish text from name or dateText
        // This is trickier; for now, we'll skip these
        console.log(
          `⏭️  SKIP: ${row.name} | Current: ${row.date} | Reason: Can't extract valid ISO from rawData`
        );
        skippedCount++;
        continue;
      }

      // Validate the extracted date is reasonable
      const match = correctDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) {
        console.log(`❌ FAIL: ${row.name} | Invalid date format: ${correctDate}`);
        failedCount++;
        continue;
      }

      const year = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10);
      const day = Number.parseInt(match[3], 10);

      // Validate calendar
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        console.log(`❌ FAIL: ${row.name} | Invalid date values: Y=${year}, M=${month}, D=${day}`);
        failedCount++;
        continue;
      }

      // Final check: confirm it's a valid calendar date
      const candidate = new Date(Date.UTC(year, month - 1, day));
      if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
        console.log(`❌ FAIL: ${row.name} | Date validation failed: ${correctDate}`);
        failedCount++;
        continue;
      }

      // Update the event
      try {
        await client.query(
          `UPDATE events SET date = $1, updated_at = NOW() WHERE id = $2`,
          [correctDate, row.id]
        );
        console.log(`✅ FIXED: ${row.name} | ${row.date} → ${correctDate}`);
        fixedCount++;
      } catch (error) {
        console.log(`❌ FAIL: ${row.name} | DB Error: ${error.message}`);
        failedCount++;
      }
    }

    console.log(`\n\n📊 RESULTS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Fixed: ${fixedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`⏭️  Skipped (need manual review): ${skippedCount}`);
    console.log(`Total: ${badEventsResult.rows.length}`);

  } finally {
    client.release();
    pool.end();
  }
}

main().catch(console.error);
