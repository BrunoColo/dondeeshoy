// Get price and image details from event page
import 'dotenv/config';
import * as cheerio from 'cheerio';

const headers = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml',
  referer: 'https://accesofacil.com/',
};

const res = await fetch('https://accesofacil.com/Fausto-Santos/registerToEvent', { headers, signal: AbortSignal.timeout(15000) });
const html = await res.text();
const $ = cheerio.load(html);

// Print the ticket/price table HTML
console.log('=== Price table HTML ===');
$('table').each((i, el) => {
  console.log(`Table ${i}: ${$(el).html()?.substring(0, 800)}`);
});

// Print all p.detailItem elements
console.log('\n=== All .detailItem paragraphs ===');
$('p.detailItem').each((_, el) => {
  console.log($(el).text().replace(/\s+/g, ' ').trim());
});

// Check for description div
console.log('\n=== Description elements ===');
$('[class*="description"], [class*="descripcion"], [class*="desc-"], [id*="desc"]').each((_, el) => {
  const text = $(el).text().replace(/\s+/g, ' ').trim();
  if (text.length > 20) console.log(`[${el.name}] .${$(el).attr('class')}: ${text.substring(0, 300)}`);
});

// Print image URLs
console.log('\n=== Image URLs ===');
$('img').each((_, el) => {
  const src = $(el).attr('src');
  if (src && !src.includes('favicon')) console.log(src);
});

// Event ID from JS
const eventIdMatch = html.match(/let\s+eventId\s*=\s*(\d+)/);
console.log('\neventId:', eventIdMatch?.[1]);
if (eventIdMatch?.[1]) {
  console.log('Expected event image:', `https://accesofacil.com/images/acceso/events/images/${eventIdMatch[1]}/eventBigImg.png`);
}

// Get the section around "Precio"
const precioIdx = html.indexOf('Precio');
if (precioIdx >= 0) {
  console.log('\nHTML around "Precio":');
  console.log(html.substring(Math.max(0, precioIdx - 200), precioIdx + 500));
}









