import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function normalizeSpanish(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeWhitespace(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

const REJECT_PATTERNS = [
  /\bcancha(s)?\s+(de\s+)?(f[uú]tbol|tenis|p[aá]del|basketball|basquet)\b/i,
  /\balquiler\s+de\s+(cancha|sal[oó]n|espacio|local|equipo)\b/i,
  /\bturnos?\s+(disponibles?|abiertos?|online)\b/i,
  /\breserv[aá]\s+tu\s+(cancha|turno|lugar|espacio)\b/i,
  /\bgimnasio\b.*\b(abierto|horario|mensual)\b/i,
  /\bmembres[ií]as?\b/i,
  /\bsocio(s)?\b/i,
  /\bafiliad[oá]\b/i,
  /\binscripci[oá]n\s+(anual|mensual)\b/i,
  /\bcuota\s+(mensual|anual)\b/i,
  /\brenovaci[oá]n\s+(de\s+)?(membres|socio)\b/i,
  /\bclub\s+de\s+(socios|members)\b/i,
  /\bpacote\s+(mensual|familiar|socio)\b/i,
  /\bplan\s+mensual\b/i,
  /\babonos?\s+mensual(es)?\b/i,
  /\b(?:pase|abono|plan|membres[ií]a|escuela|suscripci[oó]n)\s+anual\b/i,
  /\bescuela\s+anual\b/i,
  /\bpiscina\b.*\b(abierta|horario|temporada)\b/i,
  /\bse\s+busca\b.*\b(personal|empleado|mozo|cocinero)\b/i,
  /\bcontratamos\b/i,
  /\benviar?\s+cv\b/i,
  /\benv[ií]os?\s+(gratis|gratuito|a\s+domicilio|express)\b/i,
  /\benv[ií]os?\s+a\s+todo\s+el\s+pa[ií]s\b/i,
  /\bdescuento\s+\d+%/i,
  /\bpromoci[oó]n\s+(especial|exclusiva|del\s+d[ií]a)\b/i,
  /\bsuscrib[ií]te\b/i,
  /\bhac[eé]\s+tu\s+donaci[oó]n\b/i,
  /^\s*colabor[aá]\s+con\s+/i,
  /\bclases?\s+(regulares?|permanentes?|semanales?)\b/i,
  /\btodos?\s+los\s+talleres?\s+de\s+verano\b/i,
  /\bsolo\s+asist[íi]\s+en\s+el\s+d[ií]a\s+y\s+horario\s+de\s+la\s+actividad\b/i,
  /\bevento\s+de\s+prueba\b/i,
  /\btest\s+event\b/i,
  /\b(almuerzo|cena|desayuno)\s+(buffet|romántic[oa]|para\s+\d+\s+personas?)\b/i,
  /\bbuffet\s+para\s+\d+\s+personas?\b/i,
  /\bmen[uú]\s+para\s+\d+\s+personas?\b/i,
  /\bcelebraci[oó]n\s+de\s+(15|quince)\s+a[nñ]os?\b/i,
  /\bquincea[nñ]era\b/i,
  /\bx\s+(?:the\s+)?(?:la\s+planta|music\s+box|antel\s+arena|sala\s+zitarrosa)\b.*\b(edici[oó]n\s+especial|collab|colaboraci[oó]n)\b/i,
  /\bvoucher\s+de\s+(experiencia|regalo|cena|almuerzo)\b/i,
  /\btarjeta\s+de\s+regalo\b/i,
  /\bexperiencia\s+para\s+\d+\s+personas?\b/i,
  /\bregalo\s+para\s+(dos|2|pareja|ella|[eé]l)\b/i,
];

function rejectReason(text) {
  const normalized = normalizeWhitespace(text);
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(normalized)) {
      return pattern.source;
    }
  }
  return null;
}

function parseRecurrenceInfo(text) {
  const sourceText = normalizeWhitespace(text ?? '');
  if (!sourceText) {
    return { isRecurring: false, confidence: 'none', extraSchedules: 0, detectedBy: 'none' };
  }

  const normalized = normalizeSpanish(sourceText);
  const extraSchedules = Number.parseInt(normalized.match(/&\s*(\d+)\s+mas/)?.[1] ?? '0', 10) || 0;
  const explicitCalendarDate = /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i.test(normalized);

  const yearRound = /\btodo\s+el\s+a[nñ]o\b|\bdurante\s+todo\s+el\s+a[nñ]o\b|\btodos\s+los\s+d[ií]as\s+del\s+a[nñ]o\b|\babierto\s+todo\s+el\s+a[nñ]o\b|\bprevi[ao]\s+coordinaci[oó]n\b|\bcualquier\s+d[ií]a\b|\bcualquier\s+horario\b|\b(?:puede\s+ser\s+)?utilizad[oa]\s+en\s+cualquier\s+d[ií]a\b/i.test(normalized);
  const daily = /\btodos\s+los\s+d[ií]as\b|\blunes\s+a\s+domingo\b|\blunes\s+a\s+domingos\b|\bde\s+lunes\s+a\s+domingo\b|\bde\s+lunes\s+a\s+domingos\b/i.test(normalized);
  const weekend = /\btodos\s+los\s+fines?\s*de?\s*semana\b|\bcada\s+fin\s*de\s*semana\b|\bs[aá]bados?\s+y\s+domingos?\b|\bs[aá]b\.?\s*y\s*dom\.?\b|\bviernes\s+a\s+domingos?\b|\btodos\s+los\s+viernes\s+a\s+domingos?\b/i.test(normalized);
  const dayContext = /\btodos?\s+los?\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b|\bcada\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b|\b(?:de\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\s+a\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b/i.test(normalized);
  const hasRecurringListContext = /\|/.test(normalized) || /\by\b/.test(normalized) || /&\s*\d+\s+mas/.test(normalized) || /todos?\s+los/.test(normalized) || /cada\s+/.test(normalized);
  const weekdayTokens = normalized.match(/\b(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b/g) ?? [];

  if (yearRound) return { isRecurring: true, confidence: 'high', extraSchedules, detectedBy: 'year-round' };
  if (daily) return { isRecurring: true, confidence: 'high', extraSchedules, detectedBy: 'daily' };
  if (weekend) return { isRecurring: true, confidence: 'high', extraSchedules, detectedBy: 'weekend' };
  if (dayContext) return { isRecurring: true, confidence: 'high', extraSchedules, detectedBy: 'day-context' };
  if (weekdayTokens.length >= 2 && !explicitCalendarDate && hasRecurringListContext) {
    return { isRecurring: true, confidence: 'medium', extraSchedules, detectedBy: 'weekday-list' };
  }
  if (extraSchedules >= 3 && !explicitCalendarDate) {
    return { isRecurring: true, confidence: 'medium', extraSchedules, detectedBy: 'extraSchedules>=3' };
  }

  return { isRecurring: false, confidence: 'none', extraSchedules, detectedBy: 'none' };
}

function baseSourceId(sourceId = '') {
  return sourceId.replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

async function main() {
  const client = await pool.connect();
  try {
    const rows = await client.query(`
      SELECT
        id,
        source,
        source_id,
        raw_data->>'title' AS title,
        raw_data->>'dateIso' AS date_iso,
        raw_data->>'dateText' AS date_text,
        raw_data->>'searchDateText' AS search_date_text,
        raw_data->>'venueAddress' AS venue_address,
        raw_data->>'venueText' AS venue_text,
        raw_data->>'venueName' AS venue_name,
        processed,
        scraped_at
      FROM raw_events
      WHERE processed = false
      ORDER BY scraped_at DESC
    `);

    const expanded = rows.rows.filter((row) => /-\d{4}-\d{2}-\d{2}$/.test(row.source_id ?? ''));
    const groups = new Map();

    for (const row of expanded) {
      const key = `${row.source}::${baseSourceId(row.source_id)}::${row.title}`;
      const recurrence = parseRecurrenceInfo(`${row.date_text ?? ''} ${row.search_date_text ?? ''}`);
      const rejection = rejectReason(`${row.title ?? ''} ${row.date_text ?? ''} ${row.search_date_text ?? ''}`);
      const current = groups.get(key) ?? {
        source: row.source,
        baseSourceId: baseSourceId(row.source_id),
        title: row.title,
        count: 0,
        dates: new Set(),
        dateText: row.date_text,
        searchDateText: row.search_date_text,
        recurrenceHits: new Set(),
        recurringRows: 0,
        rejectionHits: new Set(),
      };
      current.count += 1;
      if (row.date_iso) current.dates.add(row.date_iso);
      if (recurrence.isRecurring) {
        current.recurringRows += 1;
        current.recurrenceHits.add(`${recurrence.detectedBy} (${recurrence.extraSchedules})`);
      }
      if (rejection) {
        current.rejectionHits.add(rejection);
      }
      groups.set(key, current);
    }

    const grouped = [...groups.values()]
      .map((group) => ({
        ...group,
        distinctDates: group.dates.size,
        dateList: [...group.dates].sort(),
        recurrenceHits: [...group.recurrenceHits],
        rejectionHits: [...group.rejectionHits],
      }))
      .sort((a, b) => b.distinctDates - a.distinctDates || a.title.localeCompare(b.title));

    const risky = grouped.filter((group) => group.distinctDates > 1 && group.recurringRows > 0);
    const safe = grouped.filter((group) => group.distinctDates > 1 && group.recurringRows === 0);
    const rejectable = grouped.filter((group) => group.distinctDates > 1 && group.rejectionHits.length > 0);

    console.log(`Expanded raw_events pendientes: ${expanded.length}`);
    console.log(`Grupos multi-fecha detectados: ${grouped.length}`);
    console.log(`Grupos que el pipeline marcaría como recurrentes: ${risky.length}`);
    console.log(`Grupos multi-fecha que NO parecen recurrentes: ${safe.length}`);
    console.log(`Grupos multi-fecha que caerían en reject-patterns: ${rejectable.length}`);

    if (risky.length > 0) {
      console.log('\n=== RIESGO DE MERGE POR RECURRENCIA ===');
      for (const group of risky.slice(0, 20)) {
        console.log(`\n[${group.source}] ${group.title}`);
        console.log(`  baseSourceId: ${group.baseSourceId}`);
        console.log(`  fechas (${group.distinctDates}): ${group.dateList.join(', ')}`);
        console.log(`  dateText: ${group.dateText}`);
        if (group.searchDateText) console.log(`  searchDateText: ${group.searchDateText}`);
        console.log(`  detectado por: ${group.recurrenceHits.join(', ')}`);
      }
    }

    if (safe.length > 0) {
      console.log('\n=== MULTI-FECHA SIN RIESGO APARENTE DE RECURRENCIA ===');
      for (const group of safe.slice(0, 10)) {
        console.log(`\n[${group.source}] ${group.title}`);
        console.log(`  baseSourceId: ${group.baseSourceId}`);
        console.log(`  fechas (${group.distinctDates}): ${group.dateList.join(', ')}`);
        console.log(`  dateText: ${group.dateText}`);
      }
    }

    if (rejectable.length > 0) {
      console.log('\n=== POSIBLE DESCARTE POR REJECT-PATTERN ===');
      for (const group of rejectable.slice(0, 10)) {
        console.log(`\n[${group.source}] ${group.title}`);
        console.log(`  fechas (${group.distinctDates}): ${group.dateList.join(', ')}`);
        console.log(`  matches: ${group.rejectionHits.join(', ')}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
