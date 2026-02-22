# Sistema de Scraping y Procesamiento de Eventos - Análisis Completo

## Resumen Ejecutivo

Este documento analiza el sistema completo de scraping de eventos de Uruguay, desde la extracción de datos crudos hasta la creación de eventos normalizados en la base de datos. El sistema comprende 6 scrapers, un normalizador, un clasificador, un geocodificador, un detector de departamentos y un deduplicador.

---

## 1. Análisis de Scrapers

### 1.1 Comparación General

| Scraper | Complejidad | Campos Extraídos | Fiabilidad | Cobertura | Volumen Estimado |
|---------|-------------|------------------|------------|-----------|------------------|
| CobraTicket | Alta | 14 | Excelente | Nacional | ~300-500 eventos |
| RedTickets | Alta | 13 | Excelente | Nacional | ~500-800 eventos |
| TicketFacil | Media-Alta | 11 | Buena | Nacional | ~200-400 eventos |
| MVD Eventos | Media | 9 | Buena | Montevideo | ~50-150 eventos |
| Cartelera | Media | 11 | Buena | Montevideo | ~100-200 eventos |
| Entraste | Baja | 7 | Regular | Nacional | ~20-50 eventos |

**Volumen Total Estimado por ciclo: ~1,170 - 2,100 eventos**

### 1.2 Análisis Detallado por Scraper

#### 🥇 CobraTicket (Tier: Excelente) - ~300-500 eventos

**Fortalezas:**
- Extrae datos estructurados desde JSON embebido de SvelteKit (SSR)
- Proporciona coordenadas GPS directamente (`lat`, `lng`)
- Incluye categoría, organizador, restricciones de edad
- Posee fallback robusto a parsing DOM
- El campo `city` ya viene formateado como "Ciudad, Departamento"

**Campos extraídos:**
```typescript
{
  title, description, category, dateText, startTime, endTime,
  venueName, venueAddress, city, latitude, longitude,
  imageUrl, isFree, prices, ageRestriction, organizer
}
```

**Irregularidades detectadas:**
- Los precios se extraen del texto de descripción, no de datos estructurados
- No hay manera de saber si hay entradas vendidas sin usar API externa

---

#### 🥈 RedTickets (Tier: Excelente) - ~500-800 eventos ⚠️ VOLUMEN MÁS ALTO

**Fortalezas:**
- Extrae coordenadas directamente del iframe de Google Maps嵌入
- **NUEVO: Sistema avanzado de extracción de precios desde JSON GeneXus embebido** (`vPURCHASEOPTIONSRESPONSE`)
- **NUEVO: Extrae descripción** desde meta tags y contenido de la página
- Detecta eventos gratuitos desde datos embebidos (campo `isFree` del GeneXus)
- Soporte para metadatos de categoría desde cards de búsqueda
- **Posee fallback robusto de precios**: 1) GeneXus JSON → 2) JSON-LD → 3) Meta tags → 4) Texto

**Campos extraídos:**
```typescript
{
  title, description, category, dateText, venueText, venueAddress,
  imageUrl, prices, latitude, longitude, isFree
}
```

~~**PROBLEMA CRÍTICO:**~~
~~- **NO extrae descripción del evento** - ~500-800 eventos afectados~~
~~- Esto representa ~40% del volumen total sin descripción~~

**YA RESUELTO:** Ahora extrae descripción correctamente.

**Irregularidades detectadas:**
- El patrón de URL puede variar (`/evento/{slug}/{id}`)
- La fecha y venue vienen en un formato estructurado que requiere parsing específico (`span.Description.Flex`)

---

#### 🥉 TicketFacil (Tier: Bueno) - ~200-400 eventos

**Fortalezas:**
- Usa API REST de accesofacil para descubrimiento (no HTML parsing)
- Posee filtros agresivos pre-scraping para excluir eventos no válidos
- Extrae precios de dos páginas diferentes (info + registro)
- Maneja rangos de fechas correctamente
- **NUEVO: Extrae venueAddress** - hace split de strings como "Teatro Solís - Buenos Aires s/n" en venueName + venueAddress

**Filtros pre-scraping implementados:**
- Excluye membresías de clubs (`socios`, `club balneario`)
- Excluye eventos corporativos privados
- Excluye eventos fuera de Uruguay por título, venue u organizador
- Excluye eventos "por invitación" sin precios públicos

**Campos extraídos:**
```typescript
{
  title, description, dateText, startTime, endTime,
  venueName, venueAddress, imageUrl, prices, isFreeText
}
```

**PROBLEMAS:**
- ~~**NO extrae venue address**~~ - **YA RESUELTO** (~200-400 eventos ahora tienen address)
- **NO extrae coordenadas** (~200-400 eventos afectados)
- **NO extrae categoría**

**Irregularidades detectadas:**
- No extrae coordenadas (siempre `null`)
- No extrae categoría
- ~~Venue address siempre `null`~~ - **YA RESUELTO**
- Dependencia de la API externa de accesofacil (punto de fallo)

---

#### 📊 MVD Eventos (Tier: Bueno) - ~50-150 eventos

**Fortalezas:**
- Scraping de sitio Drupal bien estructurado
- Extrae categoría desde campos Drupal
- Soporta tanto eventos como actividades
- Detecta eventos gratuitos desde texto

**Campos extraídos:**
```typescript
{
  title (con parent event), description, dateText,
  venueName, venueAddress, category, imageUrl, isFree
}
```

**PROBLEMAS:**
- **NO extrae coordenadas** (~50-150 eventos afectados)
- **NO extrae precios**

**Irregularidades detectadas:**
- No extrae coordenadas
- No extrae precios
- Fechas pueden venir en múltiples formatos
- Venue address a veces mezclado con venue name

---

#### 📊 Cartelera (Tier: Bueno) - ~100-200 eventos

**Fortalezas:**
- Extrae elenco (cast) de obras teatrales
- Soporta múltiples fechas por espectáculo
- Extrae género y duración
- Posee mapeo de precios robusto

**Campos extraídos:**
```typescript
{
  title, genre, duration, description, venueName, venueAddress,
  imageUrl, prices, cast, dateText, startTime
}
```

**PROBLEMAS:**
- **NO extrae coordenadas** (~100-200 eventos afectados)
- Dependencia fuerte de clases CSS específicas (punto de rotura)

**Irregularidades detectadas:**
- No extrae coordenadas
- No extrae categoría
- Dependencia fuerte de clases CSS específicas (punto de rotura)
- El parsing de fechas asume año actual o siguiente

---

#### ⚠️ Entraste (Tier: Regular) - ~20-50 eventos

**Fortalezas:**
- Extrae venue y dirección desde HTML estructurado
- Posee manejo de URLs relativas de imágenes

**Campos extraídos:**
```typescript
{
  title, venueName, venueAddress, dateText, imageUrl, prices
}
```

**PROBLEMAS CRÍTICOS (~20-50 eventos afectados):**
- **NO extrae coordenadas** 
- **NO extrae categoría**
- **NO extrae descripción**
- **NO extrae ciudad/departamento**
- Patrón de URL limitado
- Dependencia de estructura HTML específica

---

### 1.3 Ranking Final de Scrapers (por volumen × calidad)

| Posición | Scraper | Volumen | Puntuación | Razón |
|----------|---------|---------|------------|-------|
| 1 | CobraTicket | ~300-500 | 9/10 | Más campos, coordenadas, city field, fallback robusto |
| 2 | RedTickets | ~500-800 | 9/10 | Mayor volumen, coordenadas, precios GeneXus, descripción extraída ✅ |
| 3 | TicketFacil | ~200-400 | 7.5/10 | API estable, filtros buenos, SIN coordenadas, SIN venue address |
| 4 | Cartelera | ~100-200 | 6.5/10 | Multi-fecha, cast, pero frágil, SIN coordenadas |
| 5 | MVD Eventos | ~50-150 | 7/10 | Drupal estructurado, SIN coordenadas, SIN precios |
| 6 | Entraste | ~20-50 | 4/10 | Campos mínimos, sin coordenadas, HTML frágil |

**Nota**: RedTickets es #1 en volumen Y ahora tiene todos los campos. Es el scraper con mayor ROI.

---

## 2. El Normalizador (normalizer.ts)

### 2.1 Flujo de Normalización

El normalizador transforma `RawEvent` → `NormalizedEventInput` con los siguientes pasos:

1. **Sanitización de texto**: Limpia espacios extra, normaliza whitespace
2. **Extracción de fecha**: Intenta múltiples formatos (ISO, DD/MM/YYYY, texto español)
3. **Fallback de fecha IA**: Si la fecha no se puede parsear, usa GPT-4 para resolver
4. **Venue cleaning**: Limpia ruido como "Ubicación:", "Ver flyer", etc.
5. **Normalización de precios**: Convierte arrays de precios a min/max
6. **Detección de gratuito**: Busca keywords "gratis", "entrada libre", etc.
7. **Divisa**: Detecta USD vs UYU por keywords o precio bajo (< 50)
8. **Departamento**: Usa `detectDepartment` para inferir ubicación

### 2.2 Campos Normalizados

```typescript
{
  name, slug, description, scheduleText, date,
  startTime, endTime, venueName, venueAddress, city,
  imageUrl, ticketUrl, priceMin, priceMax,
  currency, isFree, ageRestriction, latitude, longitude
}
```

### 2.3 Problemas y Limitaciones

**Irregularidades detectadas:**

1. **Date parsing heurístico**: 
   - Si la fecha del nombre es más específica que `dateText`, usa la del nombre
   - Pero esto puede fallar si el nombre contiene fechas de ediciones anteriores

2. **Venue cleaning limitado**:
   - Solo corta en keywords específicos
   - No maneja bien venues con información extra concatenada

3. **Currency detection weak**:
   - USD detectado solo por keywords o precio < 50
   - Puede误判 eventos caros en UYU como USD

4. **Fallback IA costoso**:
   - Cada fecha no parseable = llamada a OpenAI
   - Impacta en latencia y costo

5. **NUEVO: Detección de gratuito mejorada** (v2):
   - Primero consulta `scraperSaysIsFree` (del scraper)
   - Si no hay precios Y el texto dice "gratis"/"entrada libre" → es gratis
   - El scraper de RedTickets ahora provee `isFree` directamente desde GeneXus

---

## 3. Sistema de Geocodificación (geocoder.ts)

### 3.1 Flujo de Geocodificación

```
1. ¿Coords del scraper?
   └─ Sí → Usar coords del scraper (source: "scraper")
   └─ No → 
        ├── ¿Venue conocido en KNOWN_VENUES?
        │   └─ Sí → Usar coords del lookup (source: "lookup")
        │   └─ No → 
        │       └── ¿Token Mapbox?
        │           └─ Sí → Geocodificar con Mapbox (source: "mapbox")
        │           └─ No → Sin coordenadas (source: "none")
```

### 3.2 Base de Venues Conocidos

El sistema tiene **~130+ venues pre-mapeados** con coordenadas, incluyendo:
- 70+ venues de Montevideo
- 15+ venues de Punta del Este / Maldonado
- **NUEVO: 20+ venues del interior**: Tacuarembó, Rivera, Salto, Paysandú, Colonia, Durazno, Lavalleja, Rocha
- Mejora la geocodificación para TicketFacil/Cartelera/MVD eventos sin coords del scraper

### 3.3 Problemas y Limitaciones

**Irregularidades detectadas:**

1. **Dependencia de Mapbox**:
   - Sin token `NEXT_PUBLIC_MAPBOX_TOKEN` = sin geocodificación
   - API externa prone a rate limits

2. **Bounding box Uruguay**:
   - ~~Coordendas fuera de `-36 to -30` lat y `-59 to -53` lng son rechazadas~~
   - ~~Pero no hay validación de si está dentro del país correctamente~~

3. **KNOWN_VENUES incompleto**:
   - ~~Solo 109 venues hardcodeados~~ - **Actualizado**: ~130+ venues
   - **NUEVO**: Agregados 20+ venues del interior (Tacuarembó, Rivera, Salto, Paysandú, Colonia, Durazno, Lavalleja, Rocha)
   - Venues nuevos no reconocidos
   - Algunos coordenadas aproximadas

4. **NUEVO: Lógica de detección de departamentos mejorada**:
   - **Coordenadas siempre tienen prioridad** - son datos objetivos de ubicación real
   - **Keywords problemáticos identificados**: "colonia", "artigas", "flores", "durazno", etc. son nombres de calles en Montevideo Y departamentos
   - **Unambiguous keywords**: solo phrases específicas como "colonia del sacramento" pueden detectar departamento sin coords
   - **Bounding boxes aproximados**: derivamos de datos geográficos generales, no son límites oficiales (para precisión usar GADM/IDE Uruguay)

---

## 4. Detector de Departamentos (department-detector.ts)

### 4.1 Flujo de Detección

```
1. ¿Coords disponibles?
   └─ Sí → Usar bounding boxes de departamentos (preciso)
   └─ No → 
        ├── Buscar en scraperCity
        ├── Buscar en venueAddress  
        └── Buscar en venueName
        └── Buscar en eventName (fallback, menos preciso)
```

### 4.2 Bounding Boxes por Departamento

19 departamentos con bounding boxes aproximados:
- Montevideo: `-34.950, -34.705` lat, `-56.410, -56.005` lng
- Canelones, Maldonado, Colonia, etc.

### 4.3 Problemas y Limitaciones

**Irregularidades detectadas:**

1. **False positives comunes**:
   - "Colonia" es nombre de calle en Montevideo → puede误判
   - "Artigas" es nombre de calle → requiere contexto específico

2. **Fallback a Montevideo**:
   - Si no puede detectar → asume Montevideo
   - Pero la mayoría de eventos son de Montevideo (sesgo justificado)

3. **Bounding boxes se solapan**:
   - Algunos departamentos tienen áreas que se solapan
   - La primera coincidencia gana (orden de prioridad)

4. **Keywords incompletos**:
   - Muchas ciudades del interior no están en las reglas
   - Solo las más populares tienen cobertura

---

## 5. Clasificador (classifier.ts)

### 5.1 Tipos de Evento Soportados

```typescript
type EventType = 
  | "festival" | "concierto" | "recital" | "teatro" | "cultural"
  | "deportivo" | "gastronomico" | "familiar" | "feria" | "taller"
  | "fiesta" | "club" | "bar" | "otro";
```

### 5.2 Sistema de Clasificación

1. **Regex rules**: 14+ categorías con múltiples patrones
2. **Venue hints**: Mapeo de venue conocido → tipo
3. **Metadata hints**: Usa categoría del scraper
4. **Time-based**: Eventos que empiezan >= 22:00 → "fiesta"
5. **AI fallback**: Si tipo = "otro" o ambiguo → GPT-4

### 5.3 Rechazo de No-Eventos

Patrones que rechazan entradas:
- Canchas de alquiler
- Membresías de gyms
- Turnos disponibles
- Clases regulares/permanentes
- Ofertas/descuentos
- Empleos/convocatorias

### 5.4 Problemas y Limitaciones

**Irregularidades detectadas:**

1. **Regex fragile**:
   - Orden importa (primer match gana)
   - "fiesta" puesto primero para vencer "club"/"bar"

2. **False positives theater**:
   - TeatroCMC puede ser interpretable como "cultural"

3. **AI classification costoso**:
   - Cada evento "otro" puede generar llamada a OpenAI
   - Controlado por `AI_CLASSIFICATION_MAX_PER_BATCH`

---

## 6. Deduplicador (deduplicator.ts)

### 6.1 Algoritmo de Deduplicación

1. **Eventos recurrentes**: Match por nombre + ciudad (sin fecha)
2. **Eventos puntuales**: Match por nombre + ciudad + fecha
3. **Similitud**: Coeficiente de bigrams (Jaccard-like)
   - Score >= 0.82 = duplicado

### 6.2 Estrategia de Merge

Cuando encuentra duplicado:
- Actualiza fecha si la nueva es válida
- Completa precios si no existían
- Completa coords si no existían
- Completa venue si era placeholder

### 6.3 Problemas y Limitaciones

**Irregularidades detectadas:**

1. **Score threshold arbitrario**:
   - 0.82 puede ser muy alto o muy bajo según el caso

2. **No considera fuente**:
   - No prioriza fuentes más confiables
   - Un scraper malo puede sobreescribir datos buenos

3. **Solo 2D matching**:
   - No considera imágenes
   - No considera descripción

---

## 7. Pipeline de Procesamiento (pipeline.ts)

### 7.1 Flujo Completo

```
1. getPendingRawEvents(batchSize)
   ↓
2. para cada rawEvent:
   ├─→ normalizeRawEvent()
   │   ├─ Sanitiza texto
   │   ├─ Parsea fecha (con fallback IA)
   │   ├─ Limpia venue
   │   ├─ Normaliza precios
   │   └─ Detecta departamento
   │
   ├─ shouldRejectEvent() → ¿Es válido?
   │   └─ No → mark processed, skip
   │
   ├─ geocodeVenue()
   │   ├─ ¿Coords del scraper?
   │   ├─ ¿Venue conocido?
   │   └─ ¿Mapbox?
   │
   ├─ classifyEvent() (heurística)
   │   └─ ¿Necesita IA?
   │       └─ classifyEventWithAi() → GPT-4
   │
   ├─ findDuplicateEventId()
   │   └─ ¿Existe?
   │       ├─ Sí → mergeEventData()
   │       └─ No → createEvent()
   │
   ├─ link raw_event → event
   └─ mark processed
```

### 7.2 Métricas del Pipeline

```typescript
interface PipelineResult {
  pending: number;      // Raw events pendientes
  processed: number;   // Procesados en esta tanda
  created: number;      // Nuevos eventos creados
  merged: number;       // Duplicados mergeados
  skipped: number;      // Rechazados
  errors: number;       // Errores
  aiClassified: number; // Clasificados con IA
}
```

### 7.3 Problemas y Limitaciones

**Irregularidades detectadas:**

1. **Procesamiento secuencial**:
   - Sin paralelismo
   - Lento para batches grandes

2. **Retry logic básico**:
   - Solo 3 reintentos
   - Backoff fijo de 200ms

3. **No hay validación de calidad post-creación**:
   - Eventos creados pueden tener datos faltantes
   - No hay revisión humana

---

## 8. Irregularidades y Problemas Sistémicos

### 8.1 Problemas de Datos (con impacto en volumen)

| Problema | Scraper(s) Afectado(s) | Eventos Impactados | Impacto | Severidad |
|----------|------------------------|-------------------|---------|-----------|
| ~~Sin descripción~~ | ~~RedTickets~~ | ~~~500-800~~ | ~~No hay detalle del evento~~ | ~~**CRÍTICA**~~ → **RESUELTO** |
| ~~Venue address null~~ | ~~TicketFacil~~ | ~~200-400~~ | ~~Sin venue address~~ | ~~**ALTA**~~ → **RESUELTO** |
| Sin coordenadas | TicketFacil, Cartelera, MVD Eventos | ~350-750 | No hay mapa | **ALTA** |
| Venue address null | MVD Eventos | ~50-150 | Geocodificación worse | Media |
| Fechas en texto libre | Todos | Variable | Parsing error prone | Media |
| Sin categoría | Entraste, TicketFacil | ~220-450 | Clasificación harder | Media |
| Precios faltantes | MVD Eventos, Entraste | ~70-200 | Sin info de entrada | Media |
| Sin coords | Entraste | ~20-50 | No hay mapa | **ALTA** |

### 8.2 Problemas de Calidad

1. **Venue placeholder "Venue por confirmar"**:
   - Muchos eventos quedan con este valor
   - Afecta experiencia de usuario

2. **Departamento default Montevideo**:
   - Eventos mal geolocalizados se asignan a Montevideo
   - Inflación artificial de Montevideo

3. **Currency inconsistency**:
   - Precios en USD/UYU mezclados sin criterio claro
   - Comparación de precios dificultada

### 8.3 Problemas de Arquitectura

1. **Pipeline síncrono**:
   - No escala bien
   - Tiempos de procesamiento largos

2. **Dependencias externas**:
   - Mapbox (API key necesaria)
   - OpenAI (costos variables)
   - accesofacil API (punto de fallo)

3. **Sin validación post-pipeline**:
   - Eventos creados sin revisión
   - Errores pueden propagarse

### 8.4 Fixes Recientes (2026-02-21)

1. **Middleware deprecation (Vercel)**:
   - Renombrado `middleware.ts` → `proxy.ts`
   - Cambiado `export function middleware()` → `export function proxy()`
   - Conforme a convención de Next.js 16

2. **TypeScript error**:
   - Corregido `cheerio.AnyNode` → `AnyNode` en redtickets.ts:376
   - El tipo ya estaba importado desde domhandler pero referenciado incorrectamente

3. **Lógica de detección de departamentos mejorada**:
   - **Las coordenadas siempre tienen prioridad** - eliminamos el cross-validation problemático
   - **Keywords problemáticos**: identificados 11 palabras que son deptos Y calles (colonia, artigas, flores, etc.)
   - **Solo phrases específicas** pueden detectar depto sin coords (ej: "colonia del sacramento")
   - **Bounding boxes**: siguen siendo aproximaciones, no datos oficiales (fuente: límites geográficos generales, no INE/GADM)

---

## 9. Recomendaciones de Mejora (Priorizadas por Volumen de Impacto)

### IMPACTO POR SCRAPER (volumen × campos faltantes)

| Scraper | Volumen | Problema Principal | Eventos Affected | Prioridad |
|---------|---------|-------------------|------------------|-----------|
| **RedTickets** | ~500-800 | ✅ Todo completo (descripción agregada) | ~0 | - |
| **CobraTicket** | ~300-500 | ✅ Todo completo | ~0 | - |
| **TicketFacil** | ~200-400 | ✅ Venue address resuelto, ❌ Sin coords | ~200-400 | **#1** |
| **Cartelera** | ~100-200 | ❌ Sin coords, frágil CSS | ~100-200 | **#2** |
| **MVD Eventos** | ~50-150 | ❌ Sin coords, sin prices | ~50-150 | MEDIA |
| **Entraste** | ~20-50 | ❌ Casi todo incompleto | ~20-50 | BAJA |

### Prioridad REAL (volumen × gravedad):

1. **TicketFacil (~200-400 eventos)**: Agregar coordenadas + venue address
2. **Cartelera (~100-200 eventos)**: Agregar coordenadas + robustizar CSS
3. **MVD Eventos (~50-150 eventos)**: Agregar coordenadas + precios
4. **Entraste (~20-50 eventos)**: Reescribir completo o eliminar

### 9.1 Alta Prioridad (MAYOR IMPACTO)

~~#### 1. **[CRÍTICA] Extraer descripción en RedTickets** (~500-800 eventos)~~
~~**Por qué**: RedTickets es el mayor proveedor pero no extrae descripción.~~

~~**Impacto**: 500-800 eventos × mejora = **mayor ROI**~~

~~```typescript~~
~~// En redtickets.ts - agregar en scrapeEvent()~~
~~const description = normalizeWhitespace(~~
~~  $("[class*='description']").first().text() ||~~
~~  $("meta[property='og:description']").attr("content") ||~~
~~  ""~~
~~) || null;~~
~~```~~

**YA RESUELTO:** RedTickets ahora extrae descripción correctamente.

#### 1. **[ALTA] Agregar coordenadas a TicketFacil** (~200-400 eventos)
**Por qué**: Segundo mayor proveedor, sin coords ni venue address.

**Estrategia**: Usar el venue name para geocodificación en el pipeline.

```typescript
// Alternativa: parsear la dirección del venueText
// "📍 Teatro Solís - Juan Lindegoyen 1851"
const venueParts = rawVenue.split(" - ");
const venueName = venueParts[0]?.replace(/^📍\s*/, "") || null;
const venueAddress = venueParts[1] || null;
```

#### 3. **[ALTA] Robustecer Cartelera + agregar coordenadas** (~100-200 eventos)
**Por qué**: Dependencia frágil de clases CSS, sin coords.

**Estrategia**:
- Usar selectores más genéricos
- Agregar lookup en KNOWN_VENUES para teatros conocidos

### 9.2 Media Prioridad

#### 4. **[MEDIA] Agregar coordenadas a MVD Eventos** (~50-150 eventos)
**Por qué**: Drupal bien estructurado pero sin coords.

**Estrategia**: El venue tiene campos bien definidos, usar para lookup.

#### 5. **[MEDIA] Mejorar parsing de fechas en MVD Eventos**
**Problema**: Múltiples formatos de fecha = errors de parsing.

### 9.3 Baja Prioridad

#### 6. **[BAJA] Reescribir o eliminar Entraste** (~20-50 eventos)
**Por qué**: Poca cobertura, campos mínimos, estructura frágil.

**Opciones**:
- Reescribir completamente el scraper
- Eliminar si el volumen no justifica el mantenimiento

---

## 10. Conclusiones

### 10.1 Estado Actual del Sistema

El sistema de scraping está **funcional pero con limitaciones significativas**:

1. **Scrapers**: 2 de excelente calidad (CobraTicket, RedTickets), 2 buenos, 1 regular
2. **Coordenadas**: Solo 2/6 scrapers las proveen → ~33% de eventos tienen mapa
3. **Normalización**: Funciona bien pero depende mucho de IA para fechas difíciles
4. **Clasificación**: Regex-based robusta pero con casos edge
5. **Geocodificación**: Limitada por venues conocidos + API externa
6. **Descripción**: **YA RESUELTO** - RedTickets ahora extrae descripción

### 10.2 Métricas Estimadas

- **Eventos scrapeados por ciclo**: ~1,170-2,100
- **Eventos válidos tras pipeline**: ~60-80% (20-40% rechazados como no-eventos)
- **Eventos con coordenadas**: ~40% (solo CobraTicket + RedTickets)
- **Eventos con precio**: ~70%
- **Clasificados por IA**: ~15-20%

### 10.3 Área de Mayor Impacto (POR VOLUMEN)

| Prioridad | Mejora | Eventos Affected | Esfuerzo |
|-----------|--------|------------------|-----------|
| ~~**#1** | Extraer descripción en RedTickets | ~~500-800~~ | ~~Bajo~~ |
| **#1** | Agregar coords a TicketFacil | ~200-400 | Medio |
| **#2** | Robustecer Cartelera | ~100-200 | Medio |
| **#3** | Agregar coords a MVD Eventos | ~50-150 | Medio |
| **#4** | Reescribir/eliminar Entraste | ~20-50 | Alto |

### 10.4 Recomendación Estratégica

Dada la distribución de volumen:

**El 90% del volumen viene de solo 3 scrapers:**

| Scraper | Volumen | % Total | Problema Principal | Prioridad |
|---------|---------|---------|-------------------|-----------|
| RedTickets | ~500-800 | ~42% | ✅ Ya resuelto (descripción) | - |
| CobraTicket | ~300-500 | ~23% | ✅ Completo | - |
| TicketFacil | ~200-400 | ~18% | ✅ Venue address resuelto, ❌ Sin coords | **#1** |
| Cartelera | ~100-200 | ~9% | Sin coords, frágil | **#2** |
| MVD Eventos | ~50-150 | ~5% | Sin coords, sin prices | #3 |
| Entraste | ~20-50 | ~2% | Casi todo incompleto | #4 |

**Invertir en:**
1. **TicketFacil** = +18% con esfuerzo medio (geocodificación + venue address resuelto ✅)
2. **Cartelera** = +9% con esfuerzo medio

---

## 11. Reanálisis General del Sistema (2026-02-21)

### 11.1 Fortalezas y Cosas Buenas

#### Arquitectura General
- **Next.js 16 con App Router**: Estructura moderna y escalable
- **Separación clara de responsabilidades**: Scrapers → Pipeline → UI
- **TypeScript estricto**: Tipado completo en todo el codebase
- **ISR (Incremental Static Regeneration)**: Revalidación cada 5 minutos para contenido fresco
- **Componentes bien organizados**: Separación de lógica y presentación

#### Base de Datos y Queries
- **Índices bien definidos**: date, status, city, slug, eventType
- **Consultas optimizadas**: Filtrado en DB, no en memoria
- **Drizzle ORM**: Type-safe database queries
- **Migraciones versionadas**: Control de schema con Drizzle Kit

#### Sistema de Procesamiento
- **Pipeline robusto**: Normalización → Clasificación → Geocodificación → Deduplicación
- **Reintentos con backoff**: Manejo de errores transitorios
- **Fallback a IA**: Clasificación cuando heurísticas fallan
- **Deduplicación inteligente**: Merge de datos incompletos

#### Seguridad y Rate Limiting
- **Rate limiting con Upstash Redis**: 30 req/min para API, 5/hr para submissions
- **Autenticación HMAC para admin**: Tokens firmados con secret
- **Validación con Zod**: Schemas estricta para submissions
- **Protección CSRF**: Headers de seguridad

#### UI/UX
- **Diseño consistente**: Tailwind CSS con custom theme
- **Estados de carga**: Skeletons para suspense
- **Manejo de errores**: Páginas de error dedicadas
- **Imágenes optimizadas**: Fallback para imágenes rotas
- **Sistema de trending**: Redis-based real-time tracking

#### Sistema de Scraping
- **Base scraper reutilizable**: Herencia y composición
- **Rate limiting por fuente**: Control de velocidad
- **Upsert strategy**: Actualización de eventos existentes
- **Múltiples fuentes**: 6 scrapers para cobertura diversificada

---

### 11.2 Inconsistencias y Problemas Detectados

#### Inconsistencias de Datos entre Scrapers

| Scraper | Coordinates | Venue Address | Prices | Category | Description |
|---------|-------------|---------------|--------|----------|-------------|
| CobraTicket | ✅ | ✅ | ⚠️ Parcial | ✅ | ✅ |
| RedTickets | ✅ | ✅ | ✅ | ❌ | ✅ Recientemente agregado |
| TicketFacil | ❌ | ✅ Resuelto | ⚠️ Parcial | ❌ | ✅ |
| Cartelera | ❌ | ✅ | ✅ | ❌ | ✅ |
| MVD Eventos | ❌ | ⚠️ Parcial | ❌ | ✅ | ✅ |
| Entraste | ❌ | ✅ | ⚠️ Parcial | ❌ | ❌ |

**Problema**: Diferentes niveles de completitud entre scrapers generan experiencia de usuario inconsistente.

#### Problemas de Arquitectura

1. **Dependencias externas críticas**:
   - Mapbox API: Sin token no hay geocodificación
   - OpenAI: Costos variables, latencia
   - Redis: Punto único de fallo para rate limiting

2. **Autenticación de admin simple**:
   - Solo HMAC token, sin persistencia en DB
   - No hay roles/permisos granulares
   - Sesión de 7 días sin refresh

3. **Sin paginación**:
   - `getEventsByDate` devuelve todos los eventos
   - Puede ser lento con muchos eventos por fecha
   - `searchEvents` tiene limit=50 hardcodeado

4. **Timezone handling**:
   - `getTodayUY()` usa timezone Uruguay pero no hay validación
   - Servidor puede estar en UTC diferente

#### Problemas de Procesamiento

1. **Clasificación con sesgo**:
   - Keywords en español pueden perder matices
   - "Fiesta" puesto primero en regex puede sobreclasificar

2. **Deduplicación arbitraria**:
   - Threshold 0.82 puede ser muy alto/bajo
   - No considera fuente como factor de prioridad
   - Un scraper de baja calidad puede sobrescribir datos buenos

3. **Confidence score opaco**:
   - No está claro cómo se calcula
   - No se usa para filtrar eventos de baja calidad

4. **Venue placeholder**:
   - Muchos eventos quedan con "Venue por confirmar"
   - Afecta experiencia de usuario

#### Problemas de UI/UX

1. **Sin error boundaries**:
   - Un error en un componente puede romper toda la página
   - No hay recuperación automática

2. **Filtros sin feedback**:
   - Si no hay resultados, el mensaje no es claro
   - No sugiere alternativas

3. **Mapa limitada**:
   - Solo ~40% de eventos tienen coordenadas
   - Solo eventos con coords aparecen en mapa

4. **Trending requiere 10+ views**:
   - threshold puede ser muy alto para eventos nuevos
   - Eventos populares pero pocos vistos no aparecen

#### Problemas de Seguridad

1. **Rate limiting configurable**:
   - Variables de entorno sin validación
   - Si no hay Redis, el sistema falla completamente

2. **Submissions sin moderation**:
   - Cualquiera puede enviar eventos
   - No hay CAPTCHA o verificación
   - Email de notificación puede fallar silenciosamente

---

### 11.3 Recomendaciones de Mejora

#### Alta Prioridad

1. **Unificar completitud de datos entre scrapers**:
   - Objetivo: Todos los scrapers deben extraer coordinates, venue address, category
   - Prioridad: TicketFacil, Cartelera

2. **Agregar paginación**:
   - Implementar cursor-based pagination para eventos
   - Infinite scroll para event lists

3. **Mejorar sistema de confianza**:
   - Documentar confidence score
   - Usar para filtrar eventos de baja calidad
   - Considerar fuente como factor de peso

#### Media Prioridad

4. **Error boundaries en UI**:
   - Envolver componentes críticos
   - Recuperación graceful de errores

5. **Admin con persistencia**:
   - Guardar sesiones en DB
   - Agregar roles y permisos
   - Audit log de acciones

6. **Mejor fallback de imágenes**:
   - Imágenes por tipo de evento
   - No depender solo de gradient

#### Baja Prioridad

7. **Dashboard de métricas**:
   - Scrapers stats en tiempo real
   - Pipeline metrics
   - User engagement

8. **Sistema de cache**:
   - Cachear respuestas de API externas
   - Reducir costos de Mapbox/OpenAI

9. **Tests**:
   - Unit tests para scrapers
   - Integration tests para pipeline

---

### 11.4 Estado de Salud General

| Área | Estado | Notas |
|------|--------|-------|
| Arquitectura | ✅ Excelente | Next.js 16, App Router, TypeScript |
| Base de Datos | ✅ Buena | Índices, migraciones, tipos |
| Pipeline | ✅ Bueno | Retry, deduplicación, IA fallback |
| Scrapers | ⚠️ Mixto | Diferentes niveles de completitud |
| UI/UX | ✅ Bueno | Diseño consistente, good UX |
| Seguridad | ✅ Bueno | Rate limiting, validación |
| DevEx | ✅ Bueno | TypeScript, ESLint, tooling |

**Puntuación general: 8/10**

El sistema está bien construido y funcional. Las principales áreas de mejora son:
1. Unificar calidad de datos entre scrapers
2. Agregar paginación
3. Mejorar sistema de confianza
4. Agregar error boundaries

---

*Documento actualizado - Fecha: 2026-02-21 (reanalisis completo)*
