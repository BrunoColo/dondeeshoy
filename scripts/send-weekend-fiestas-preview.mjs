import "dotenv/config";

const DEFAULT_EMAIL = "brunocolo05@gmail.com";

function getArgValue(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function normalizeBaseUrl(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function formatByDate(byDate) {
  if (!Array.isArray(byDate) || byDate.length === 0) return "(sin eventos)";

  return byDate
    .map((item) => `  - ${item.date}: ${item.count} evento${item.count === 1 ? "" : "s"}`)
    .join("\n");
}

async function main() {
  const email = getArgValue("--email", DEFAULT_EMAIL).trim().toLowerCase();
  const baseUrl = normalizeBaseUrl(
    getArgValue(
      "--base-url",
      process.env.NEWSLETTER_PREVIEW_BASE_URL || "http://localhost:3000",
    ),
  );
  const previewType = getArgValue("--type", "fiesta").trim().toLowerCase() || "fiesta";
  const dryRun = hasFlag("--dry-run");

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error("CRON_SECRET no está definido en el entorno (.env)");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Email inválido: ${email}`);
  }

  const url = new URL(`${baseUrl}/api/cron/newsletter`);
  url.searchParams.set("frequency", "weekly");
  url.searchParams.set("previewEmail", email);
  if (previewType && previewType !== "all") {
    url.searchParams.set("previewType", previewType);
  }
  if (dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  console.log(`[preview] enviando preview semanal`);
  console.log(`[preview] baseUrl=${baseUrl}`);
  console.log(`[preview] email=${email}`);
  console.log(`[preview] tipo=${previewType}`);
  console.log(`[preview] dryRun=${dryRun}`);

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "x-cron-secret": cronSecret,
      },
    });
  } catch (error) {
    throw new Error(
      `No se pudo conectar a ${baseUrl}. Si usás local, levantá la app primero con npm run dev. Detalle: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(`Preview falló con status ${response.status}: ${JSON.stringify(payload)}`);
  }

  console.log("\n[preview] resultado:");
  console.log(`- totalFound: ${payload?.totalFound ?? 0}`);
  console.log(`- totalSelected: ${payload?.totalSelected ?? 0}`);
  console.log(`- sent: ${payload?.sent ? "sí" : "no"}`);
  console.log(`- dryRun: ${payload?.dryRun ? "sí" : "no"}`);
  console.log("- eventos por fecha:");
  console.log(formatByDate(payload?.byDate));

  if (!dryRun && payload?.sent) {
    console.log("\n✅ Preview enviado. Revisá la bandeja de Gmail.");
  } else if (dryRun) {
    console.log("\nℹ️ Dry-run: no se envió email.");
  } else {
    console.log("\n⚠️ No se envió email porque no hubo eventos seleccionados.");
  }
}

main().catch((error) => {
  console.error("[send-weekend-fiestas-preview] ERROR:", error);
  process.exit(1);
});
