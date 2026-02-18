/**
 * test-redtickets-search.mjs
 *
 * Diagnostic script to analyze the RedTickets search page structure
 * and compare event discovery between homepage-only vs homepage+search.
 *
 * Usage: node scripts/test-redtickets-search.mjs
 */

const BASE_URL = "https://redtickets.uy";
const EVENT_PATH_REGEX = /\/evento\/([^/]+)\/(\d+)\/?$/i;
const MAX_PAGES = 10;

function buildSearchUrl(page) {
  return `${BASE_URL}/busqueda?,*,0,${page}`;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractEventLinks(html) {
  const links = new Set();
  const hrefRegex = /href=["']([^"']*\/evento\/[^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (EVENT_PATH_REGEX.test(href)) {
      try {
        links.add(new URL(href, BASE_URL).toString());
      } catch {
        // skip malformed URLs
      }
    }
  }
  return links;
}

function analyzePageStructure(html, label) {
  const hasCards =
    /class=["'][^"']*(?:card|Card|event|Event|item|Item)/i.test(html);
  const hasCategory =
    /class=["'][^"']*(?:category|Category|categoria|tag|Tag|badge)/i.test(html);
  const hasImages = /files\.redtickets\.uy/i.test(html);
  const hasJsonLd = /application\/ld\+json/i.test(html);

  console.log(`  [${label}] Structure:`);
  console.log(`    Card-like elements: ${hasCards}`);
  console.log(`    Category elements:  ${hasCategory}`);
  console.log(`    RedTickets images:  ${hasImages}`);
  console.log(`    JSON-LD data:       ${hasJsonLd}`);
}

async function main() {
  console.log("=== RedTickets Search Page Analysis ===\n");

  // 1. Homepage
  console.log("── Homepage ──");
  let homeLinks = new Set();
  try {
    const html = await fetchPage(BASE_URL);
    homeLinks = extractEventLinks(html);
    console.log(`  Event links: ${homeLinks.size}`);
    analyzePageStructure(html, "home");
    for (const link of [...homeLinks].slice(0, 3)) {
      console.log(`    ${link}`);
    }
    if (homeLinks.size > 3) console.log(`    ... +${homeLinks.size - 3} more`);
  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }

  // 2. Search pages
  console.log("\n── Search Pages ──");
  const allSearchLinks = new Set();
  let consecutiveEmpty = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = buildSearchUrl(page);
    console.log(`\n  Page ${page}: ${url}`);

    try {
      const html = await fetchPage(url);
      const pageLinks = extractEventLinks(html);

      console.log(`  Event links: ${pageLinks.size}`);
      if (page === 0) analyzePageStructure(html, `search-${page}`);

      if (pageLinks.size === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 2) {
          console.log("  Stopping — 2 consecutive empty pages.");
          break;
        }
      } else {
        consecutiveEmpty = 0;
        for (const link of pageLinks) allSearchLinks.add(link);
      }

      // Sample HTML context around first event link on page 0
      if (page === 0 && pageLinks.size > 0) {
        const firstLink = [...pageLinks][0];
        const linkPath = new URL(firstLink).pathname;
        const idx = html.indexOf(linkPath);
        if (idx >= 0) {
          const start = Math.max(0, idx - 300);
          const end = Math.min(html.length, idx + 300);
          console.log("\n  Sample HTML context:");
          console.log(
            `  ${html.substring(start, end).replace(/\s+/g, " ").substring(0, 500)}`,
          );
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }

  // 3. Summary
  console.log("\n\n=== SUMMARY ===");
  const searchOnly = [...allSearchLinks].filter((l) => !homeLinks.has(l));
  const homeOnly = [...homeLinks].filter((l) => !allSearchLinks.has(l));
  const combined = new Set([...homeLinks, ...allSearchLinks]);

  console.log(`  Homepage events:         ${homeLinks.size}`);
  console.log(`  Search events:           ${allSearchLinks.size}`);
  console.log(`  NEW via search only:     ${searchOnly.length}`);
  console.log(`  Homepage-only events:    ${homeOnly.length}`);
  console.log(`  Combined unique total:   ${combined.size}`);

  if (searchOnly.length > 0) {
    console.log("\n  New events found via search (first 10):");
    for (const link of searchOnly.slice(0, 10)) {
      console.log(`    ${link}`);
    }
  }
}

main().catch(console.error);
