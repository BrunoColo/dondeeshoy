# Análisis del Sistema — Scrapers → Eventos Reales

*Análisis objetivo desde el código fuente. Fecha: 2026-02-27*

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
      └─ /api/scrape/mientrada   → MiEntradaScraper
                │
                ↓  UPSERT en raw_events (processed=false)
         [raw_events table — JSONB]
                │
17:00 UTC → /api/scrape/process
                │
         runProcessingPipeline(batchSize=50)
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
```

---

## 1. Scrapers

### 1.1 BaseScraper

Clase abstracta que todos los scrapers heredan. Define el contrato:

- `discoverUrls()` → lista de URLs a scrapear
- `scrapeEvent(url)` → `ScrapedRawEvent | null`
- `run()` → itera URLs, aplica rate limit (Upstash Redis, 1 req/s), retry x3 con backoff 400ms×intento, guarda en `raw_events` con UPSERT en `(source, source_id)`

**Problema real:** El rate limit en `BaseScraper.run()` aplica `enforceRateLimit` por request individual pero no hay ningún cap global de tiempo por sesión de scraping. Si un scraper descubre 800 URLs (RedTickets), eso son ~13 minutos solo de espera de rate limit, más el tiempo real de fetch. Vercel Functions tienen timeout de 300s (5 min) en el plan Pro. Un scraper grande puede agotar el timeout y quedarse con trabajo parcialmente hecho sin error explícito.

**Problema real:** Cuando `saveRawEvent` hace UPSERT, resetea `processed=false` y borra `processingError`. Esto significa que re-scrapear un evento que fue rechazado (`processingError = "rejected: ..."`) lo vuelve a encolar para el pipeline. Si el evento sigue siendo un no-evento, el pipeline lo rechaza de nuevo, pero genera trabajo innecesario en cada ciclo diario.

---

### 1.2 CobraTicket

**Calidad: Alta.** Extrae desde JSON SvelteKit embebido (`const data = [...]`).

**Campos extraídos:** title, description, category, dateText (ISO), startTime, endTime, venueName, venueAddress, city ("Ciudad, Departamento"), latitude, longitude, imageUrl, isFree (texto), prices (de descripción), ageRestriction, organizer.

**Lo que funciona bien:**
- Coordenadas GPS directas desde `latlng` del payload
- Fecha en ISO estricto (`2026-02-19 23:59:00`), sin ambigüedad
- Campo `city` ya formateado como "Punta del Este, Maldonado"
- Fallback DOM robusto si el JSON no está disponible

**Problemas detectados:**

1. **Precios extraídos de texto libre**, no de datos estructurados. El comentario en el código lo confirma: "actual ticket types are loaded client-side via Firebase and not available in SSR HTML". Los precios que llegan son los que CobraTicket menciona en la descripción del evento, lo cual es inconsistente: algunos organizadores los ponen, otros no. Esto produce `priceMin=null` para eventos de pago.

2. **`new Function()` para evaluar JS embebido** (`extractSvelteKitProps`). Es técnicamente seguro en server-side pero es frágil ante cambios de formato del SSR de SvelteKit. Si SvelteKit cambia cómo serializa el state, el regex `const\s+data\s*=\s*(\[[\s\S]*?\])\s*;\s*(?:\r?\n|\s*Promise)` deja de matchear y cae al fallback DOM sin aviso visible.

3. **Detección de isFree por texto** en `buildEventFromProps`: usa regex en `bodyText = title + description`. Si la descripción no menciona "gratis" pero el evento lo es (porque los precios están en Firebase), `isFree=false` y `prices=[]`, lo que genera `currency="USD"` en el normalizador (por la lógica `priceMax < 50`).

---

### 1.3 RedTickets

**Calidad: Alta.** Mayor volumen del sistema (~500–800 URLs por ciclo).

**Campos extraídos:** title, description, category, dateText, venueText, venueAddress, imageUrl, prices (GeneXus JSON → JSON-LD → meta → texto), latitude, longitude (iframe Google Maps), isFree (GeneXus).

**Lo que funciona bien:**
- Coordenadas desde iframe Google Maps embed (`q=LAT,LNG`)
- Precios desde `vPURCHASEOPTIONSRESPONSE` en el estado GeneXus — datos estructurados reales, con `unitPrice` (sin fees)
- `isFree` explícito desde `Evt.isFree` del payload GeneXus
- Descripción desde `og:description` y fallback a contenido

**Problemas detectados:**

1. **Paginación con cap fijo de 10 páginas** (`maxSearchPages`). Si RedTickets tiene más de 10 páginas de resultados (lo cual depende del tamaño de página de su API), eventos válidos quedan fuera. No hay señal de cuándo se llegó al final real de los resultados más allá de "2 páginas vacías consecutivas".

2. **`searchCardMeta` es estado mutable de instancia** (`private searchCardMeta = new Map()`). La instancia se crea en `new RedTicketsScraper()` y se descarta al final del cron. Pero si `discoverUrls()` falla parcialmente en una página, la metadata de esa página no queda en el cache y `scrapeEvent` usa el fallback de `detailCategory` para esa URL. No es un bug grave pero puede causar clasificaciones menos precisas para eventos de páginas que fallaron.

3. **`extractCategoryFromDotPattern` busca `li > div[style*="border-radius"][style*="height: 10px"][style*="width: 10px"]`**. Este selector depende de inline styles específicos de la versión actual de RedTickets. Un cambio de CSS del lado de RedTickets rompe silenciosamente la extracción de categoría (cae a `null`, sin error).

4. **El scraper hace 2 requests por evento** en RedTickets (search page + detail page). Con 800 URLs × 2 = 1600 requests, más las páginas de discovery. A 1 req/s eso es más de 26 minutos, bien por encima del timeout de Vercel.

---

### 1.4 TicketFacil

**Calidad: Media-alta.**

**Campos extraídos:** title, description, dateText (YYYY-MM-DD), startTime, endTime, venueName, venueAddress (split por " - "), imageUrl, prices (de `/registerToEvent/`).

**Lo que funciona bien:**
- Discovery por REST API de accesofacil, no HTML parsing
- Filtros pre-scraping agresivos (membresías, eventos fuera de Uruguay, organizadores excluidos)
- Manejo de rangos de fecha (usa la fecha de inicio)
- Precios desde `initPrice` attributes en `/registerToEvent/`

**Problemas detectados:**

1. **Sin coordenadas.** TicketFacil no tiene mapa embed ni coordenadas en su HTML. Todos los eventos de esta fuente dependen de `KNOWN_VENUES` lookup o Mapbox para geocodificación. Con ~200-400 eventos por ciclo, esto es un impacto significativo en la cobertura del mapa.

2. **Hace 2 requests por evento**: `/info/` + `/registerToEvent/` para precios. Duplica el tiempo de scraping.

3. **`fetchPricesFromRegisterPage` silencia todos los errores** con `return []`. Si la página de registro tiene un error HTTP o cambia su formato, el evento queda sin precios sin ningún log.

4. **Sin categoría.** `rawData` no incluye campo `category`. Todos los eventos de TicketFacil van directo a heurísticas de texto en el clasificador, sin la ventaja del `SOURCE_CATEGORY_MAP`.

5. **`isFreeText` se almacena como booleano** en `rawData` pero el campo en el schema es `isFree` no `isFreeText`. En el normalizador (`normalizer.ts:105`), se lee `rawData.isFree === true`. Como TicketFacil guarda `isFreeText: true`, `scraperSaysIsFree` queda `false` y la detección de gratuitos depende solo del texto. Bug silencioso: `rawData.isFreeText` no se lee en ningún lugar del normalizador.

---

### 1.5 Cartelera

**Calidad: Media.**

**Campos extraídos:** title, genre, duration, description, venueName, venueAddress, imageUrl, prices, cast, dateText, startTime. Un raw_event por fecha de función.

**Lo que funciona bien:**
- Multi-fecha: genera un raw_event por función individual
- Extrae elenco (`[itemprop='actor']`)
- Extrae duración y género de markup schema.org

**Problemas detectados:**

1. **Sin coordenadas.** Ningún campo lat/lng en el scraper.

2. **El override de `run()` es frágil.** Cartelera sobreescribe `run()` del BaseScraper para manejar multi-fecha. El mecanismo usa `_pendingMultiDateEvents` como array mutable de instancia. El código en `scrapeEvent()` hace `this._pendingMultiDateEvents = this._pendingMultiDateEvents || []` — esto presupone que `run()` inicializa el array antes de llamar a `scrapeEvent()`, lo cual es correcto, pero es una dependencia de orden implícita que puede romperse si se refactoriza la clase base.

3. **`saveExtra()` duplica la lógica de `saveRawEvent()`** del BaseScraper (la misma query de UPSERT). Si `BaseScraper.saveRawEvent()` cambia (por ejemplo, se agrega un campo), `saveExtra()` queda desincronizado.

4. **El conteo de `saved` en `run()` override** usa `savedIds.size`, que cuenta todos los eventos multi-fecha pero no resta el primero que ya fue guardado por `super.run()`. El resultado es que `saved` puede ser >= al real (el primero se cuenta dos veces si está en `_pendingMultiDateEvents`).

5. **`parseDateHeading()` asume año actual o siguiente** basándose en comparación de número de mes. Si se scrapea en diciembre y hay funciones en enero, la lógica `if (monthNum < now.getMonth() + 1)` asigna año+1 correctamente. Pero si se scrapea en enero de 2026 y hay una función en diciembre (que terminó en diciembre 2025), asigna 2026 cuando debería ser pasado. En práctica esto rara vez ocurre porque Cartelera solo muestra funciones futuras, pero es una suposición no validada.

6. **Selectores CSS específicos** (`.lista-horarios > li`, `.subheading`, `.hora`). Un rediseño del sitio los rompe sin error.

---

### 1.6 MVD Eventos

**Calidad: Media.**

**Campos extraídos:** title (con parent event), description, dateText, venueName, venueAddress, category, imageUrl, isFree.

**Lo que funciona bien:**
- Estructura Drupal relativamente estable (`field--name-*` classes)
- Categoría disponible desde campos Drupal
- Detecta gratuitos por texto

**Problemas detectados:**

1. **Sin coordenadas y sin precios.** MVD Eventos es un sitio gubernamental que no expone ninguno de los dos. Sin coordenadas, estos eventos no aparecen en el mapa a menos que el venue esté en `KNOWN_VENUES`.

2. **`extractDates()` mezcla 3 estrategias** diferentes en cascada sin clara prioridad semántica: campo Drupal `field--fechas` → `field--resumen` (que es descripción, no fecha) → regex de día-de-la-semana en texto completo → regex DD/MM/YYYY en texto completo. Las últimas dos estrategias leen `$.text()` de toda la página, lo que puede capturar fechas de la navegación, footer o contenido relacionado en lugar de la fecha del evento.

3. **`_MONTHS` está declarado pero inmediatamente marcado `void _MONTHS`**. Es código muerto: la variable está definida pero no se usa en ningún lugar del archivo. La extracción de fechas de MVD Eventos delega al normalizador, no a este mapa local.

4. **Discovery mezcla `/evento/` y `/actividad/`** sin distinción. Algunos `/actividad/` son programas permanentes (museos abiertos, actividades semanales), no eventos puntuales. El filtro que excluye `agenda-anteriores` es insuficiente.

5. **`extractSourceId` reemplaza `/` con `--`** para URLs como `/evento/padre/hijo`. Esto produce `sourceId = "padre--hijo"`. Funciona como identificador único pero si el sitio cambia la estructura de URL para el mismo evento, genera duplicados.

---

### 1.7 Entraste

**Calidad: Baja.**

**Campos extraídos:** title, venueName, venueAddress, dateText, imageUrl, prices. Sin descripción, sin coordenadas, sin categoría.

**Problemas detectados:**

1. **Discovery solo desde homepage**. Un único `fetchHtml(entrasteBaseUrl)` escanea los links de la página principal. Entraste probablemente tiene paginación o secciones de categorías no visitadas. El resultado es un volumen muy bajo (~20-50 eventos).

2. **`extractDateText()` usa regex sobre el texto completo de la página** (`fullText = normalizeWhitespace($.root().text())`). Busca el primer match de `día-de-la-semana + número + de + mes`. Si el footer o la navegación de Entraste tienen texto con días de la semana (como "Eventos de este viernes"), captura eso en lugar de la fecha real del evento.

3. **Sin descripción.** `rawData` no incluye campo `description`. Esto afecta la clasificación (el clasificador usa `name + description + venueName`) y el `shouldUseAiClassification()` que evalúa si la descripción es larga y genérica.

4. **Sin coordenadas.** Entraste no tiene mapa embed.

5. **Volumen demasiado bajo para el costo de mantenimiento.** 20-50 eventos por ciclo, con los campos más críticos faltantes.

---

### 1.8 MiEntrada

**Calidad: Media.** Scraper relativamente nuevo, bien estructurado.

**Campos extraídos:** title, imageUrl, venueName, venueAddress, department, lat, lng (de Google Maps link), dates (array DD/MM/YYYY), aperturaTime, description, prices.

**Lo que funciona bien:**
- Extrae coordenadas desde URL de Google Maps (`maps/search/LAT,LNG`)
- Extrae `department` del formato "Venue, Ciudad/Departamento"
- Descripción desde sección "Descripción" del HTML
- Strips de boilerplate WhatsApp

**Problemas detectados:**

1. **`dates` se almacena como array `string[]` en `rawData`** pero el normalizador espera `rawData.dateText` como string. El campo `dates` de MiEntrada **no se lee en ningún lugar del normalizador**. Esto significa que todos los eventos de MiEntrada llegan al normalizador con `dateText = ""`, lo que activa el fallback a IA para parsear la fecha (desperdiciando budget de OpenAI).

2. **`lat` y `lng` se almacenan como `rawData.lat` y `rawData.lng`** pero el normalizador lee `rawData.latitude` y `rawData.longitude`. Las coordenadas de MiEntrada **nunca se usan**. Todos sus eventos quedan sin coordenadas a pesar de que el scraper las extrae correctamente.

3. **`department` del scraper se almacena en `rawData.department`** pero el normalizador no lo lee (lee `rawData.city` como `scraperCity`). La información de departamento queda perdida.

4. Estos tres bugs (dateText, latitude/longitude, city) son probablemente **los defectos más críticos del sistema actual**: un scraper que extrae datos correctamente pero cuyos campos no son consumidos por el normalizador.

---

## 2. Normalizador

### 2.1 Parsing de fechas

El normalizador tiene 4 estrategias en orden: DD/MM/YYYY → DD/MM/YY → YYYY-MM-DD → "N de mes" en español. Si todo falla, llama a OpenAI GPT-4o-mini.

**Problema: doble parsing de fecha** (líneas 57-71). El normalizador parsea la fecha de `dateText` Y también de `name`. Si ambos producen una fecha válida, siempre usa la del nombre: `parsedDate = dateFromName`. Esto tiene consecuencias no deseadas:

- Eventos cuyos nombres incluyen fechas de ediciones anteriores ("Festival Rock 2025 - Edición 15° Aniversario") pueden heredar el año incorrecto.
- Eventos de Cartelera que incluyen el número de edición en el nombre ("Ciclo 22 de agosto") pueden hacer que el normalizador parsee "22/08" como la fecha del evento.

**Problema: `wasFallback` es `true` cuando no hay fecha**, pero el normalizador solo llama a la IA si `dateText` está presente. Si `dateText` es vacío (caso MiEntrada), `resolveDateWithAi("")` no se llama y la fecha queda como hoy (`formatDate(new Date())`). Esto genera fechas incorrectas silenciosamente.

**Problema: la fecha de fallback es la fecha actual del servidor** (UTC). En el cron de las 17:00 UTC, eso es las 14:00 hora Uruguay (UTC-3). Si el evento es de hoy pero el scraping corre antes de la medianoche UY, la fecha puede quedar bien. Pero si hay algún evento con fecha ambigua, queda con la fecha de scraping, no con la fecha real.

### 2.2 Detección de moneda

```typescript
const currency = hasUsdHint || (priceMax !== null && priceMax < 50) ? "USD" : "UYU";
```

La heurística `priceMax < 50` clasifica como USD cualquier evento con precio máximo menor a $50. En Uruguay, entradas de $0 a $49 pesos son extremadamente raras (o son en USD). Pero:
- Eventos con `priceMax = null` (sin precio) quedan en UYU correctamente
- Eventos gratuitos con `isFree=true` y `priceMax=null` también quedan bien
- El riesgo real es un evento de $30 UYU (un taller comunitario muy barato) que se clasifica como USD 30

### 2.3 `isFreeText` de TicketFacil no se lee

Como se mencionó en §1.4, el campo `isFreeText` guardado por TicketFacil no coincide con el campo `isFree` que lee el normalizador. Bug silencioso.

### 2.4 Venue cleaning

`cleanVenueName()` corta en keywords como "Ubicación:", "Ver flyer", "Tickets". La lista es corta y específica a formatos actuales de scrapers. Nuevos formatos de texto no procesados correctamente quedan como nombres de venue sucios sin aviso.

---

## 3. Geocodificador

### 3.1 Flujo

```
1. ¿Coords en normalized.latitude/longitude? → usar directamente
2. ¿Venue en KNOWN_VENUES (~134 entries)? → usar coords del lookup
3. ¿NEXT_PUBLIC_MAPBOX_TOKEN? → Mapbox API (country=uy, bounding box -36/-30 lat, -59/-53 lng)
4. → null
```

### 3.2 KNOWN_VENUES

134 venues hardcodeados con coordenadas. Cubre bien Montevideo (70+ venues) y Punta del Este (10+), con cobertura parcial del interior (Tacuarembó, Rivera, Salto, Paysandú, Colonia, Durazno, Lavalleja, Rocha).

**Problema:** El lookup usa `text.includes(normalize(key))` sobre `venueName + venueAddress`. Esto puede dar falsos positivos si el nombre del venue contiene una substring de una clave conocida. Por ejemplo, un venue llamado "Bar Sala Zitarrosa 2" matchearía la entrada de "sala zitarrosa" y obtendría las coordenadas de Sala Zitarrosa (incorrectas para el bar).

**Problema:** Algunas coordenadas son aproximadas (comentadas con "aprox" implícito por los valores redondos). Por ejemplo `{ keys: ["espacio cultural"], latitude: -34.9060, longitude: -56.1900 }` — "espacio cultural" es demasiado genérico y puede matchear cualquier venue cuyo nombre contenga esas palabras, asignando coordenadas arbitrarias del centro de Montevideo.

**Problema:** Mapbox usa `NEXT_PUBLIC_MAPBOX_TOKEN` — un token del lado del cliente expuesto en el bundle del frontend. Usar este mismo token para geocodificación server-side (en el pipeline) no es un problema de seguridad en sí, pero si el token tiene restricciones de dominio/URL configuradas en Mapbox, las llamadas server-side pueden fallar.

### 3.3 Coordenadas de MiEntrada perdidas

Como se detalla en §1.8, MiEntrada extrae coordenadas correctamente pero las guarda como `lat`/`lng`. El normalizador solo lee `rawData.latitude`/`rawData.longitude`. Las coordenadas nunca llegan al geocodificador.

---

## 4. Detector de Departamentos

### 4.1 Prioridad correcta

Las coordenadas tienen prioridad absoluta sobre el texto. Esto es correcto. El bounding box de Uruguay (-36 a -30 lat, -59 a -53 lng) es el mismo que usa el geocodificador de Mapbox.

### 4.2 Bounding boxes con solapamientos

Los bounding boxes de departamentos se solapan geográficamente (Uruguay no es una grilla). Por ejemplo, las coordenadas de Atlantida (Canelones) están dentro del bbox de Canelones, pero podrían estar en el borde de otro. El código resuelve esto verificando Montevideo primero (departamento más pequeño, caso más común). Para el resto itera en orden de definición, tomando el primer match. No hay manejo explícito de solapamientos.

**Caso concreto problemático:** El bbox de Canelones (`minLat: -34.895`) se solapa con el de Montevideo (`maxLat: -34.705`). Hay una banda entre -34.895 y -34.950 que cae fuera del bbox de Montevideo pero dentro del de Canelones. Eventos en esa banda se clasifican como Canelones, que puede ser correcto para Ciudad de la Costa pero incorrecto para puntos que GPS considera Montevideo.

### 4.3 PROBLEMATIC_KEYWORDS vs UNAMBIGUOUS_DEPARTMENT_KEYWORDS

Hay una inconsistencia en el código: `UNAMBIGUOUS_DEPARTMENT_KEYWORDS` incluye `"artigas"`, `"flores"`, `"durazno"` (líneas 57-60 del department-detector), pero `PROBLEMATIC_KEYWORDS` también los incluye (líneas 25-37). La lógica en `detectDepartment()` verifica:

```typescript
if (PROBLEMATIC_KEYWORDS.has(normalizedKeyword) && !UNAMBIGUOUS_DEPARTMENT_KEYWORDS.has(normalizedKeyword)) {
  if (normalizedKeyword.split(/\s+/).length < 2) continue;
}
```

Como `"artigas"` está en ambos sets, la condición `!UNAMBIGUOUS_DEPARTMENT_KEYWORDS.has("artigas")` es `false`, por lo que NO se skipea. En práctica, `"artigas"` como palabra sola sí puede matchear y asignar departamento Artigas. Esto contradice el comentario "NOTE: 'artigas' alone is too generic" en el array `DEPARTMENT_RULES`.

---

## 5. Clasificador

### 5.1 SOURCE_CATEGORY_MAP

Mapea categorías de scrapers a EventType. Solo CobraTicket y MVD Eventos proveen categorías consistentemente. RedTickets a veces provee categoría (del dot-pattern), TicketFacil y Entraste no. El mapa incluye comentarios para categorías de `voy.com.uy` (scraper que no existe aún).

### 5.2 Regex rules — orden y cobertura

14 tipos de evento con regex. El orden importa porque el primer match gana. Problemas concretos:

- `"club"` tiene regex `/\bclub\b/i`. Esto matchea "Club Atlético", "Club de teatro", "Club Náutico" — todos eventos legítimos que se clasificarían como `"club"` (tipo nightclub) en lugar de `"deportivo"` o `"teatro"`. Solo se evita si la regex de `"fiesta"` (que va antes) matchea primero, o si hay un venue conocido.

- `"bar"` tiene regex `/\bbar\b/i`. Matchea "Bar de Derecho" (baile estudiantil), "Barbería", "embarque". Falsos positivos.

- `"taller"` incluye `/\britua\b/` y `/\bsanaci[oó]n\b/`. Clasifica eventos de terapias alternativas como talleres, lo cual puede ser correcto pero es semánticamente debatible.

- `"fiesta"` incluye `/\bnoche cubana\b/` y `/\bdanzeria\b/` — keywords muy específicos a venues/eventos particulares de Uruguay. Si esos venues cierran o cambian nombre, los keywords quedan muertos en el código.

### 5.3 REJECT_PATTERNS

Los reject patterns son conservadores (bien). Rechazan membresías, alquileres, empleos. Pero hay casos edge:

- `/\bsocio(s)?\b/i` rechaza cualquier evento que mencione "socios". Eventos legítimos como "Noche de Socios" o "Descuento para Socios" quedan rechazados si el título los menciona.

- `/\benv[ií]os?\b/i` rechaza cualquier mención de "envío/envíos". Esto es demasiado amplio — eventos que mencionan "el envío de señales en vivo" o "el envío del elenco a gira" quedarían rechazados.

### 5.4 Lógica `shouldUseAiClassification`

Activa IA cuando:
1. `eventType === "otro"` — correcto
2. `matchedTypes.length > 1` y el tipo no es high-confidence — puede sobreactivar IA para casos simples como "Festival de rock" que matchea festival+concierto
3. descripción larga (≥120 chars) con palabras genéricas ("evento", "show", "experiencia") — razonable pero el threshold de 120 chars es arbitrario

El budget de IA (`AI_CLASSIFICATION_MAX_PER_BATCH`, default 25) puede agotarse antes de procesar todos los ambiguos si hay muchos eventos "otro" en el batch de 50.

### 5.5 Reclasificación nocturna

```typescript
return hour === 23 || hour === 0 || hour === 1;
```

Eventos que empiezan a las 23:00–01:59 se reclasifican automáticamente como `"fiesta"`. Esto puede sobreclasificar: un concierto que empieza a las 23:00 queda como "fiesta". Una obra de teatro en horario nocturno (poco común pero posible) también. La lógica no tiene excepciones.

---

## 6. Deduplicador

### 6.1 Algoritmo

- Eventos recurrentes: busca por ciudad + `isRecurring=true`, sin filtro de fecha
- Eventos puntuales: busca por fecha + ciudad exacta
- Similitud: bigrams Dice coefficient (no exactamente Jaccard, sino `2×overlap / (|A|+|B|)`)
- Score = `nameSimilarity × 0.75 + venueSimilarity × 0.25`
- Threshold: `>= 0.82`

### 6.2 Problemas de deduplicación

**Problema: la búsqueda de candidatos no tiene límite.** En `findDuplicateEventId`:

```typescript
const sameDayEvents = await db.select(...).from(events)
  .where(and(eq(events.date, normalized.date), eq(events.city, normalized.city)));
```

Sin `.limit()`. Si hay 300 eventos en Montevideo el mismo día, carga 300 rows en memoria y las evalúa una a una. Con el volumen actual del sistema esto es tolerable, pero escala mal.

**Problema: threshold 0.82 puede ser demasiado alto para nombres cortos.** Para un evento llamado "Jazz" (4 chars), hay muy pocos bigrams. La similitud entre "Jazz" y "Jazz en vivo" puede estar por debajo de 0.82 aunque sean el mismo evento.

**Problema: `mergeEventData` no actualiza `eventType` ni `confidenceScore`.** Si un evento fue creado por MVD Eventos con tipo "cultural" y baja confidence, y luego llega de CobraTicket con tipo "concierto" y alta confidence, el merge no actualiza el tipo. El primero en llegar define el tipo permanentemente.

**Problema: `mergeEventData` actualiza la fecha solo si la fecha nueva es diferente a la existente.** La lógica:

```typescript
if (existingDateStr && existingDateStr !== newDateStr) {
  updates.date = normalized.date;
}
```

Esto actualiza la fecha incondicionalmente cuando difieren — sin verificar cuál es más confiable. Si el evento original tenía una fecha correcta de CobraTicket (ISO) y el merge viene de MVD Eventos con una fecha parseada de texto libre (potencialmente incorrecta), la fecha "correcta" queda sobreescrita.

---

## 7. Pipeline

### 7.1 Procesamiento secuencial sin paralelismo

El pipeline es estrictamente secuencial: un evento a la vez. Con `batchSize=50` y eventos que requieren llamadas a Mapbox + OpenAI, el tiempo por batch puede ser alto. No hay paralelización de las operaciones independientes (geocodificación + clasificación son independientes entre sí para eventos distintos).

### 7.2 `batchSize=50` fijo

El pipeline procesa 50 raw_events por llamada. Si hay 500 pendientes, se necesitan 10 llamadas al endpoint `/api/scrape/process`. Con el cron configurado para una sola llamada por día, los 450 restantes quedan pendientes hasta el siguiente día. No hay mecanismo de "volver a correr hasta agotar la cola".

### 7.3 Retry de transient errors

`withTransientRetry` tiene 3 intentos con backoff 200ms×intento. Solo reintenta para errores de red (`ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, `57P01`). Errores de base de datos no transitorios (constraint violations, etc.) se propagan inmediatamente, correcto.

### 7.4 Error handling por evento

Si un evento falla, el pipeline registra el error en `processingError` y continua con el siguiente. Correcto. Pero si el error es en la query inicial `getPendingRawEvents`, toda la ejecución falla sin procesar ningún evento.

### 7.5 `confidenceScore` no se actualiza en merge

`calculateConfidenceScore` se calcula para el evento nuevo pero solo se usa al crear (`createEvent`). En `mergeEventData` no hay actualización de `confidenceScore`. Si el evento original tenía score 0.50 (sin hora, sin precio) y el merge agrega hora y precio, el score sigue siendo 0.50.

### 7.6 El campo `scheduleText` se almacena pero no se usa

`normalizeRawEvent` retorna `scheduleText: dateText || null`. Este campo se pasa a `findDuplicateEventId` (dentro de `detectRecurrence`) y a `classifyEvent`. Pero `createEvent` no lo incluye en el INSERT — no hay columna `scheduleText` en el schema `events`. El campo existe en `NormalizedEventInput` pero nunca persiste en la base de datos. Si alguna vez se quisiera mostrar el texto de horario al usuario, no está disponible.

---

## 8. Tabla de defectos por impacto

| # | Defecto | Impacto | Afecta | Severidad | Estado |
|---|---------|---------|--------|-----------|--------|
| 1 | MiEntrada: `lat`/`lng` ≠ `latitude`/`longitude` en normalizador | Coordenadas nunca se usan | Todos los eventos de MiEntrada | **Crítica** | ✅ Corregido |
| 2 | MiEntrada: `dates[]` no se lee como `dateText` en normalizador | Fecha siempre hoy, gasta AI budget | Todos los eventos de MiEntrada | **Crítica** | ✅ Corregido |
| 3 | MiEntrada: `department` no se lee como `city` en normalizador | Departamento incorrecto | Todos los eventos de MiEntrada | **Alta** | ✅ Corregido |
| 4 | TicketFacil: `isFreeText` no coincide con `isFree` en normalizador | Eventos gratuitos no detectados | ~200-400 eventos/ciclo | **Alta** | ✅ Corregido |
| 5 | Pipeline `batchSize=50` con un solo cron diario | 500+ pendientes → demora días en procesar | Todo el sistema | **Alta** | ✅ Corregido |
| 6 | `deduplicator`: sin limit en query de candidatos | Escala mal con volumen alto | Todo el sistema | **Media** | ✅ Corregido |
| 7 | `mergeEventData` sobrescribe fecha sin verificar confiabilidad | Fechas correctas pueden quedar incorrectas | Eventos duplicados entre fuentes | **Media** | ✅ Corregido |
| 8 | `mergeEventData` no actualiza `eventType` ni `confidenceScore` | Primer scraper gana permanentemente | Eventos duplicados entre fuentes | **Media** | ✅ Corregido |
| 9 | CobraTicket usa `new Function()` sobre JS embebido | Fragilidad ante cambios de SvelteKit | CobraTicket DOM fallback silencioso | **Media** | ✅ Corregido |
| 10 | KNOWN_VENUES: "espacio cultural" como clave demasiado genérica | Coordenadas incorrectas | Venues con esa substring | **Media** | ✅ Corregido |
| 11 | Cartelera `saveExtra()` duplica lógica de `saveRawEvent()` | Desincronización si cambia el schema | Cartelera multi-fecha | **Baja** | ✅ Corregido |
| 12 | `scheduleText` en `NormalizedEventInput` nunca persiste | Datos calculados perdidos | Todo el sistema | **Baja** | ✅ Corregido |
| 13 | REJECT_PATTERN `/\benv[ií]os?\b/` demasiado amplio | Falsos rechazos | Eventos con "envío" en descripción | **Baja** | ✅ Corregido |
| 14 | `confidenceScore` no se actualiza en merge | Score desactualizado | Eventos mergeados | **Baja** | ✅ Corregido |

---

## 9. Cosas que funcionan bien

Hay que ser justo: el sistema tiene partes bien diseñadas.

- **Arquitectura en capas limpia**: scrapers → raw_events → pipeline → events. La separación es correcta y fácil de razonar.
- **UPSERT en raw_events**: re-scrapear un evento actualiza los datos sin duplicar filas. Correcto.
- **Redis distributed lock por fuente**: evita runs concurrentes del mismo scraper.
- **withTransientRetry en el pipeline**: maneja desconexiones de base de datos sin perder trabajo.
- **shouldRejectEvent antes de geocodificar**: ahorra llamadas a Mapbox/OpenAI para no-eventos.
- **Bounding box sanity check en Mapbox**: descarta geocodificaciones fuera de Uruguay.
- **Detección de departamento por coordenadas primero**: más confiable que texto.
- **Multi-fecha en Cartelera**: la idea es correcta, aunque la implementación tiene fricciones.
- **Filtros pre-scraping en TicketFacil**: el scraper más limpio en términos de calidad de señal.
- **Extracción de precios desde GeneXus en RedTickets**: usa datos estructurados internos, no regex de texto libre.

---

## 10. Mejoras por prioridad

### Prioridad crítica (bugs que producen datos incorrectos ahora mismo)

**1. Mapear campos de MiEntrada en el normalizador** ✅ *Implementado — commit 94f38e6*

`normalizer.ts` ahora lee `rawData.lat`/`rawData.lng`, `rawData.dates[]` y `rawData.department` de MiEntrada correctamente. Además pasa las coordenadas a `detectDepartment()` para priorizar GPS sobre texto.

**2. Corregir `isFreeText` de TicketFacil** ✅ *Implementado — commit 94f38e6*

`normalizer.ts` ahora lee `rawData.isFree === true || rawData.isFreeText === true`.

### Prioridad alta (impacto en calidad de datos)

**3. Pipeline: ejecutar hasta agotar la cola en un solo cron** ✅ *Implementado — commit 94f38e6*

`/api/scrape/process/route.ts` ahora tiene `maxDuration = 300` y un drain loop que procesa batches hasta que `pending === 0` o se acerca al timeout (270s). `runProcessingPipeline` ahora retorna el conteo real de eventos restantes en `result.pending`.

**4. `mergeEventData`: proteger fecha existente si viene de fuente más confiable** ✅ *Implementado — commit 8eab296*

`mergeEventData` recibe ahora `incoming.source`. Solo `TRUSTED_DATE_SOURCES` (`cobraticket`, `redtickets`, `ticketfacil`, `mientrada`) pueden sobreescribir una fecha existente cuando difieren. Fuentes de texto libre (MVD Eventos, Cartelera, Entraste) nunca pisan una fecha ya guardada.

**5. `mergeEventData`: actualizar `eventType` y `confidenceScore` cuando la nueva fuente tiene mayor confianza** ✅ *Implementado — commit 8eab296*

- Si el evento existente tiene `eventType = "otro"` y el nuevo tiene un tipo específico, se actualiza.
- `confidenceScore` se actualiza siempre que el nuevo sea mayor al existente.

### Prioridad media (mejoras de calidad y robustez)

**6. KNOWN_VENUES: eliminar o hacer más restrictivos los keys genéricos** ✅ *Implementado — commit 8eab296*

Eliminada la entrada `["espacio cultural"]`.

**7. Deduplicador: agregar `.limit()` a la query de candidatos** ✅ *Implementado — commit 94f38e6*

Ambas queries en `deduplicator.ts` tienen `.limit(300)` ahora.

### Prioridad media (mejoras de calidad y robustez)

**8. CobraTicket: obtener precios desde la API de Firebase**

CobraTicket expone precios en `https://app.cobraticket.uy/api/v1/events/{id}/tickets` o similar. Scrapear esa endpoint (si es accesible públicamente) daría precios estructurados en lugar de parseo de texto.

**9. CobraTicket: `new Function()` sobre JS embebido** ✅ *Implementado — commit 3f0aff0*

`extractSvelteKitProps` ahora tiene 3 estrategias en cascada: JSON puro (`<script type="application/json">`) → `new Function()` → DOM. Cada fallo logea su causa explícitamente. El caso más común (SvelteKit ≥2) ya no requiere eval.

**9. TicketFacil: agregar coordenadas vía venue geocoding**

TicketFacil provee venue name y address. El pipeline ya llama a `geocodeVenue()`, que busca en KNOWN_VENUES y luego en Mapbox. El problema es que KNOWN_VENUES es insuficiente para muchos venues de TicketFacil. La solución es expandir KNOWN_VENUES con los venues más frecuentes de TicketFacil, extrayéndolos de los datos históricos.

**10. Cartelera: sacar `saveExtra()` y usar `BaseScraper.saveRawEvent()` directamente** ✅ *Implementado — commit 8eab296*

`saveRawEvent` es ahora `protected` en BaseScraper. `CarteleraScraper.run()` lo llama directamente; `saveExtra()` eliminado.

**11. `normalizer.ts`: `scheduleText` eliminado de `NormalizedEventInput`** ✅ *Implementado — commit 3f0aff0*

Campo eliminado de la interfaz y del retorno del normalizador. `detectRecurrence()` usa `name + description` directamente.

**12. MVD Eventos: mejorar `extractDates()` para no leer `$.text()` completo** ✅ *Implementado — commit 8eab296*

`extractDates()` ahora busca dentro de `article, main, .node__content, #content` primero. Solo cae a `body` si no encuentra contenedor principal.

**13. REJECT_PATTERN `envíos` acotado** ✅ *Implementado — commit 3f0aff0*

Reemplazado `/env[ií]os?/i` por dos patrones que requieren contexto de shipping real: `envíos gratis/a domicilio/express` y `envíos a todo el país`.

**14. Entraste: agregar discovery de más páginas**

Ver sección §1.7 del análisis.

**14. Clasificador: hacer la reclasificación nocturna condicional** ✅ *Implementado — commit 8eab296*

`LATE_NIGHT_RECLASSIFY_EXCEPTIONS` excluye `teatro`, `deportivo`, `cultural` y `festival` de la reclasificación nocturna automática.

### Prioridad baja (deuda técnica)

**15. Eliminar `_MONTHS` muerto en `mvd-eventos.ts`** ✅ *Implementado — commit 8eab296*

**16. Documentar el campo `city` como "departamento", no ciudad**

El campo `city` en la tabla `events` almacena el departamento de Uruguay (Montevideo, Maldonado, etc.), no la ciudad. El nombre es confuso para quien lee el schema.

**17. Agregar tests para el normalizador y deduplicador**

Los casos edge de parsing de fechas y deduplicación son los más propensos a regresiones y están completamente sin tests.

**18. Registrar la fuente de geocodificación en `events`**

Sería útil saber si las coordenadas de un evento vienen del scraper, de KNOWN_VENUES o de Mapbox, para poder auditar la calidad de los datos.

---

*Fin del análisis. Basado en lectura directa del código fuente, sin suposiciones externas.*
