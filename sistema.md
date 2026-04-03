# Sistema de DondeEsHoy

*Última actualización: 2026-03-09.*

Este documento resume el estado actual del sistema, sus features principales, cómo se conectan sus partes y qué decisiones técnicas importan hoy para mantenerlo o seguir evolucionándolo.

---

## 1. Qué es DondeEsHoy

**DondeEsHoy** es una plataforma que junta eventos de Uruguay en un solo lugar.

El sistema:

- descubre eventos desde múltiples fuentes externas,
- guarda primero los datos crudos,
- los limpia y clasifica,
- detecta duplicados,
- publica el resultado final en la web,
- y además permite recibir newsletters, enviar eventos manualmente y administrar todo desde un panel interno.

---

## 2. Features actuales

### Sitio público

- **Home de hoy** con eventos del día.
- **Sección separada para eventos recurrentes**.
- **“Los más buscados”** usando vistas recientes en Redis.
- **Botón “Cerca de mí”** para ordenar eventos por ubicación del usuario.
- **Página `/proximos`** con eventos futuros y filtros rápidos (`mañana`, `fin de semana`, fecha puntual).
- **Página `/mapa`** con eventos geolocalizados y opción de ocultar recurrentes.
- **Página de detalle por slug** en `/evento/[slug]`.
- **Filtros** por texto, tipo, género, departamento, gratis, noche y recurrencia.
- **Formulario para publicar eventos** desde `/publicar`.
- **Suscripción por email** con preferencias por departamento, tipo y frecuencia.

### Backoffice / administración

- Login admin.
- Dashboard con estadísticas.
- Gestión de submissions.
- Revisión de eventos rechazados o baneados.
- Stats de scrapers.
- Vista de raw events y errores del pipeline.
- Ejecución manual de scrapers y reprocesado de eventos crudos.

### Automatización

- **7 scrapers automáticos** corriendo por cron en Vercel.
- **Pipeline de procesamiento** posterior al scraping.
- **Marcado automático de eventos pasados**.
- **Reclasificación nocturna de eventos `otro`** con IA.
- **Newsletter diaria y semanal**.

---

## 3. Arquitectura general

```text
Fuentes externas
  ├─ RedTickets
  ├─ CobraTicket
  ├─ TicketFacil
  ├─ Cartelera
  ├─ MVD Eventos
  ├─ Entraste
  └─ MiEntrada
         ↓
Scrapers
         ↓
raw_events (datos crudos en PostgreSQL)
         ↓
Pipeline de procesamiento
  ├─ normalizer
  ├─ reject rules
  ├─ geocoder
  ├─ department detector
  ├─ classifier (+ IA en fallback)
  ├─ deduplicator
  └─ merge / create event
         ↓
events (tabla final para mostrar al usuario)
         ↓
Queries del sitio + APIs + páginas Next.js
         ↓
Web pública / mapa / admin / newsletter
```

---

## 4. Stack actual

| Capa | Tecnología |
|------|------------|
| Frontend / SSR | Next.js 16 + React 19 |
| Estilos | Tailwind CSS 4 |
| Base de datos | PostgreSQL |
| ORM | Drizzle ORM |
| Cache / rate limit / locks | Upstash Redis |
| Geocodificación | Coordenadas del scraper + venues conocidos + Google Geocoding API |
| Clasificación ambigua | OpenAI |
| Emails | Resend |
| Deploy | Vercel |
| Mapa | Google Maps JavaScript API |

---

## 5. Flujo de datos real

### 5.1 Scraping

Cada scraper:

1. descubre URLs o items de una fuente,
2. extrae los datos disponibles,
3. arma un objeto crudo,
4. hace **UPSERT** en `raw_events` usando `(source, source_id)` como identidad lógica.

Eso significa que si un evento ya fue scrapeado antes, se actualiza el registro crudo en vez de duplicarlo.

### 5.2 Almacenamiento intermedio

La tabla `raw_events` guarda:

- fuente,
- id original de la fuente,
- URL,
- `raw_data` en JSON,
- fecha de scraping,
- si ya fue procesado,
- error de procesamiento si lo hubo.

### 5.3 Pipeline

El pipeline toma `raw_events` con `processed = false` y los procesa uno por uno:

1. **normalizeRawEvent()**
   - limpia texto,
   - interpreta fecha y hora,
   - normaliza venue,
   - detecta precios,
   - detecta si es gratis,
   - intenta coordenadas y departamento.

2. **shouldRejectEvent()**
   - filtra cosas que no son eventos reales,
   - por ejemplo membresías, alquileres, turnos, promociones, clases permanentes, paquetes privados, etc.

3. **geocodeVenue()**
   - usa primero coordenadas del scraper,
   - si no hay, busca en venues conocidos,
   - si tampoco hay, intenta con Google Geocoding API.

4. **detectDepartment()**
   - prioriza coordenadas,
   - luego texto del venue/dirección,
   - y si no alcanza, cae en heurísticas.

5. **classifyEvent()**
   - intenta tipo por categoría original de la fuente,
   - luego por reglas de texto,
   - y en casos ambiguos puede usar IA.

6. **findDuplicateEventId()**
   - busca si el evento ya existe.

7. **createEvent() / mergeEventData()**
   - crea el evento nuevo,
   - o enriquece uno existente si era el mismo.

### 5.4 Consumo por el sitio

Las páginas públicas no leen `raw_events`.

Todo lo visible para el usuario sale de la tabla final `events`, usando queries centralizadas en `src/lib/queries.ts`.

---

## 6. Fuentes actuales de scraping

### RedTickets

- Fuente de mayor volumen.
- Descubrimiento correcto: búsqueda paginada, no homepage.
- Trae buenos precios desde payload estructurado.
- Puede traer coordenadas.

### CobraTicket

- Fuente de alta calidad.
- Suele traer fecha estructurada, venue y coordenadas.
- Tiene mejor calidad de campos que otras fuentes.

### TicketFacil

- Discovery vía API REST.
- Sin coordenadas nativas en general.
- Muchas veces depende de geocodificación posterior.

### Cartelera

- Más enfocada en teatro / espectáculos.
- Puede generar múltiples registros crudos para distintas funciones.

### MVD Eventos

- Agenda institucional.
- Buena para eventos culturales de Montevideo.
- Generalmente sin precios ni coordenadas.

### Entraste

- Menor volumen.
- Extrae fechas, tickets, venue y coordenadas desde HTML / scripts inline.

### MiEntrada

- Puede traer múltiples fechas en arrays.
- El normalizador hoy consume esos campos correctamente.

---

## 7. APIs del sistema

En este proyecto “API” significa rutas internas del propio sitio que conectan frontend, base de datos, automatizaciones y servicios externos.

### 7.1 APIs públicas / semipúblicas

#### `GET /api/events`

Busca eventos con filtros y paginación.

Parámetros soportados hoy:

- `q`
- `type`
- `genre`
- `department`
- `free`
- `limit`
- `offset`
- `meta=filters` para obtener opciones de filtros

Características:

- rate limit,
- paginación,
- sanitización de campos internos,
- cache control para respuesta pública.

#### `POST /api/events/view`

Registra vistas de un evento.

Hace 3 cosas en paralelo:

- incrementa ranking diario en Redis,
- incrementa ranking horario en Redis,
- aumenta `viewCount` persistente en PostgreSQL.

Esto alimenta “Los más buscados”.

#### `GET /api/events/trending`

Lee desde Redis el ranking de eventos más vistos/buscados del día.

#### `GET /api/events/[id]`

Hoy existe pero está **placeholder/base operativo**. No es el endpoint principal de detalle usado por la experiencia pública.

#### `POST /api/submissions`

Recibe eventos enviados por usuarios:

- valida con Zod,
- aplica honeypot,
- limita abuso por IP,
- guarda en base,
- notifica por email al admin.

#### `POST /api/subscriptions`

Da de alta suscriptores para newsletters:

- guarda preferencias,
- genera tokens,
- envía email de verificación,
- evita duplicados verificados.

#### `GET /api/subscriptions/verify`

Confirma la suscripción por email.

#### `GET /api/subscriptions/unsubscribe`

Permite baja de la newsletter.

---

### 7.2 APIs internas / admin

Bajo `src/app/api/admin/` hay endpoints para:

- login / logout,
- stats,
- listado de eventos,
- submissions,
- raw events,
- scrapers,
- pipeline,
- baneados,
- rechazados,
- revisión manual.

Estas APIs no son para uso público: alimentan el dashboard admin y tareas internas.

---

### 7.3 APIs automatizadas por cron

Estas rutas son disparadas automáticamente por Vercel Cron y protegidas con secret / locks:

- `/api/scrape/redtickets`
- `/api/scrape/entraste`
- `/api/scrape/cobraticket`
- `/api/scrape/ticketfacil`
- `/api/scrape/cartelera`
- `/api/scrape/mvd-eventos`
- `/api/scrape/mientrada`
- `/api/scrape/process`
- `/api/scrape/mark-past`
- `/api/scrape/reclassify-otros`
- `/api/cron/newsletter`

---

## 8. Cron jobs actuales

| Hora UTC | Ruta | Función |
|----------|------|---------|
| 12:00 | `/api/cron/newsletter` | Newsletter diaria/semanal |
| 14:00 | `/api/scrape/redtickets` | Scraping RedTickets |
| 15:00 | `/api/scrape/entraste` | Scraping Entraste |
| 15:30 | `/api/scrape/cobraticket` | Scraping CobraTicket |
| 15:45 | `/api/scrape/ticketfacil` | Scraping TicketFacil |
| 16:00 | `/api/scrape/cartelera` | Scraping Cartelera |
| 16:15 | `/api/scrape/mvd-eventos` | Scraping MVD Eventos |
| 16:30 | `/api/scrape/mientrada` | Scraping MiEntrada |
| 17:00 | `/api/scrape/process` | Procesamiento de `raw_events` |
| 17:30 | `/api/scrape/reclassify-otros` | Reintento IA para `otro` |
| 03:00 | `/api/scrape/mark-past` | Marcar eventos pasados |

**Referencia Uruguay:** normalmente UTC-3.

---

## 9. Modelo de datos importante

### `raw_events`

Es la bandeja de entrada cruda del sistema.

No está pensada para mostrarla al usuario final.

### `events`

Es la tabla limpia/final.

Campos clave:

- `name`
- `slug`
- `description`
- `date`
- `startTime`, `endTime`
- `venueName`, `venueAddress`
- `latitude`, `longitude`
- `city` y `department`
- `eventType`, `musicGenre`
- `priceMin`, `priceMax`, `currency`, `isFree`
- `confidenceScore`
- `viewCount`
- `isRecurring`
- `status`

### `event_sources`

Relaciona cada evento final con los raw events que contribuyeron a crearlo o enriquecerlo.

Esto es importante para trazabilidad y merge entre múltiples fuentes.

---

## 10. Eventos recurrentes: estado actual

Este es uno de los temas más importantes hoy.

### 10.1 Cómo se detectan

La recurrencia se detecta con reglas de texto en `classifier.ts`.

Se marcan como recurrentes cuando aparecen patrones claros como:

- “todos los días”
- “todo el año”
- “lunes a viernes”
- “sábado y domingo”
- “cada jueves”
- “todos los fines de semana”

La detección mira:

- nombre,
- descripción,
- y también `dateText` original del scraper.

Esto es clave porque a veces la recurrencia está en el texto crudo de fecha y no en el nombre.

### 10.2 Cómo se guardan hoy

Un evento recurrente **no se guarda en varias filas, una por cada día**.

Hoy se guarda como:

- **una sola fila** en `events`,
- con `isRecurring = true`,
- y con una fecha almacenada que suele ser la fecha parseada / primera fecha útil disponible.

O sea: la fecha sigue existiendo, pero para los recurrentes **no se usa como “única verdad” de visibilidad**.

### 10.3 Cómo se muestran

En varias queries del sistema, los recurrentes se incluyen aunque la fecha exacta no coincida.

Ejemplo real:

- en home, `getEventsByDate(date)` incluye `events.date = date` **o** `isRecurring = true`.

Por eso:

- un evento normal aparece solo en su fecha,
- un evento recurrente puede aparecer todos los días o en varias vistas aunque su fecha guardada sea otra.

### 10.4 Cómo se deduplican

Los eventos normales se comparan contra otros del mismo día y departamento.

Los recurrentes se comparan distinto:

- **ignoran la fecha**,
- buscan coincidencias por nombre + venue en el mismo departamento,
- justamente para no crear duplicados nuevos en cada scrape.

### 10.5 Cómo se comportan en otras partes del sistema

- `mark-past` **no** marca como pasados a los recurrentes.
- En home se separan en una sección propia.
- En `/proximos` se separan por cada grupo mostrado.
- En el mapa se pueden ocultar con un toggle.
- `getTrendingEvents()` excluye recurrentes para no mezclar “lo que pasa hoy” con “lo que existe siempre”.

### 10.6 Limitación actual

El sistema hoy sabe decir:

- “esto es recurrente”

pero **no sabe modelar con precisión**:

- qué días exactos se repite,
- desde cuándo hasta cuándo,
- si aplica solo fines de semana,
- si tiene excepciones,
- cuál es su próxima ocurrencia real.

En otras palabras: hoy la recurrencia es un **booleano útil para mostrar**, no una agenda completa.

---

## 11. Posibles mejoras para recurrentes

Si se quiere mejorar este tema, lo natural sería pasar de un modelo simple (`isRecurring`) a uno más rico.

### Mejora mínima razonable

Agregar campos como:

- `recurrenceType` (`daily`, `weekly`, `weekends`, `custom`)
- `recurrenceDays` (ej. `['jueves', 'viernes']`)
- `recurrenceTextOriginal`
- `validFrom`
- `validUntil`

### Mejora intermedia

Guardar además:

- `nextOccurrenceDate`
- `lastSeenAt`
- `isAlwaysAvailable`

### Mejora más sólida

Separar:

- **evento base**
- y **ocurrencias**

Ejemplo conceptual:

- una tabla `events` para la identidad del evento,
- una tabla `event_occurrences` para cada fecha concreta.

Eso permitiría:

- listar realmente solo los días correctos,
- no mostrar un recurrente donde no corresponde,
- manejar cancelaciones puntuales,
- distinguir mejor un ciclo semanal de uno permanente.

### Trade-off

El modelo actual es simple, barato y útil.

El modelo con ocurrencias sería más correcto, pero también más complejo para:

- scrapers,
- normalización,
- deduplicación,
- queries,
- admin,
- newsletters.

---

## 12. Newsletter y suscripciones

### Newsletter

`/api/cron/newsletter`:

- envía **weekly** los jueves para viernes-sábado-domingo,
- envía **daily** todos los días para mañana,
- filtra eventos por preferencias del suscriptor,
- usa locks para evitar ejecuciones duplicadas.

### Suscriptores

El usuario puede elegir:

- departamentos,
- tipos de evento,
- frecuencia diaria o semanal.

---

## 13. Seguridad y control operativo

- Rate limit en APIs públicas.
- Rate limit específico para submissions, subscriptions, trending y views.
- Honeypots en formularios.
- Cron protegido por secret.
- Locks distribuidos para evitar ejecuciones simultáneas.
- Sanitización de respuestas públicas para no exponer campos internos.

---

## 14. Scripts de mantenimiento

Además del flujo automático, el proyecto tiene scripts para:

- re-scrapear,
- revisar edge cases,
- corregir departamentos,
- arreglar duplicados,
- ajustar recurrentes,
- re-geocodificar,
- verificar datos.

Los más ligados a recurrencia hoy son:

- `fix-recurring-events.mjs`
- `fix-recurring-duplicates.mjs`
- `fix-duplicates-and-recurring.mjs`

---

## 15. Estado general del sistema

### Lo que está sólido

- arquitectura en capas clara,
- scrapers separados por fuente,
- uso de `raw_events` como buffer seguro,
- pipeline centralizado,
- deduplicación razonable,
- soporte de geolocalización y mapa,
- ranking de vistas con Redis,
- newsletters con preferencias,
- buena base para admin y automatización.

### Lo que hoy merece más atención

- modelado más rico de eventos recurrentes,
- consolidación final del campo `department` frente al legado de `city`,
- mayor precisión de ocurrencias futuras en eventos no únicos,
- observabilidad de errores por fuente,
- tests automáticos para parsing y recurrencia.

---

## 16. Resumen ejecutivo

DondeEsHoy hoy funciona como un **agregador automatizado de eventos de Uruguay** con:

- scraping diario,
- procesamiento centralizado,
- publicación pública optimizada,
- ranking por interacción,
- newsletters segmentadas,
- y panel admin.

El sistema ya resuelve bien el caso principal de eventos únicos.

En cambio, los **eventos recurrentes** hoy están resueltos con un enfoque práctico: se detectan y se muestran como recurrentes, pero todavía no se modelan como calendario completo de ocurrencias. Ese es probablemente el mejor candidato a mejora estructural si se busca subir precisión sin depender tanto de heurísticas.
