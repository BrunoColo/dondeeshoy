import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // City distribution
    const cities = await client.query(`
      SELECT city, count(*) as cnt
      FROM events
      WHERE status = 'active'
      GROUP BY city
      ORDER BY cnt DESC
    `);
    console.log('=== City distribution ===');
    cities.rows.forEach(r => console.log(`  "${r.city}": ${r.cnt}`));

    // Events that mention Punta del Este, Maldonado, Carmelo, etc. in name/venue/address but have city=Montevideo
    const mismatched = await client.query(`
      SELECT name, venue_name, venue_address, city, date
      FROM events
      WHERE status = 'active'
        AND city = 'Montevideo'
        AND (
          lower(name) LIKE '%punta del este%'
          OR lower(venue_name) LIKE '%punta del este%'
          OR lower(venue_address) LIKE '%punta del este%'
          OR lower(name) LIKE '%maldonado%'
          OR lower(venue_name) LIKE '%maldonado%'
          OR lower(venue_address) LIKE '%maldonado%'
          OR lower(name) LIKE '%carmelo%'
          OR lower(venue_name) LIKE '%carmelo%'
          OR lower(venue_address) LIKE '%carmelo%'
          OR lower(name) LIKE '%colonia%'
          OR lower(venue_name) LIKE '%colonia%'
          OR lower(venue_address) LIKE '%colonia%'
          OR lower(name) LIKE '%salto%'
          OR lower(venue_name) LIKE '%salto%'
          OR lower(venue_address) LIKE '%salto%'
          OR lower(name) LIKE '%rivera%'
          OR lower(venue_name) LIKE '%rivera%'
          OR lower(venue_address) LIKE '%rivera%'
          OR lower(name) LIKE '%paysandu%'
          OR lower(venue_name) LIKE '%paysandu%'
          OR lower(venue_address) LIKE '%paysandu%'
          OR lower(name) LIKE '%canelones%'
          OR lower(venue_name) LIKE '%canelones%'
          OR lower(venue_address) LIKE '%canelones%'
          OR lower(name) LIKE '%rocha%'
          OR lower(venue_name) LIKE '%rocha%'
          OR lower(venue_address) LIKE '%rocha%'
          OR lower(name) LIKE '%minas%'
          OR lower(venue_name) LIKE '%minas%'
          OR lower(venue_address) LIKE '%minas%'
          OR lower(name) LIKE '%florida%'
          OR lower(venue_name) LIKE '%florida%'
          OR lower(venue_address) LIKE '%florida%'
          OR lower(name) LIKE '%durazno%'
          OR lower(venue_name) LIKE '%durazno%'
          OR lower(venue_address) LIKE '%durazno%'
          OR lower(name) LIKE '%tacuarembo%'
          OR lower(venue_name) LIKE '%tacuarembo%'
          OR lower(venue_address) LIKE '%tacuarembo%'
          OR lower(name) LIKE '%mercedes%'
          OR lower(venue_name) LIKE '%mercedes%'
          OR lower(venue_address) LIKE '%mercedes%'
          OR lower(name) LIKE '%treinta y tres%'
          OR lower(venue_name) LIKE '%treinta y tres%'
          OR lower(venue_address) LIKE '%treinta y tres%'
          OR lower(name) LIKE '%jose ignacio%'
          OR lower(venue_name) LIKE '%jose ignacio%'
          OR lower(venue_address) LIKE '%jose ignacio%'
          OR lower(name) LIKE '%la paloma%'
          OR lower(venue_name) LIKE '%la paloma%'
          OR lower(venue_address) LIKE '%la paloma%'
          OR lower(name) LIKE '%atlantida%'
          OR lower(venue_name) LIKE '%atlantida%'
          OR lower(venue_address) LIKE '%atlantida%'
          OR lower(name) LIKE '%piriapolis%'
          OR lower(venue_name) LIKE '%piriapolis%'
          OR lower(venue_address) LIKE '%piriapolis%'
        )
      ORDER BY date ASC
      LIMIT 50
    `);
    console.log(`\n=== Events with non-Montevideo location but city=Montevideo (${mismatched.rows.length}) ===`);
    mismatched.rows.forEach(r => {
      console.log(`  [${r.date}] ${r.name}`);
      console.log(`    venue: ${r.venue_name} | addr: ${r.venue_address || '(null)'} | city: ${r.city}`);
    });

    // Also check what non-Montevideo cities exist
    const nonMvd = await client.query(`
      SELECT name, venue_name, venue_address, city, date
      FROM events
      WHERE status = 'active'
        AND city != 'Montevideo'
      ORDER BY city, date ASC
      LIMIT 30
    `);
    console.log(`\n=== Events with city != Montevideo (${nonMvd.rows.length} shown) ===`);
    nonMvd.rows.forEach(r => {
      console.log(`  [${r.city}] [${r.date}] ${r.name}`);
      console.log(`    venue: ${r.venue_name} | addr: ${r.venue_address || '(null)'}`);
    });

    // Check CobraTicket raw data for city field
    const cobraRaw = await client.query(`
      SELECT raw_data->>'title' as title,
             raw_data->>'venueText' as venue,
             raw_data->>'venueAddress' as addr,
             raw_data->>'city' as city
      FROM raw_events
      WHERE source = 'cobraticket'
      ORDER BY scraped_at DESC
      LIMIT 20
    `);
    console.log('\n=== CobraTicket raw city data ===');
    cobraRaw.rows.forEach(r => {
      console.log(`  ${r.title}`);
      console.log(`    venue: ${r.venue} | addr: ${r.addr} | city: ${r.city}`);
    });

    // Check TicketFacil raw data for venue
    const tfRaw = await client.query(`
      SELECT raw_data->>'title' as title,
             raw_data->>'venueName' as venue
      FROM raw_events
      WHERE source = 'ticketfacil'
      ORDER BY scraped_at DESC
      LIMIT 20
    `);
    console.log('\n=== TicketFacil raw venue data ===');
    tfRaw.rows.forEach(r => {
      console.log(`  ${r.title} | venue: ${r.venue}`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
