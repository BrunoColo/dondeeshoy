import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const dates = ['2026-04-10', '2026-04-11', '2026-04-12'];

const query = `
WITH ranked AS (
  SELECT
    e.id,
    e.name,
    e.date,
    e.start_time,
    e.venue_name,
    e.event_type,
    e.is_recurring,
    e.department,
    e.city,
    e.price_min,
    e.price_max,
    e.is_free,
    (
      COALESCE(e.confidence_score, 0) * 0.6
      + (LOG(COALESCE(e.view_count, 0) + 1) / 5.0) * 0.4
    ) AS ranking_score,
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(e.name, '')), '\\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b', ' ', 'gi'),
            '\\b\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?\\b|\\b\\d{4}\\b',
            ' ',
            'g'
          ),
          '\\b\\d{1,2}:\\d{2}\\b',
          ' ',
          'g'
        ),
        '\\s+',
        ' ',
        'g'
      )
    ) AS norm_series,
    trim(lower(coalesce(e.venue_name, ''))) AS norm_venue,
    (
      SELECT COUNT(*)
      FROM events e2
      WHERE
        e2.status = 'active'
        AND e2.date >= (e.date - INTERVAL '45 days')::date
        AND e2.date <= (e.date + INTERVAL '45 days')::date
        AND trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(coalesce(e2.name, '')), '\\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b', ' ', 'gi'),
                '\\b\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?\\b|\\b\\d{4}\\b',
                ' ',
                'g'
              ),
              '\\b\\d{1,2}:\\d{2}\\b',
              ' ',
              'g'
            ),
            '\\s+',
            ' ',
            'g'
          )
        ) = trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(coalesce(e.name, '')), '\\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b', ' ', 'gi'),
                '\\b\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?\\b|\\b\\d{4}\\b',
                ' ',
                'g'
              ),
              '\\b\\d{1,2}:\\d{2}\\b',
              ' ',
              'g'
            ),
            '\\s+',
            ' ',
            'g'
          )
        )
        AND lower(trim(coalesce(e2.venue_name, ''))) = lower(trim(coalesce(e.venue_name, '')))
    ) AS same_series_window_count,
    (
      SELECT COUNT(*)
      FROM events e3
      WHERE
        e3.status = 'active'
        AND date_trunc('month', e3.date::timestamp) = date_trunc('month', e.date::timestamp)
        AND trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(coalesce(e3.name, '')), '\\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b', ' ', 'gi'),
                '\\b\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?\\b|\\b\\d{4}\\b',
                ' ',
                'g'
              ),
              '\\b\\d{1,2}:\\d{2}\\b',
              ' ',
              'g'
            ),
            '\\s+',
            ' ',
            'g'
          )
        ) = trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(coalesce(e.name, '')), '\\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b', ' ', 'gi'),
                '\\b\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?\\b|\\b\\d{4}\\b',
                ' ',
                'g'
              ),
              '\\b\\d{1,2}:\\d{2}\\b',
              ' ',
              'g'
            ),
            '\\s+',
            ' ',
            'g'
          )
        )
        AND lower(trim(coalesce(e3.venue_name, ''))) = lower(trim(coalesce(e.venue_name, '')))
    ) AS same_series_month_count
  FROM events e
  WHERE e.status = 'active' AND e.date = $1
),
ordered AS (
  SELECT
    r.*,
    row_number() OVER (
      PARTITION BY r.date, r.event_type
      ORDER BY r.same_series_window_count ASC, r.ranking_score DESC, r.start_time ASC NULLS LAST, r.name ASC, r.id ASC
    ) AS rn_type,
    row_number() OVER (
      PARTITION BY r.date,
      CASE
        WHEN r.norm_series = '' OR r.norm_venue = '' THEN r.id::text
        ELSE r.norm_series || '::' || r.norm_venue
      END
      ORDER BY r.same_series_window_count ASC, r.ranking_score DESC, r.start_time ASC NULLS LAST, r.name ASC, r.id ASC
    ) AS rn_series_venue,
    row_number() OVER (
      PARTITION BY r.date,
      CASE
        WHEN r.norm_venue = '' THEN r.id::text
        ELSE r.norm_venue
      END
      ORDER BY r.same_series_window_count ASC, r.ranking_score DESC, r.start_time ASC NULLS LAST, r.name ASC, r.id ASC
    ) AS rn_venue
  FROM ranked r
)
SELECT
  o.id,
  o.event_type,
  o.name,
  o.start_time,
  o.venue_name,
  o.department,
  o.city,
  o.is_recurring,
  o.price_min,
  o.price_max,
  o.is_free,
  o.rn_type,
  o.rn_series_venue,
  o.rn_venue,
  o.same_series_window_count,
  o.same_series_month_count
FROM ordered o
ORDER BY
  CASE WHEN o.is_recurring THEN 1 ELSE 0 END,
  CASE WHEN o.event_type = 'otro' THEN 1 ELSE 0 END,
  o.rn_type,
  o.rn_series_venue,
  o.rn_venue,
  o.same_series_window_count ASC,
  o.ranking_score DESC,
  o.start_time ASC NULLS LAST,
  o.name ASC,
  o.id ASC
LIMIT 12;
`;

async function run() {
  const client = await pool.connect();
  try {
    for (const d of dates) {
      const res = await client.query(query, [d]);
      console.log(`\n=== ${d} top ${res.rows.length} ===`);
      res.rows.forEach((r, idx) => {
        const price = r.is_free ? 'GRATIS' : (r.price_min ?? r.price_max ?? 's/p');
        console.log(`${String(idx + 1).padStart(2, '0')}. [${r.event_type}] ${r.name} | ${r.venue_name} | ${r.start_time ?? 's/h'} | rep45=${r.same_series_window_count} repMes=${r.same_series_month_count} | ${price}`);
      });
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
