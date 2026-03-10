import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const FOCUS_NAMES = [
  "Academia Club Nacional de Football - ESCUELA ANUAL 2026",
  "ANIMALES SIN HOGAR",
  "COMUNIDAD VOY",
  "San Patrick party",
  "Envejecimiento activo: Canto colectivo",
  "Envejecimiento activo: Taller de candombe y percusión",
  "Envejecimiento activo: Taller de lectura y escritura creativa",
  "Coeficiente Analítico - PASE ANUAL",
  "Club de Blues Uruguay - Apertura 2026",
  "VISITAS A LA ISLA GORRITI",
  "VISITAS A LA ISLA DE LOBOS",
  "Visitas guiadas al Palacio Salvo - MARZO",
  "Colaborá con el Club Atlético Atenas",
  "Reserva Natural Salus - MARZO",
];

const SOURCE_CATEGORY_MAP = {
  fiestas: "fiesta",
  deportes: "deportivo",
  musica: "concierto",
  teatro: "teatro",
  museos: "cultural",
  familiares: "familiar",
  turismo: "cultural",
  carnaval: "festival",
};

const REJECT_PATTERNS = [
  /\b(?:pase|abono|plan|membres[ií]a|escuela|suscripci[oó]n)\s+anual\b/i,
  /\bescuela\s+anual\b/i,
  /\bsuscrib[ií]te\b/i,
  /\bhac[eé]\s+tu\s+donaci[oó]n\b/i,
  /^\s*colabor[aá]\s+con\s+/i,
  /\btodos?\s+los\s+talleres?\s+de\s+verano\b/i,
  /\bsolo\s+asist[íi]\s+en\s+el\s+d[ií]a\s+y\s+horario\s+de\s+la\s+actividad\b/i,
];

function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCategory(raw = "") {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mapSourceCategory(raw) {
  if (!raw) return null;
  return SOURCE_CATEGORY_MAP[normalizeCategory(raw)] ?? null;
}

function shouldReject(row) {
  const text = normalizeWhitespace(
    `${row.name} ${row.description ?? ""} ${row.category ?? ""} ${row.date_text ?? ""} ${row.search_date_text ?? ""}`,
  );
  return REJECT_PATTERNS.some((pattern) => pattern.test(text));
}

function extractPurchaseResponse(html) {
  const gxStateMatch = html.match(/name=["']GXState["'][^>]*value=["']([^"']+)["']/i);
  if (gxStateMatch?.[1]) {
    try {
      const state = JSON.parse(gxStateMatch[1]);
      const purchaseKey = Object.keys(state).find((key) => key.endsWith("vPURCHASEOPTIONSRESPONSE"));
      if (purchaseKey && typeof state[purchaseKey] === "object") {
        return state[purchaseKey];
      }
    } catch {
      // fall through
    }
  }

  const marker = 'vPURCHASEOPTIONSRESPONSE":';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  let i = idx + marker.length;
  while (i < html.length && html[i] === " ") i += 1;
  if (html[i] !== "{") return null;

  let depth = 0;
  let end = i;
  for (let j = i; j < html.length; j += 1) {
    if (html[j] === "{") depth += 1;
    else if (html[j] === "}") depth -= 1;
    if (depth === 0) {
      end = j + 1;
      break;
    }
  }

  try {
    return JSON.parse(html.slice(i, end));
  } catch {
    return null;
  }
}

function extractScheduleMeta(html, contextText) {
  const purchaseData = extractPurchaseResponse(html);
  const evt = purchaseData?.Evt;
  const dates = Array.isArray(evt?.Dates) ? evt.Dates : [];
  const normalizedContext = normalizeWhitespace(contextText);
  const isOpenEnded =
    /\bcualquier\s+d[ií]a\b/i.test(normalizedContext) ||
    /\bcualquier\s+horario\b/i.test(normalizedContext) ||
    /\b(?:puede\s+ser\s+)?utilizad[oa]\s+en\s+cualquier\s+d[ií]a\b/i.test(normalizedContext) ||
    /\btodo\s+el\s+a[nñ]o\b/i.test(normalizedContext) ||
    /\btodos\s+los\s+d[ií]as\b/i.test(normalizedContext);

  const validDates = dates
    .map((date) => ({
      dateIso: typeof date?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.date) ? date.date : null,
      soldOut: date?.soldOut === true,
      times: Array.isArray(date?.Times) ? date.Times : [],
    }))
    .filter((date) => date.dateIso !== null);

  if (validDates.length === 0) {
    return {
      dateIso: null,
      fallbackDateIso: null,
      startTime: null,
      isRecurringHint: isOpenEnded,
      scheduleCount: 0,
    };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const futureDates = validDates.filter((date) => date.dateIso >= todayIso);
  const primaryDate = isOpenEnded
    ? null
    : futureDates.find((date) => !date.soldOut) ?? futureDates[0] ?? validDates[0] ?? null;
  const fallbackDate = validDates[0] ?? null;

  let startTime = null;
  if (primaryDate) {
    const firstTime = primaryDate.times.find((time) => time?.soldOut !== true) ?? primaryDate.times[0];
    const caption = typeof firstTime?.caption === "string" ? firstTime.caption : "";
    const match = caption.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      startTime = `${match[1].padStart(2, "0")}:${match[2]}:00`;
    }
  }

  return {
    dateIso: primaryDate?.dateIso ?? null,
    fallbackDateIso: fallbackDate?.dateIso ?? null,
    startTime,
    isRecurringHint: isOpenEnded || validDates.length > 1,
    scheduleCount: validDates.length,
  };
}

try {
  const todayIso = new Date().toISOString().slice(0, 10);
  const rows = await sql`
    select e.id,
           e.name,
           e.date,
           e.start_time,
           e.event_type,
           e.is_recurring,
           e.description,
           es.source,
           re.source_url,
           re.raw_data->>'category' as category,
           re.raw_data->>'dateText' as date_text,
           re.raw_data->>'searchDateText' as search_date_text
    from events e
    join event_sources es on es.event_id = e.id
    join raw_events re on re.id = es.raw_event_id
    where e.status = 'active'
      and (
        e.name = any(${FOCUS_NAMES})
        or (es.source = 'redtickets' and e.date = ${todayIso} and e.start_time is null)
      )
    order by e.name
  `;

  let rejected = 0;
  let updated = 0;

  for (const row of rows) {
    const isFocusName = FOCUS_NAMES.includes(row.name);

    if (shouldReject(row)) {
      await sql`
        update events
        set status = 'past', updated_at = now()
        where id = ${row.id}
      `;
      rejected += 1;
      console.log(`[reject] ${row.name}`);
      continue;
    }

    const updates = {};
    const mappedType = mapSourceCategory(row.category);
    if (mappedType && mappedType !== row.event_type) {
      updates.event_type = mappedType;
    }

    if (row.source === "redtickets") {
      const res = await fetch(row.source_url, {
        headers: {
          "user-agent": "Mozilla/5.0",
          accept: "text/html,application/xhtml+xml",
        },
      });

      if (res.ok) {
        const html = await res.text();
        const schedule = extractScheduleMeta(
          html,
          `${row.name} ${row.description ?? ""} ${row.date_text ?? ""} ${row.search_date_text ?? ""}`,
        );

        if (schedule.dateIso && schedule.dateIso !== String(row.date).slice(0, 10)) {
          updates.date = schedule.dateIso;
        } else if (
          !schedule.dateIso &&
          schedule.fallbackDateIso &&
          (String(row.date).slice(0, 10) === todayIso || isFocusName)
        ) {
          updates.date = schedule.fallbackDateIso;
        }

        if (schedule.startTime && !row.start_time) {
          updates.start_time = schedule.startTime;
        }

        if (schedule.isRecurringHint && row.is_recurring !== true) {
          updates.is_recurring = true;
        }
      }
    }

    const entries = Object.entries(updates);
    if (entries.length === 0) continue;

    const setFragments = [];
    const values = [row.id];
    let index = 2;
    for (const [column, value] of entries) {
      setFragments.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    }
    setFragments.push(`updated_at = now()`);

    await sql.unsafe(`update events set ${setFragments.join(", ")} where id = $1`, values);
    updated += 1;
    console.log(`[update] ${row.name} -> ${entries.map(([key, value]) => `${key}=${value}`).join(", ")}`);
  }

  console.log(`\nResumen: rechazados=${rejected}, actualizados=${updated}`);
} finally {
  await sql.end();
}
