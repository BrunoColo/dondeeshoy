/**
 * Reclassify existing "otro" events using the improved heuristics.
 * Also fixes dates for events whose title contains DD/MM/YY format.
 * 
 * Usage: node scripts/reclassify-otros.mjs [--dry-run]
 */
import 'dotenv/config';
import postgres from 'postgres';

const DRY_RUN = process.argv.includes('--dry-run');
const sql = postgres(process.env.DATABASE_URL);

/* ─── Classification rules (mirrors classifier.ts) ─── */
const EVENT_TYPE_RULES = [
  { type: "festival", regex: /\bfestival(es)?\b|\bfest\b|\bcarnaval\b|\bfiesta\s+popular\b|\bencuentro\s+de\s+bandas\b|\bline\s*up\b/i },
  { type: "concierto", regex: /\bconcierto\b|\blive\b|\bgira\b|\btour\b|\bbanda\s+en\s+vivo\b|\bpresenta\s+su\s+(disco|album)\b|\bm[uú]sica\s+en\s+vivo\b|\broda\s+de\s+samba\b|\bsamba\b|\bcandombe\b|\brueda\s+de\s+candombe\b/i },
  { type: "recital", regex: /\brecital\b|\bset\s+ac[uú]stico\b|\bac[uú]stico\b/i },
  { type: "teatro", regex: /\bteatro\b|\bobra\b|\bescena\b|\bdram[aá]tic[oa]\b|\bcomedia\b|\bdramaturgia\b|\bmon[oó]logo\b|\belenco\b|\bmusical\b|\btragedia\b|\bthe\s+crucible\b|\bunipersonal\b|\bimprovisaci\w*\b|\bstand\s*up\b|\bhumorist\w*\b|\bhumor\b|\bcircuito\s+teatral\b/i },
  { type: "cultural", regex: /\bmuseo\b|\bexposici[oó]n\b|\bgaler[ií]a\b|\bpatrimonio\b|\bcultural\b|\bart[eí]stic[oa]\b|\bcine\b|\bpel[ií]cula\b|\bfilm\b|\bdocumental\b|\bproyecci[oó]n\b|\bcortometraje\b|\baudiovisual\b|\bliteratura\b|\bpoes[ií]a\b|\btablado\b|\bvisitas?\s+guiadas?\b|\bmisterios?\s+del?\b|\bpeatonal\s+tours?\b|\bvisit[aá]s?\s+(?:a\s+)?(?:la|el|al)\b|\breserva\s+(?:natural|de\s+fauna)\b|\bconocé\s+el\b/i },
  { type: "deportivo", regex: /\bpartido\b|\btorneo\b|\bcarrera\b|\bmarat[oó]n\b|\bdeport\w*\b|\bf[uú]tbol\b|\bbasket\b|\bbasquet\b|\bbox\w*\b|\bboxeo\b|\bvelada\s+de\s+box\w*\b|\bmma\b|\bufc\b|\bkick\s*boxing\b|\bcombate\b|\bpelea\b|\brugby\b|\bvoley\b|\bhandball\b|\bdesaf[ií]o\b|\breto\b|\btraves[ií]a\b|\btriatl[oó]n\b|\btrail\b|\bmtb\b|\bgravel\b|\bnado\b|\bnataci[oó]n\b|\bciclismo\b|\bxcm\b|\bestadio\b|\b\d+\s*k(?:m)?\b|\bscott\s*marathon\b|\bvikingo\b|\ba\s*nado\b|\bhip[oó]dromo\b|\bmaro[nñ]as\b|\btrekking\b|\bsenderismo\b|\bpesca\b|\bgrutas?\s+extremas?\b/i },
  { type: "gastronomico", regex: /\bgastron[oó]mic\w*\b|\bfood\b|\bcata\b|\bdegustaci[oó]n\b|\bcerveza\b|\bvino\b|\bparrilla\b|\bmen[uú]\b|\bchef\b|\bcocina\b|\bcomida\b|\bwine\s*lodge\b|\bchacra\s+tramonto\b/i },
  { type: "familiar", regex: /\bfamiliar\b|\binfantil\b|\bniñ\w*\b|\bkids\b|\bapto para todo p[uú]blico\b|\ben familia\b|\bvacaciones\s+de\s+julio\b|\bpaintball\b|\btrampoline\b|\btrampol[ií]n\b|\bparque\s+(?:de\s+)?(?:aventura|destrezas?)\b|\baqua\s*park\b|\baquaman[ií]a\b|\baquapark\b|\bbungee\b|\bparque\s+acu[aá]tico\b|\bgravity\b|\bdino\s*aventura\b|\bcirco\b|\bwet\s*(?:&|y)\s*wild\b|\bnimbus\b|\bparque\s+biomas?\b|\bla\s+cuerda\b|\bfutvolt\b|\btactical\s+games?\b|\bludus\b/i },
  { type: "feria", regex: /\bferia\b|\bmercado\b|\bexpo\b|\bartesan\w*\b|\bemprendedor\w*\b|\bstands?\b|\bferiante\b/i },
  { type: "taller", regex: /\btalleres?\b|\bworkshop\b|\bcharla\b|\bconferencia\b|\bseminario\b|\bcurso\b|\bmasterclass\b|\bcapacitaci[oó]n\b|\britual\b|\bsanaci[oó]n\b|\bmeditaci[oó]n\b|\bcongreso\b|\bxperience\b|\bdisertaci[oó]n\b|\bescuela\s+de\b/i },
  { type: "fiesta", regex: /\bfiesta\b|\bparty\b|\brancho\b|\bpariseo\b|\bdance\b|\bdj\b|\belectro\b|\bboliche\b|\bbaile\b|\bpista\s*de\s*baile\b|\bnightclub\b|\bopenbar\b|\bopen\s*bar\b|\bfomo\b|\bcloud\s*7\b|\bcloud\s*sessions?\b|\bprevia\s+(?:de\s+)?(?:la\s+)?(?:fiesta|party|noche)\b|\bafter\s*party\b|\bperreo\b|\breggaeton\b|\breggeaton\b|\breguet[oó]n\b|\bnoche\s+cubana\b|\bla\s+previa\b|\bdanzeria\b|\b2\s+pistas\b|\bacceso\s+\d+\s+pistas?\b|\bcumbia\s+vieja\b|\bsin\s+censura\b|\bsilent\s+(?:disco|party|luna)\b|\blokeito\b|\bsunset\s+experience\b/i },
  { type: "club", regex: /\bclub\b|\bclvb\b|\bsessions?\b|\bafter\b/i },
  { type: "bar", regex: /\bbar\b|\bpub\b|\bcervecer[ií]a\b|\bhappy\s*hour\b|\bcoctel\w*\b/i },
];

const KNOWN_THEATER_VENUES = [
  /el\s+tinglado/i, /el\s+galp[oó]n/i, /sala\s+zavala\s+muniz/i,
  /auditorio\s+vaz\s+ferreira/i, /teatro\s+sol[ií]s/i, /teatro\s+el\s+picadero/i,
  /teatro\s+de\s+la\s+ciudad/i, /espacio\s+palermo/i, /la\s+cretina/i,
  /asociaci[oó]n\s+cristiana\s+de\s+j[oó]venes/i, /castillo\s+pittamiglio/i,
  /la\s+colmena/i, /teatro\s+florencio\s+sanchez/i, /teatro\s+gran\s+retton/i,
  /sala\s+del\s+museo/i, /peña\s+blanca/i, /sala\s+camac[uú][aá]/i,
  /la\s+incorrecta/i, /casatrompo/i, /\bacj\s+montevideo/i,
];

const KNOWN_CONCERT_VENUES = [
  /medio\s+y\s+medio/i, /magnolio\s+sala/i, /pueblo\s+narakan/i,
  /sociedad\s+urbana\s+villa\s+dolores/i, /soto\s+bosque/i,
  /la\s+trastienda/i, /sala\s+zitarrosa/i, /antel\s+arena/i,
  /velódromo/i, /teatro\s+de\s+verano/i,
];

const KNOWN_PARTY_VENUES = [
  /viejo\s+barreiro/i, /\bsoho\b/i, /\bnox\s*cl[uv]b/i,
  /\bplaza\s+mateo\b/i, /\binmigrantes\s+mvd/i, /\bviejar2/i, /\blokeito/i,
];

const KNOWN_CULTURAL_VENUES = [
  /tablado\s+parque\s+rod[oó]/i, /tablado\s+primero\s+de\s+mayo/i,
  /tablado\s+1ero\s+de\s+mayo/i, /tablado\s+monumental/i,
  /palacio\s+salvo/i, /plaza\s+de\s+toros/i,
];

function classifyByHeuristics(name, description, venueName, startTime) {
  const text = `${name} ${description || ''} ${venueName || ''}`;

  const matchedTypes = EVENT_TYPE_RULES
    .filter(rule => rule.regex.test(text))
    .map(rule => rule.type);

  const venue = venueName || '';
  const venueIsKnownTheater = KNOWN_THEATER_VENUES.some(r => r.test(venue));
  const venueIsKnownConcert = KNOWN_CONCERT_VENUES.some(r => r.test(venue));
  const venueIsKnownParty = KNOWN_PARTY_VENUES.some(r => r.test(venue));
  const venueIsKnownCultural = KNOWN_CULTURAL_VENUES.some(r => r.test(venue));

  let eventType;
  if (matchedTypes[0]) {
    eventType = matchedTypes[0];
  } else if (venue.toLowerCase().includes('teatro') || venueIsKnownTheater) {
    eventType = 'teatro';
  } else if (venueIsKnownParty) {
    eventType = 'fiesta';
  } else if (venueIsKnownConcert) {
    eventType = 'concierto';
  } else if (venueIsKnownCultural || /\btablado\b/i.test(name)) {
    eventType = 'cultural';
  } else {
    eventType = 'otro';
  }

  // Time-based reclassification: late-night generic events → fiesta
  if (startTime && ['club', 'otro', 'bar'].includes(eventType)) {
    const hourMatch = startTime.match(/^(\d{1,2}):/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1], 10);
      if (hour >= 22 || hour === 0) {
        eventType = 'fiesta';
      }
    }
  }

  return { eventType, matchedTypes };
}

/** Parse DD/MM/YY date from event title */
function parseDateFromTitle(title) {
  // Match DD/MM/YY (2-digit year)
  const shortMatch = title.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})(?!\d)/);
  if (shortMatch) {
    const day = parseInt(shortMatch[1], 10);
    const month = parseInt(shortMatch[2], 10);
    const year = 2000 + parseInt(shortMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  // Match DD/MM/YYYY (4-digit year)
  const fullMatch = title.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (fullMatch) {
    const day = parseInt(fullMatch[1], 10);
    const month = parseInt(fullMatch[2], 10);
    const year = parseInt(fullMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN MODE - no changes will be made\n' : '🔧 LIVE MODE - updating database\n');

  // 1. Reclassify "otro" events
  const otroEvents = await sql`
    SELECT id, name, description, venue_name, start_time, event_type
    FROM events 
    WHERE event_type = 'otro' AND status = 'active'
  `;

  console.log(`Found ${otroEvents.length} "otro" events to reclassify\n`);

  const reclassified = {};
  let stillOtro = 0;

  for (const event of otroEvents) {
    const result = classifyByHeuristics(event.name, event.description, event.venue_name, event.start_time);
    
    if (result.eventType !== 'otro') {
      console.log(`  ✅ "${event.name}" @ ${event.venue_name} → ${result.eventType}`);
      reclassified[result.eventType] = (reclassified[result.eventType] || 0) + 1;
      
      if (!DRY_RUN) {
        await sql`UPDATE events SET event_type = ${result.eventType}, updated_at = now() WHERE id = ${event.id}`;
      }
    } else {
      stillOtro++;
      console.log(`  ❓ "${event.name}" @ ${event.venue_name} → still otro`);
    }
  }

  console.log('\n=== RECLASSIFICATION SUMMARY ===');
  const totalReclassified = Object.values(reclassified).reduce((a, b) => a + b, 0);
  console.log(`Total reclassified: ${totalReclassified} / ${otroEvents.length}`);
  console.log(`Still otro: ${stillOtro}`);
  for (const [type, count] of Object.entries(reclassified)) {
    if (count > 0) console.log(`  → ${type}: ${count}`);
  }

  // 2. Fix dates from titles (DD/MM/YY format)
  console.log('\n=== DATE FIXES ===');
  const eventsWithDateInTitle = await sql`
    SELECT id, name, date 
    FROM events 
    WHERE status = 'active' AND (name ~ '\\d{1,2}/\\d{1,2}/\\d{2,4}')
  `;

  let datesFixed = 0;
  for (const event of eventsWithDateInTitle) {
    const parsedDate = parseDateFromTitle(event.name);
    if (parsedDate && parsedDate !== event.date) {
      console.log(`  📅 "${event.name}": ${event.date} → ${parsedDate}`);
      datesFixed++;
      if (!DRY_RUN) {
        await sql`UPDATE events SET date = ${parsedDate}, updated_at = now() WHERE id = ${event.id}`;
      }
    }
  }
  console.log(`Fixed ${datesFixed} event dates`);

  // 3. Final stats
  if (!DRY_RUN) {
    console.log('\n=== FINAL TYPE DISTRIBUTION ===');
    const types = await sql`SELECT event_type, count(*)::int as cnt FROM events WHERE status = 'active' GROUP BY event_type ORDER BY cnt DESC`;
    for (const t of types) console.log(`  ${t.event_type}: ${t.cnt}`);
  }

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
