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

function baseSourceId(sourceId = '') {
  return sourceId.replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

function hasExplicitCalendarDate(text = '') {
  const normalized = normalizeSpanish(text);
  return /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i.test(normalized);
}

function parseRecurrenceInfo(text) {
  const sourceText = normalizeWhitespace(text ?? '');
  if (!sourceText) {
    return { isRecurring: false, confidence: 'none', explicitDate: false, extraSchedules: 0, detectedBy: 'none' };
  }

  const normalized = normalizeSpanish(sourceText);
  const explicitDate = hasExplicitCalendarDate(sourceText);
  const extraSchedules = Number.parseInt(normalized.match(/&\s*(\d+)\s+mas/)?.[1] ?? '0', 10) || 0;

  const yearRound = /\btodo\s+el\s+a[nñ]o\b|\bdurante\s+todo\s+el\s+a[nñ]o\b|\btodos\s+los\s+d[ií]as\s+del\s+a[nñ]o\b|\babierto\s+todo\s+el\s+a[nñ]o\b|\bprevi[ao]\s+coordinaci[oó]n\b|\bcualquier\s+d[ií]a\b|\bcualquier\s+horario\b|\b(?:puede\s+ser\s+)?utilizad[oa]\s+en\s+cualquier\s+d[ií]a\b/i.test(normalized);
  const daily = /\btodos\s+los\s+d[ií]as\b|\blunes\s+a\s+domingo\b|\blunes\s+a\s+domingos\b|\bde\s+lunes\s+a\s+domingo\b|\bde\s+lunes\s+a\s+domingos\b/i.test(normalized);
  const weekend = /\btodos\s+los\s+fines?\s*de?\s*semana\b|\bcada\s+fin\s*de\s*semana\b|\bs[aá]bados?\s+y\s+domingos?\b|\bs[aá]b\.?\s*y\s*dom\.?\b|\bviernes\s+a\s+domingos?\b|\btodos\s+los\s+viernes\s+a\s+domingos?\b/i.test(normalized);
  const dayContext = /\btodos?\s+los?\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b|\bcada\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b|\b(?:de\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\s+a\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b/i.test(normalized);
  const hasRecurringListContext = /\|/.test(normalized) || /\by\b/.test(normalized) || /&\s*\d+\s+mas/.test(normalized) || /todos?\s+los/.test(normalized) || /cada\s+/.test(normalized);
  const weekdayTokens = normalized.match(/\b(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b/g) ?? [];

  if (yearRound) return { isRecurring: true, confidence: 'high', explicitDate, extraSchedules, detectedBy: 'year-round' };
  if (daily) return { isRecurring: true, confidence: 'high', explicitDate, extraSchedules, detectedBy: 'daily' };
  if (weekend) return { isRecurring: true, confidence: 'high', explicitDate, extraSchedules, detectedBy: 'weekend' };
  if (dayContext) return { isRecurring: true, confidence: 'high', explicitDate, extraSchedules, detectedBy: 'day-context' };
  if (weekdayTokens.length >= 2 && !explicitDate && hasRecurringListContext) {
    return { isRecurring: true, confidence: 'medium', explicitDate, extraSchedules, detectedBy: 'weekday-list' };
  }
  if (extraSchedules >= 3 && !explicitDate) {
    return { isRecurring: true, confidence: 'medium', explicitDate, extraSchedules, detectedBy: 'extraSchedules>=3' };
  }

  return { isRecurring: false, confidence: 'none', explicitDate, extraSchedules, detectedBy: 'none' };
}

function shouldTrustRecurringHint(dateText) {
  if (!dateText) return true;
  const recurrence = parseRecurrenceInfo(dateText);
  if (recurrence.isRecurring) return true;
  return !hasExplicitCalendarDate(dateText);
}

function classifyRaw(row) {
  const text = `${row.date_text ?? ''} ${row.search_date_text ?? ''}`;
  const recurrenceFromText = parseRecurrenceInfo(text);
  const recurrence = row.is_recurring_hint === true && shouldTrustRecurringHint(text)
    ? { isRecurring: true, confidence: 'hint', explicitDate: hasExplicitCalendarDate(text), extraSchedules: 0, detectedBy: 'source-hint' }
    : recurrenceFromText;

  const isExpandedMultiDate = /-\d{4}-\d{2}-\d{2}$/.test(row.source_id ?? '');

  let kind = 'single-date';
  if (isExpandedMultiDate) kind = 'multi-date';
  else if (recurrence.isRecurring) kind = 'recurring';

  return { ...recurrence, kind, isExpandedMultiDate };
}

async function main() {
  const client = await pool.connect();
  try {
    const rawRows = await client.query(`
      SELECT
        id,
        source,
        source_id,
        raw_data->>'title' AS title,
        raw_data->>'dateIso' AS date_iso,
        raw_data->>'dateText' AS date_text,
        raw_data->>'searchDateText' AS search_date_text,
        (raw_data->>'isRecurringHint')::boolean AS is_recurring_hint,
        processed,
        scraped_at
      FROM raw_events
      WHERE processed = false
      ORDER BY scraped_at DESC
    `);

    const classified = rawRows.rows.map((row) => ({ ...row, audit: classifyRaw(row) }));

    const single = classified.filter((row) => row.audit.kind === 'single-date');
    const multi = classified.filter((row) => row.audit.kind === 'multi-date');
    const recurring = classified.filter((row) => row.audit.kind === 'recurring');
    const suspiciousMulti = multi.filter((row) => row.audit.isRecurring);

    console.log('=== RAW_EVENTS PENDIENTES ===');
    console.log(`Total pendientes: ${classified.length}`);
    console.log(`Fecha única: ${single.length}`);
    console.log(`Multi-fecha expandido: ${multi.length}`);
    console.log(`Recurrente real: ${recurring.length}`);
    console.log(`Multi-fecha mal marcado como recurrente: ${suspiciousMulti.length}`);

    const multiGroups = new Map();
    for (const row of multi) {
      const key = `${row.source}::${baseSourceId(row.source_id)}::${row.title}`;
      const current = multiGroups.get(key) ?? { title: row.title, source: row.source, baseSourceId: baseSourceId(row.source_id), dates: new Set() };
      if (row.date_iso) current.dates.add(row.date_iso);
      multiGroups.set(key, current);
    }

    const recurringGroups = new Map();
    for (const row of recurring) {
      const key = `${row.source}::${baseSourceId(row.source_id)}::${row.title}`;
      const current = recurringGroups.get(key) ?? {
        title: row.title,
        source: row.source,
        baseSourceId: baseSourceId(row.source_id),
        detectors: new Set(),
        samples: [],
      };
      current.detectors.add(row.audit.detectedBy);
      if (current.samples.length < 3) {
        current.samples.push({
          sourceId: row.source_id,
          dateText: row.date_text,
          searchDateText: row.search_date_text,
        });
      }
      recurringGroups.set(key, current);
    }

    console.log('\n=== RESUMEN DE DEDUPE ESPERADO ===');
    console.log('- Fecha única: se deduplica por fecha + departamento.');
    console.log('- Multi-fecha expandido: también se deduplica por fecha + departamento, así cada fecha queda separada.');
    console.log('- Recurrente real: se deduplica por ciudad y similitud de nombre/venue, ignorando fecha, para mergear la misma cartelera recurrente entre re-scrapes.');

    if (single.length > 0) {
      console.log('\n=== EJEMPLOS FECHA ÚNICA ===');
      for (const row of single.slice(0, 8)) {
        console.log(`\n[${row.source}] ${row.title}`);
        console.log(`  sourceId: ${row.source_id}`);
        console.log(`  dateIso: ${row.date_iso ?? '(sin dateIso)'}`);
        console.log(`  dateText: ${row.date_text ?? '(sin dateText)'}`);
      }
    }

    if (multiGroups.size > 0) {
      console.log('\n=== EJEMPLOS MULTI-FECHA ===');
      for (const group of [...multiGroups.values()].slice(0, 8)) {
        console.log(`\n[${group.source}] ${group.title}`);
        console.log(`  baseSourceId: ${group.baseSourceId}`);
        console.log(`  fechas: ${[...group.dates].sort().join(', ')}`);
      }
    }

    if (recurringGroups.size > 0) {
      console.log('\n=== EJEMPLOS RECURRENTES REALES ===');
      for (const group of [...recurringGroups.values()].slice(0, 8)) {
        console.log(`\n[${group.source}] ${group.title}`);
        console.log(`  baseSourceId: ${group.baseSourceId}`);
        console.log(`  detectado por: ${[...group.detectors].join(', ')}`);
        for (const sample of group.samples) {
          console.log(`  - sourceId: ${sample.sourceId}`);
          console.log(`    dateText: ${sample.dateText ?? '(sin dateText)'}`);
          if (sample.searchDateText) console.log(`    searchDateText: ${sample.searchDateText}`);
        }
      }
    }

    const duplicateRecurring = await client.query(`
      WITH recurring AS (
        SELECT
          lower(regexp_replace(name, '[^a-z0-9]+', ' ', 'gi')) AS norm_name,
          lower(regexp_replace(coalesce(venue_name, ''), '[^a-z0-9]+', ' ', 'gi')) AS norm_venue,
          department,
          count(*)::int AS total
        FROM events
        WHERE status = 'active' AND is_recurring = true
        GROUP BY 1, 2, 3
      )
      SELECT *
      FROM recurring
      WHERE total > 1
      ORDER BY total DESC, norm_name
      LIMIT 20
    `);

    console.log('\n=== DUPLICADOS EN EVENTS RECURRENTES ACTIVOS ===');
    console.log(`Grupos potencialmente duplicados: ${duplicateRecurring.rows.length}`);
    if (duplicateRecurring.rows.length > 0) {
      duplicateRecurring.rows.forEach((row) => {
        console.log(`  ${row.norm_name} | venue=${row.norm_venue || '(sin venue)'} | dept=${row.department} | total=${row.total}`);
      });
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
