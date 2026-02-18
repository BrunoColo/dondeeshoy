// Test script to check price extraction from accesofacil pages
const urls = [
  'https://accesofacil.com/Fausto-Santos/info/',
  'https://accesofacil.com/Fausto-Santos/registerToEvent/',
  'https://accesofacil.com/DEASAFIO-2-ARROYOS-2026/registerToEvent/',
  'https://accesofacil.com/El-Caldero-marzo/registerToEvent/',
];

for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    
    console.log(`\n=== ${url} ===`);
    
    // Check for tables
    const tables = html.match(/<table[\s\S]*?<\/table>/gi);
    console.log('Tables found:', tables ? tables.length : 0);
    
    // Extract initPrice attributes
    const initPrices = [...html.matchAll(/initPrice="(\d+)"/g)];
    console.log('initPrice values:', initPrices.map(m => m[1]));
    
    // Extract currency symbols
    const currencies = [...html.matchAll(/ticketTypeRowPrice[\s\S]*?<span>(.*?)<\/span>/g)];
    console.log('Currency symbols:', currencies.map(m => m[1]));
    
    // Extract ticket names
    const ticketNames = [...html.matchAll(/ticketTypeRowName[^>]*>(.*?)<\/td>/g)];
    console.log('Ticket names:', ticketNames.map(m => m[1].trim()));
    
    // Check for "Gratis" or "Gratuito" indicators
    if (/gratis|gratuito|entrada libre|free/i.test(html)) {
      console.log('FREE event detected');
    }
  } catch (e) {
    console.error(`Error fetching ${url}:`, e.message);
  }
}
