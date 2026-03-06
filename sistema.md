# Análisis del Sistema — Scrapers → Eventos Reales

*Última actualización: 2026-02-27. Refleja el estado actual del código en `main`.*

---

## Flujo General

```
[Vercel Cron] 14:00–16:30 UTC diario
      │
      ├─ /api/scrape/redtickets   → RedTicketsScraper
      ├─ /api/scrape/entraste     → EntrasteScraper
      ├─ /api/scrape/cobraticket  → CobraTicketScraper
      ├─ /api/scrape/ticketfacil  → TicketFacilScraper
      ├─ /api/scrape/cartelera    → CarteleraScraper
      ├─ /api/scrape/mvd-eventos  → MvdEventosScraper
      └─ /api/scrape/mientrada    → MiEntradaScraper
                │
                ↓  UPSERT en raw_events (processed=false)
         [raw_events table — JSONB]
                │
17:00 UTC → /api/scrape/process  (maxDuration=300s, drain loop hasta pending=0)
                │
         por cada raw_event:
           normalizeRawEvent()
           shouldRejectEvent()
           geocodeVenue()
           detectDepartment()
           classifyEvent() [± classifyEventWithAi()]
           calculateConfidenceScore()
           findDuplicateEventId()
           createEvent() / mergeEventData()
                │
                ↓
         [events table]
                │
03:00 UTC → mark-past (status='past' donde date < today)
17:30 UTC → reclassify-otros (reintento de clasificación IA para tipo 'otro')
```

---

## 1. Scrapers

### 1.1 BaseScraper

Clase abstracta base. Define el contrato:

- `discoverUrls()` → lista de URLs a scrapear
- `scrapeEvent(url)` → `ScrapedRawEvent | null`
- `saveRawEvent()` → **`protected`** (permite que subclases lo llamen directamente)
- `run()` → itera URLs, aplica rate limit (Upstash Redis, 1 req/s), retry x3 con backoff 400ms×intento, UPSERT en `raw_events` por `(source, source_id)`

**Problema abierto:** El rate limit aplica 1 req/s por fuente pero no hay cap global de tiempo. RedTickets con 800 URLs tarda ~26 min teórico (timeout de Vercel Pro: 300s). El scraper puede quedar con trabajo parcialmente hecho sin error explícito.

**Problema abierto:** El UPSERT resetea `processed=false` y borra `processingError` siempre. Eventos rechazados permanentemente vuelven a la cola en cada ciclo.

---

### 1.2 CobraTicket

**Calidad: Alta.**

**Campos extraídos:** title, description, category, dateText (ISO), startTime, endTime, venueName, venueAddress, city ("Ciudad, Departamento"), latitude, longitude, imageUrl, isFree, prices, ageRestriction, organizer.

**Extracción de datos estructurados:**
- `extractSvelteKitProps` tiene 3 estrategias en cascada:
  1. `<script type="application/json">` — SvelteKit ≥2, sin eval (más común)
  2. `const data = [...]` inline via `new Function()` — versión antigua, fallback
  3. DOM parsing — último recurso, con warn log explícito
- Coordenadas GPS desde `latlng` del payload SvelteKit
- Fecha ISO estricta (`2026-02-19 23:59:00`)
- Campo `city` formateado como "Punta del Este, Maldonado"

**Problemas abiertos:**

1. **Precios desde texto libre.** Los tipos de entrada se cargan client-side desde Firebase y no están en el SSR. Los precios que llegan son los que el organizador menciona en descripción — inconsistente entre eventos.

2. **`isFree` por texto.** Si la descripción no menciona "gratis" pero el evento lo es (precios en Firebase), `isFree=false` con `prices=[]`, lo que puede disparar la heurística `currency="USD"` del normalizador.

---

### 1.3 RedTickets

**Calidad: Alta.** Mayor volumen (~500–800 URLs por ciclo).

**Campos extraídos:** title, description, category, dateText, venueText, venueAddress, imageUrl, prices (GeneXus JSON), latitude, longitude (iframe Google Maps), isFree.

**Lo que funciona bien:**
- Precios desde `vPURCHASEOPTIONSRESPONSE` — datos estructurados, `unitPrice` sin fees
- `isFree` explícito desde `Evt.isFree` del payload GeneXus
- Coordenadas desde iframe Maps embed

**Problemas abiertos:**

1. **Cap de 10 páginas de discovery.** Si hay más de 10 páginas de resultados, eventos válidos quedan fuera.

2. **2 requests por evento** (search page + detail page). Con 800 URLs = 1600 requests totales, supera el timeout de Vercel.

3. **Selector de categoría frágil:** `li > div[style*="border-radius"][style*="height: 10px"]` depende de inline styles específicos. Un cambio de CSS lo rompe silenciosamente.

---

### 1.4 TicketFacil

**Calidad: Media-alta.**

**Campos extraídos:** title, description, dateText (YYYY-MM-DD), startTime, endTime, venueName, venueAddress, imageUrl, prices, isFree.

**Lo que funciona bien:**
- Discovery por REST API de accesofacil, no HTML
- Filtros pre-scraping agresivos (membresías, eventos fuera de Uruguay)
- Precios desde `initPrice` attributes en `/registerToEvent/`
- `isFree` guardado en `rawData.isFreeText`; el normalizador lee tanto `isFree` como `isFreeText` ✅

**Problemas abiertos:**

1. **Sin coordenadas.** Depende de KNOWN_VENUES o Mapbox para todos sus eventos (~200-400/ciclo).

2. **`fetchPricesFromRegisterPage` silencia errores** con `return []`. Fallo HTTP queda sin log.

3. **Sin campo `category`.** Todos sus eventos van a heurísticas de texto en el clasificador.

---

### 1.5 Cartelera

**Calidad: Media.**

**Campos extraídos:** title, genre, duration, description, venueName, venueAddress, imageUrl, prices, cast, dateText, startTime. Un `raw_event` por fecha de función.

**Lo que funciona bien:**
- Multi-fecha: genera un `raw_event` por función individual
- `saveExtra()` eliminado — usa `BaseScraper.saveRawEvent()` directamente ✅
- Conteo de `saved` corregido: acumula `extraSaved` correctamente ✅

**Problemas abiertos:**

1. **Sin coordenadas.**

2. **`_pendingMultiDateEvents` — dependencia de orden implícita.** `run()` inicializa el array antes de llamar a `scrapeEvent()`, correcto, pero es frágil si se refactoriza la clase base.

3. **`parseDateHeading()` asume año actual/siguiente** sin validar si la fecha ya pasó.

4. **Selectores CSS específicos** (`.lista-horarios > li`, `.subheading`, `.hora`). Cambio de diseño los rompe sin error.

---

### 1.6 MVD Eventos

**Calidad: Media.**

**Campos extraídos:** title (con parent event), description, dateText, venueName, venueAddress, category, imageUrl, isFree.

**Lo que funciona bien:**
- Estructura Drupal estable (`field--name-*`)
- Categoría desde campos Drupal
- `extractDates()` ahora busca primero en `article/main/.node__content` — no en `$.text()` completo ✅
- `_MONTHS` muerto eliminado ✅

**Problemas abiertos:**

1. **Sin coordenadas ni precios.** Sitio gubernamental que no expone ninguno.

2. **Discovery no distingue `/actividad/` permanentes** de eventos puntuales. El filtro actual solo excluye `agenda-anteriores`.

3. **`extractSourceId` reemplaza `/` con `--`.** Cambio de URL del sitio genera duplicados.

---

### 1.7 Entraste

**Calidad: Alta** *(reescrito completamente — commit f964615)*.

**Campos extraídos:** title, description, dateText (YYYY-MM-DD desde Unix timestamp), startTime, venueName, venueAddress, latitude, longitude, imageUrl, prices (por tanda), isFree.

**Cómo funciona ahora:**

| Campo | Origen en el HTML | Antes |
|-------|-------------------|-------|
| Fecha/hora | `data-eventstart` (Unix timestamp) | Regex de texto libre |
| Precios | `data-ticket='{"price":"300",...}'` por fila | `extractMoneyValues()` sobre body |
| `isFree` | Todos los tickets con `price=0` | No se detectaba |
| Coordenadas | `const lat = X; const lng = Y` en script inline | No se extraían |
| Venue | `.location-section h3/p` | `<p>Venue: X<br>` con split |
| Descripción | `#event-description` | No se extraía |
| Discovery | Homepage + todas las páginas `/with/<organizador>` | Solo homepage |

**Problemas abiertos:**

1. **Volumen pequeño** (~15-30 eventos). Entraste es una plataforma chica en Uruguay. No hay API pública de listado conocida.

2. **Sin descripción en algunos eventos.** El `#event-description` puede estar vacío si el organizador no la completó.

---

### 1.8 MiEntrada

**Calidad: Media.**

**Campos extraídos:** title, imageUrl, venueName, venueAddress, department, lat, lng (de Google Maps link), dates (array DD/MM/YYYY), aperturaTime, description, prices.

**Lo que funciona bien:**
- Coordenadas desde URL de Google Maps (`maps/search/LAT,LNG`)
- `department` del formato "Venue, Ciudad/Departamento"
- Strips de boilerplate WhatsApp
- El normalizador lee `rawData.lat`/`rawData.lng`, `rawData.dates[]` y `rawData.department` correctamente ✅

**Problemas abiertos:**

1. **`dates[]` es un array de fechas** — el normalizador usa solo el primer elemento. Eventos multi-fecha de MiEntrada generan un único `raw_event` con solo la primera fecha, no uno por fecha como hace Cartelera.

2. **`aperturaTime` no se lee en el normalizador.** El campo existe en `rawData` pero el normalizador lee `rawData.startTime`. La hora de apertura se pierde.

---

## 2. Normalizador

**Estado actual — correcciones aplicadas:**
- Lee `rawData.lat`/`rawData.lng` (MiEntrada) además de `rawData.latitude`/`rawData.longitude` ✅
- Lee `rawData.dates[]` como `dateText` cuando `rawData.dateText` está vacío (MiEntrada) ✅
- Lee `rawData.department` como `scraperCity` (MiEntrada) ✅
- Lee `rawData.isFreeText` además de `rawData.isFree` (TicketFacil) ✅
- Pasa coordenadas a `detectDepartment()` para priorizar GPS sobre texto ✅
- `scheduleText` eliminado de `NormalizedEventInput` — no se persistía ni usaba ✅

### 2.1 Parsing de fechas

4 estrategias en orden: DD/MM/YYYY → DD/MM/YY → YYYY-MM-DD → "N de mes" en español. Si todo falla con `dateText` no vacío, llama a OpenAI GPT-4o-mini.

**Problema abierto: doble parsing nombre+fecha.** El normalizador parsea fecha del `name` Y del `dateText`. Si ambos producen fecha válida, usa la del nombre. Eventos con fechas en el título ("Festival Rock 2025") pueden heredar año incorrecto.

**Problema abierto: `aperturaTime` de MiEntrada.** `rawData.aperturaTime` no se lee — el normalizador lee `rawData.startTime`. La hora de apertura de MiEntrada se pierde silenciosamente.

### 2.2 Detección de moneda

```typescript
const currency = hasUsdHint || (priceMax !== null && priceMax < 50) ? "USD" : "UYU";
```

Heurística `priceMax < 50` puede clasificar como USD un taller comunitario de $30 UYU. Riesgo bajo pero real.

### 2.3 Venue cleaning

`cleanVenueName()` corta en keywords específicos. Nuevos formatos de scrapers pueden pasar nombres sucios sin aviso.

---

## 3. Geocodificador

### 3.1 Flujo

```
1. ¿Coords en normalized.latitude/longitude? → usar directamente (scraper)
2. ¿Venue en KNOWN_VENUES (~133 entries)? → usar coords del lookup
3. ¿NEXT_PUBLIC_MAPBOX_TOKEN? → Mapbox API (bounding box Uruguay)
4. → null
```

**Corrección aplicada:** clave `"espacio cultural"` eliminada de KNOWN_VENUES — era demasiado genérica ✅

### 3.2 Problemas abiertos en KNOWN_VENUES

- Lookup por substring (`text.includes(key)`) puede dar falsos positivos. Ej: "Bar Sala Zitarrosa 2" matchearía "sala zitarrosa".
- Cobertura del interior de Uruguay es parcial.

### 3.3 Token de Mapbox

`NEXT_PUBLIC_MAPBOX_TOKEN` es un token de cliente. Si tiene restricciones de dominio en Mapbox, las llamadas server-side pueden fallar silenciosamente.

---

## 4. Detector de Departamentos

### 4.1 Prioridad

Coordenadas → texto (venue + address + scraperCity) → nombre del evento → default "Montevideo". Correcto.

### 4.2 Bounding boxes con solapamientos

Los bboxes se solapan. El código resuelve verificando Montevideo primero, luego itera en orden. No hay manejo explícito de zonas ambiguas.

**Caso conocido:** banda entre lat -34.895 y -34.950 que cae fuera del bbox de Montevideo pero dentro del de Canelones. Puntos de Ciudad de la Costa quedan como Canelones (correcto); puntos al límite pueden quedar mal.

### 4.3 Inconsistencia PROBLEMATIC_KEYWORDS / UNAMBIGUOUS

`"artigas"` aparece en ambos sets. La lógica efectivamente no lo skipea, por lo que puede matchear como departamento Artigas a partir de solo la palabra "artigas" en dirección — contradiciendo el comentario en el código.

---

## 5. Clasificador

### 5.1 SOURCE_CATEGORY_MAP

Mapea categorías de scrapers a EventType. CobraTicket y MVD Eventos lo proveen consistentemente. RedTickets a veces. TicketFacil y Entraste no proveen categoría.

### 5.2 Regex rules — problemas abiertos

- `"club"` con `/\bclub\b/i` matchea "Club Atlético", "Club de teatro" → falsos positivos.
- `"bar"` con `/\bbar\b/i` matchea "Barbería", "embarque" → falsos positivos.
- `/\bsocio(s)?\b/i` en REJECT_PATTERNS rechaza "Noche de Socios" legítimo.

### 5.3 Reclasificación nocturna

Eventos entre 23:00–01:59 → `"fiesta"` automáticamente.
**Corregido:** `teatro`, `deportivo`, `cultural` y `festival` están excluidos de esta regla ✅

### 5.4 REJECT_PATTERNS — envíos

**Corregido:** `/env[ií]os?/i` reemplazado por patrones que requieren contexto de shipping explícito ✅

---

## 6. Deduplicador

- Similitud: bigrams Dice coefficient. Score = `nameSim × 0.75 + venueSim × 0.25`. Threshold: `>= 0.82`.
- **Corregido:** `.limit(300)` en ambas queries de candidatos ✅

**Problema abierto:** threshold 0.82 puede ser demasiado alto para nombres muy cortos (ej: "Jazz").

---

## 7. Pipeline

### 7.1 Drain loop

**Corregido:** el endpoint `/api/scrape/process` ahora tiene `maxDuration=300s` y procesa batches en loop hasta que `pending=0` o hasta los 270s. `runProcessingPipeline` retorna el conteo real de pendientes restantes ✅

### 7.2 mergeEventData — mejoras aplicadas

- **Protección de fechas:** solo `TRUSTED_DATE_SOURCES` (`cobraticket`, `redtickets`, `ticketfacil`, `mientrada`) pueden sobreescribir una fecha existente cuando difieren ✅
- **Actualización de eventType:** si el existente es `"otro"` y el nuevo tiene tipo específico, se actualiza ✅
- **Actualización de confidenceScore:** se actualiza cuando el nuevo supera al existente ✅
- Selecciona `eventType` y `confidenceScore` del evento existente para comparar ✅

### 7.3 Problemas abiertos

- Procesamiento estrictamente secuencial. Sin paralelismo entre eventos del mismo batch.
- Si la query inicial `getPendingRawEvents` falla, todo el batch falla.

---

## 8. Tabla de estado de defectos

| # | Defecto | Severidad | Estado |
|---|---------|-----------|--------|
| 1 | MiEntrada: `lat`/`lng` ≠ `latitude`/`longitude` en normalizador | **Crítica** | ✅ Corregido |
| 2 | MiEntrada: `dates[]` no se lee como `dateText` en normalizador | **Crítica** | ✅ Corregido |
| 3 | MiEntrada: `department` no se lee como `city` en normalizador | **Alta** | ✅ Corregido |
| 4 | TicketFacil: `isFreeText` no coincide con `isFree` en normalizador | **Alta** | ✅ Corregido |
| 5 | Pipeline `batchSize=50` con un solo cron diario | **Alta** | ✅ Corregido |
| 6 | `deduplicator`: sin `.limit()` en query de candidatos | **Media** | ✅ Corregido |
| 7 | `mergeEventData` sobrescribe fecha sin verificar confiabilidad | **Media** | ✅ Corregido |
| 8 | `mergeEventData` no actualiza `eventType` ni `confidenceScore` | **Media** | ✅ Corregido |
| 9 | CobraTicket: `new Function()` sin estrategia JSON primaria | **Media** | ✅ Corregido |
| 10 | KNOWN_VENUES: `"espacio cultural"` demasiado genérico | **Media** | ✅ Corregido |
| 11 | Cartelera: `saveExtra()` duplica lógica de `saveRawEvent()` | **Baja** | ✅ Corregido |
| 12 | `scheduleText` en `NormalizedEventInput` nunca persiste | **Baja** | ✅ Corregido |
| 13 | REJECT_PATTERN `/env[ií]os?/` demasiado amplio | **Baja** | ✅ Corregido |
| 14 | `confidenceScore` no se actualiza en merge | **Baja** | ✅ Corregido |
| 15 | Entraste: extracción por texto libre, sin coords, sin descripción | **Alta** | ✅ Corregido |
| 16 | Clasificador: reclasificación nocturna sin excepciones por tipo | **Media** | ✅ Corregido |
| 17 | MVD Eventos: `extractDates()` lee `$.text()` completo | **Media** | ✅ Corregido |
| 18 | Cartelera: `saveExtra()` desincronizado con `saveRawEvent()` | **Baja** | ✅ Corregido |
| 19 | `_MONTHS` declarado y no usado en `mvd-eventos.ts` | **Baja** | ✅ Corregido |
| 20 | MiEntrada: `aperturaTime` no se lee en normalizador | **Baja** | ✅ Corregido |
| 21 | CobraTicket: precios desde Firebase no disponibles en SSR | **Media** | ✅ Corregido |
| 22 | RedTickets: cap de 10 páginas puede perder eventos | **Media** | ✅ Corregido |
| 23 | Inconsistencia `PROBLEMATIC_KEYWORDS` vs `UNAMBIGUOUS` en dept-detector | **Baja** | ✅ Corregido |
| 24 | `campo city` en schema llama "city" a lo que es un departamento | **Baja** | 🟡 En migración |

---

## 9. Lo que funciona bien (estado actual)

- **Arquitectura en capas limpia**: scrapers → raw_events → pipeline → events.
- **UPSERT en raw_events**: re-scrapear actualiza sin duplicar.
- **Redis distributed lock por fuente**: evita runs concurrentes.
- **`withTransientRetry`**: maneja desconexiones de DB sin perder trabajo.
- **`shouldRejectEvent` antes de geocodificar**: ahorra llamadas a Mapbox/OpenAI.
- **Bounding box sanity check en Mapbox**: descarta geocodificaciones fuera de Uruguay.
- **Detección de departamento por coordenadas primero**: más confiable que texto.
- **Entraste**: ahora extrae Unix timestamp, JSON de tickets, coords inline y descripción estructurada.
- **MiEntrada**: coordenadas, fechas y departamento ahora se consumen correctamente en el normalizador.
- **Pipeline drain loop**: procesa toda la cola en una sola invocación del cron.
- **mergeEventData**: protege fechas ISO de sobreescritura y actualiza tipo/score cuando mejora.
- **CobraTicket**: estrategia JSON-first evita `new Function()` en la mayoría de los casos.

---

## 10. Mejoras pendientes (siguiente sesión)

### Prioridad media

- **Expansión de KNOWN_VENUES**: agregar venues frecuentes de TicketFacil extraídos de datos históricos.

### Prioridad baja

- **Completar rollout `city` → `department`**: schema, pipeline y queries nuevas ya escriben/leen `department`, pero aún faltan vistas/admin forms para dejar de depender visualmente de `city`.
- **Tests para normalizador y deduplicador**: los casos edge de parsing de fechas y deduplicación son los más propensos a regresiones.
- **Registrar fuente de geocodificación**: agregar campo `geocodeSource` ('scraper' | 'known_venues' | 'mapbox') para auditar calidad de coordenadas.
- **REJECT_PATTERN `/\bsocio(s)?\b/`**: rechaza "Noche de Socios" legítimo. Requiere más contexto antes de rechazar.

---

## Horarios de Cron Jobs (Uruguay - UTC-3)

| Hora Uruguay | Hora UTC | Endpoint | Función |
|--------------|----------|----------|---------|
| 09:00 | 12:00 | `/api/cron/newsletter` | Envío de newsletter |
| 11:00 | 14:00 | `/api/scrape/redtickets` | Scraping RedTickets (~500-800 eventos) |
| 12:00 | 15:00 | `/api/scrape/entraste` | Scraping Entraste (~15-30 eventos) |
| 12:30 | 15:30 | `/api/scrape/cobraticket` | Scraping CobraTicket (~100-200 eventos) |
| 12:45 | 15:45 | `/api/scrape/ticketfacil` | Scraping TicketFacil (~200-400 eventos) |
| 13:00 | 16:00 | `/api/scrape/cartelera` | Scraping Cartelera Uruguay (~50-100 funciones) |
| 13:15 | 16:15 | `/api/scrape/mvd-eventos` | Scraping Agenda Montevideo (~30-60 eventos) |
| 13:30 | 16:30 | `/api/scrape/mientrada` | Scraping MiEntrada (~20-50 eventos) |
| 14:00 | 17:00 | `/api/scrape/process` | Procesamiento y normalización de eventos |
| 14:30 | 17:30 | `/api/scrape/reclassify-otros` | Reclasificación IA de eventos "otro" |
| 00:00 | 03:00 | `/api/scrape/mark-past` | Marcar eventos pasados |

**Nota:** Horario de Uruguay = UTC-3 (puede ser UTC-2 en horario de verano).

---

## Nivel de Automatización

### ✅ Totalmente Automatizado
- **Scraping**: 7 scrapers se ejecutan automáticamente todos los días via Vercel Cron
- **Procesamiento**: Normalización, geocodificación y clasificación automáticas
- **Deduplicación**: Automática (Dice coefficient)
- **Clasificación IA**: Automática (GPT-4o-mini)
- **Eventos pasados**: Marcado automático
- **Reclasificación**: Automática para eventos "otro"

### 🤖 Automatizado con Intervención
- **Publicación de eventos**: Requiere revisión manual por admin
- **Limpieza de datos**: Revisión manual periódica

---

*Fin del análisis.*
