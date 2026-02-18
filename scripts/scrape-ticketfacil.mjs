import 'dotenv/config';

const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  console.error('CRON_SECRET not set in .env');
  process.exit(1);
}

const baseUrl = 'http://localhost:3000';
const headers = { 'x-cron-secret': cronSecret };

console.log('--- Scraping TicketFacil ---');
const scrapeRes = await fetch(`${baseUrl}/api/scrape/ticketfacil`, { headers });
const scrapeData = await scrapeRes.json();
console.log('Scrape result:', JSON.stringify(scrapeData, null, 2));

if (scrapeData.ok || scrapeData.data?.saved > 0) {
  // Wait a moment for the lock to clear, then process
  await new Promise(r => setTimeout(r, 3000));
  console.log('\n--- Running Processing Pipeline ---');
  const procRes = await fetch(`${baseUrl}/api/scrape/process?batch=200`, { headers });
  const procData = await procRes.json();
  console.log('Pipeline result:', JSON.stringify(procData, null, 2));
}
