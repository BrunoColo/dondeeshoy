// Quick test of the cobraticket scraper logic against the live site
import * as cheerio from "cheerio";

const EVENT_PATH_REGEX = /\/e\/([\w-]+-\d+)\/?$/i;

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function testDiscovery() {
  console.log("=== TESTING DISCOVERY ===\n");
  const html = await fetchHtml("https://cobraticket.uy/eventos");

  const markerIndex = html.indexOf("Eventos pasados");
  console.log("'Eventos pasados' marker found at char index:", markerIndex);

  const upcomingHtml = html.substring(0, markerIndex);
  const $ = cheerio.load(upcomingHtml);

  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && EVENT_PATH_REGEX.test(href)) {
      links.push(href);
    }
  });

  const unique = [...new Set(links)];
  console.log(`Found ${unique.length} upcoming events:\n`);
  unique.forEach((l) => console.log("  ", l));
  return unique;
}

function extractSvelteKitProps(html) {
  // The inline data uses JS object notation (unquoted keys), not valid JSON.
  // We use new Function() to evaluate it safely since it's server-side.
  const dataMatch = html.match(
    /const\s+data\s*=\s*(\[[\s\S]*?\])\s*;\s*(?:\r?\n|\s*Promise)/
  );
  if (!dataMatch?.[1]) return null;

  try {
    // Use Function constructor to evaluate the JS array literal
    const dataArray = new Function("return " + dataMatch[1])();
    if (!Array.isArray(dataArray)) return null;

    for (const item of dataArray) {
      if (item?.type === "data" && item.data?.props) {
        return item.data.props;
      }
    }
    return null;
  } catch (err) {
    console.error("  Parse error:", err.message);
    return null;
  }
}

async function testDetailPage(slug) {
  const url = "https://cobraticket.uy" + slug;
  console.log(`\n--- Fetching: ${url} ---`);
  const html = await fetchHtml(url);

  const props = extractSvelteKitProps(html);
  if (!props) {
    console.log("  ❌ No SvelteKit props found!");
    return;
  }

  console.log("  ✓ Title:", props.name);
  console.log("  ✓ Category:", props.category?.name || "N/A");
  console.log("  ✓ Start:", props.startAt || "N/A");
  console.log("  ✓ End:", props.endAt || "N/A");
  console.log("  ✓ Venue:", props.location?.name || "N/A");
  console.log("  ✓ Address:", props.location?.address || "N/A");
  console.log("  ✓ Region:", props.location?.region || "N/A");
  console.log(
    "  ✓ Lat/Lng:",
    props.location?.latlng?.lat ?? "N/A",
    props.location?.latlng?.lng ?? "N/A"
  );
  console.log("  ✓ Image:", props.image?.url ? "YES" : "N/A");
  console.log("  ✓ Cover:", props.imageCover?.url ? "YES" : "N/A");
  console.log("  ✓ Organizer:", props.account?.name || "N/A");
  console.log("  ✓ MinAge:", props.minAge ?? "N/A");
  console.log(
    "  ✓ Description:",
    props.description ? props.description.substring(0, 120) + "..." : "N/A"
  );
}

async function main() {
  const links = await testDiscovery();

  console.log("\n=== TESTING DETAIL PAGES ===");

  // Test up to 3 events
  const toTest = links.slice(0, 3);
  for (const slug of toTest) {
    await testDetailPage(slug);
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
