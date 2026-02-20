# Sistema de Scraping y Procesamiento de Eventos - Análisis Completo

## Resumen Ejecutivo

Este documento analiza el sistema completo de scraping de eventos de Uruguay, desde la extracción de datos crudos hasta la creación de eventos normalizados en la base de datos. El sistema comprende 6 scrapers, un normalizador, un clasificador, un geocodificador, un detector de departamentos y un deduplicador.

---

## 1. Análisis de Scrapers

### 1.1 Comparación General

| Scraper | Complejidad | Campos Extraídos | Fiabilidad | Cobertura |
|---------|-------------|------------------|------------|-----------|
| CobraTicket | Alta | 14 | Excelente | Nacional |
| RedTickets | Alta | 13 | Excelente | Nacional |
| TicketFacil | Media-Alta | 11 | Buena | Nacional |
| MVD Eventos | Media | 9 | Buena | Montevideo |
| Cartelera | Media | 11 | Buena | Montevideo |
| Entraste | Baja | 7 | Regular | Nacional |

### 1.2 Análisis Detallado por Scraper

#### 🥇 CobraTicket (Tier: Excelente)

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

#### 🥈 RedTickets (Tier: Excelente)

**Fortalezas:**
- Extrae coordenadas directamente del iframe de Google Maps嵌入
- Posee sistema avanzado de extracción de precios desde JSON GeneXus
- Detecta eventos gratuitos desde datos embebidos
- Soporte para metadatos de categoría desde cards de búsqueda

**Campos extraídos:**
```typescript
{
  title, category, dateText, venueName, venueAddress,
  imageUrl, prices, latitude, longitude, isFree
}
```

**Irregularidades detectadas:**
- El patrón de URL puede variar (`/evento/{slug}/{id}`)
- No extrae descripción del evento
- La fecha y venue vienen en un formato estructurado que requiere parsing específico (`span.Description.Flex`)

---

#### 🥉 TicketFacil (Tier: Bueno)

**Fortalezas:**
- Usa API REST de accesofacil para descubrimiento (no HTML parsing)
- Posee filtros agresivos pre-scraping para excluir eventos no válidos
- Extrae precios de dos páginas diferentes (info + registro)
- Maneja rangos de fechas correctamente

**Filtros pre-scraping implementados:**
- Excluye membresías de clubs (`socios`, `club balneario`)
- Excluye eventos corporativos privados
- Excluye eventos fuera de Uruguay por título, venue u organizador
- Excluye eventos "por invitación" sin precios públicos

**Campos extraídos:**
```typescript
{
  title, description, dateText, startTime, endTime,
  venueName, imageUrl, prices, isFreeText
}
```

**Irregularidades detectadas:**
- No extrae coordenadas (siempre `null`)
- No extrae categoría
- Venue address siempre `null`
- Dependencia de la API externa de accesofacil (punto de fallo)

---

#### 📊 MVD Eventos (Tier: Bueno)

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

**Irregularidades detectadas:**
- No extrae coordenadas
- No extrae precios
- Fechas pueden venir en múltiples formatos
- Venue address a veces mezclado con venue name

---

#### 📊 Cartelera (Tier: Bueno)

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

**Irregularidades detectadas:**
- No extrae coordenadas
- No extrae categoría
- Dependencia fuerte de clases CSS específicas (punto de rotura)
- El parsing de fechas asume año actual o siguiente

---

#### ⚠️ Entraste (Tier: Regular)

**Fortalezas:**
- Extrae venue y dirección desde HTML estructurado
- Posee manejo de URLs relativas de imágenes

**Campos extraídos:**
```typescript
{
  title, venueName, venueAddress, dateText, imageUrl, prices
}
```

**Irregularidades detectadas:**
- **NO extrae coordenadas** (crítico para geolocalización)
- No extrae categoría
- No extrae descripción
- No extrae ciudad/departamento
- Patrón de URL limitado
- Dependencia de estructura HTML específica

---

### 1.3 Ranking Final de Scrapers

| Posición | Scraper | Puntuación | Razón |
|----------|---------|------------|-------|
| 1 | CobraTicket | 9/10 | Más campos, coordenadas, city field, fallback robusto |
| 2 | RedTickets | 8.5/10 | Coordenadas, precios GeneXus, buena extracción |
| 3 | TicketFacil | 7.5/10 | API estable, filtros buenos, sin coordenadas |
| 4 | MVD Eventos | 7/10 | Drupal estructurado, sin coordenadas |
| 5 | Cartelera | 6.5/10 | Multi-fecha, cast, pero frágil |
| 6 | Entraste | 4/10 | Campos mínimos, sin coordenadas, HTML frágil |

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

El sistema tiene ~109 venues pre-mapeados con coordenadas, incluyendo:
- 70+ venues de Montevideo
- 15+ venues de Punta del Este / Maldonado
- 10+ venues del interior

### 3.3 Problemas y Limitaciones

**Irregularidades detectadas:**

1. **Dependencia de Mapbox**:
   - Sin token `NEXT_PUBLIC_MAPBOX_TOKEN` = sin geocodificación
   - API externa prone a rate limits

2. **Bounding box Uruguay**:
   - Coordendas fuera de `-36 to -30` lat y `-59 to -53` lng son rechazadas
   - Pero no hay validación de si está dentro del país correctamente

3. **KNOWN_VENUES incompleto**:
   - Solo 109 venues hardcodeados
   - Venues nuevos no reconocidos
   - Algunos coordenadas aproximadas

4. **No hay validación de calidad**:
   - No se verifica si la dirección geocodificada coincide con el venue
   - Posibles falsos positivos

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

### 8.1 Problemas de Datos

| Problema | Scraper(s) Afectado(s) | Impacto | Severidad |
|----------|------------------------|---------|-----------|
| Sin coordenadas | Entraste, TicketFacil, MVD Eventos, Cartelera | No hay mapa | Alta |
| Sin categoría | Entraste, TicketFacil, MVD Eventos | Clasificación harder | Media |
| Sin descripción | RedTickets, Entraste | Sin detalle | Media |
| Venue address null | TicketFacil, MVD Eventos | Geocodificación worse | Media |
| Fechas en texto libre | Todos | Parsing error prone | Alta |
| Precios faltantes | MVD Eventos, Entraste | Sin info de entrada | Media |

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

---

## 9. Recomendaciones de Mejora

### 9.1 Alta Prioridad

1. **Mejorar extracción de coordenadas**:
   - Agregar geocodificación a los scrapers que no la tienen
   - Priorizar CobraTicket y RedTickets como fuentes

2. **Completar venue address**:
   - Parser más agresivo para extraer dirección
   - Fallback: usar Mapbox para resolver nombre → dirección

3. **Unificar formato de fecha**:
   - Estandarizar a ISO 8601 desde el scraper
   - Reducir dependencia del parser del normalizador

### 9.2 Media Prioridad

4. **Expandir KNOWN_VENUES**:
   - Agregar más venues del interior
   - Mantener actualizable

5. **Mejora de clasificación**:
   - Agregar más patrones regex
   - Considerar embeddings para match más preciso

6. **Dashboard de calidad**:
   - Mostrar eventos con datos faltantes
   - Identificar scrapers problemáticos

### 9.3 Baja Prioridad

7. **Pipeline asíncrono**:
   - Usar workers/queues
   - Procesamiento en background

8. **Validación cruzada de datos**:
   - Verificar coherencia venue ↔ coords ↔ departamento
   - Alertar inconsistencias

---

## 10. Flujo Completo: Desde Scrape hasta Evento Real

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SCRAPING                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐               │
│  │  CobraTicket │   │  RedTickets  │   │ TicketFacil │               │
│  │  (API JSON)  │   │  (GeneXus)   │   │  (REST API) │               │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘               │
│         │                  │                  │                        │
│         ▼                  ▼                  ▼                        │
│  ┌─────────────────────────────────────────────────────────┐           │
│  │              RawEvent (rawEvents table)                  │           │
│  │  source, sourceId, sourceUrl, rawData, scrapedAt         │           │
│  └─────────────────────────────────────────────────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NORMALIZACIÓN                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  normalizeRawEvent()                                            │  │
│  │  ├─ sanitizeText() → name, description                          │  │
│  │  ├─ parseUruguayDateTime() → date, startTime                    │  │
│  │  │   └─ (fallback) resolveDateWithAi() → GPT-4                  │  │
│  │  ├─ cleanVenueName() → venueName                                 │  │
│  │  ├─ cleanVenueAddress() → venueAddress                          │  │
│  │  ├─ normalizePrices() → priceMin, priceMax                      │  │
│  │  ├─ detectDepartment() → city (department)                     │  │
│  │  └─ calculateConfidenceScore() → 0.0-1.0                        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │              NormalizedEventInput                                │  │
│  │  name, slug, description, date, startTime, endTime,            │  │
│  │  venueName, venueAddress, city, imageUrl, ticketUrl,           │  │
│  │  priceMin, priceMax, currency, isFree, ageRestriction          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FILTRADO Y CLASIFICACIÓN                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  shouldRejectEvent()                                                    │
│  ├─ Cancha de alquiler? → SKIP                                        │
│  ├─ Membresía? → SKIP                                                 │
│  └─ Clases regulares? → SKIP                                          │
│                                    │                                    │
│                                    ▼                                    │
│  classifyEvent() (heurística)                                          │
│  ├─ Regex matching → eventType                                        │
│  ├─ Venue hints → eventType                                           │
│  ├─ Metadata hints → eventType                                        │
│  └─ shouldReclassifyAsFiesta() → reclassify if >= 22:00              │
│                                    │                                    │
│                                    ▼ (si "otro" o ambiguo)             │
│  classifyEventWithAi() (fallback)                                     │
│  └─ GPT-4 → eventType, musicGenre                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          GEOCODIFICACIÓN                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  geocodeVenue()                                                        │
│  ├─ ¿Coords del scraper? → usar scraper                                │
│  ├─ lookupKnownVenue() → buscar en 109 venues                         │
│  ├─ Mapbox API → si no hay match                                      │
│  └─ bounding box validation → reject if outside Uruguay               │
│                                    │                                    │
│                                    ▼                                    │
│  detectDepartment()                                                    │
│  ├─ ¿Coords? → bounding boxes                                         │
│  └─ keywords matching → department                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DEDUPLICACIÓN                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  findDuplicateEventId()                                                │
│  ├─ Si recurrente: match nombre + ciudad                              │
│  ├─ Si puntual: match nombre + ciudad + fecha                         │
│  └─ similarity() → bigram coefficient (threshold 0.82)                 │
│                                    │                                    │
│                                    ▼                                    │
│  mergeEventData() (si duplicado)                                       │
│  └─ Actualiza: date, prices, coords, venue, image                      │
│                                                                         │
│  createEvent() (si nuevo)                                              │
│  └─ Genera slug único, inserta en tabla events                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BASE DE DATOS                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │
│  │   events    │   │ eventSources│   │  rawEvents  │                │
│  │  (tabla)    │◄──│   (tabla)   │◄──│   (tabla)   │                │
│  └─────────────┘   └─────────────┘   └─────────────┘                │
│       │                   │                                            │
│       │                   └──────┐                                     │
│       │                          │                                     │
│       ▼                          ▼                                     │
│  ┌─────────────────────────────────────────┐                           │
│  │           Evento Real Final             │                           │
│  │  id, name, slug, description, date,   │                           │
│  │  startTime, endTime, venueName,        │                           │
│  │  venueAddress, city (departamento),    │                           │
│  │  latitude, longitude, eventType,      │                           │
│  │  musicGenre, imageUrl, ticketUrl,      │                           │
│  │  priceMin, priceMax, currency, isFree, │                           │
│  │  ageRestriction, isRecurring,         │                           │
│  │  confidenceScore, status, ...          │                           │
│  └─────────────────────────────────────────┘                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Conclusiones

### 11.1 Estado Actual del Sistema

El sistema de scraping está **funcional pero con limitaciones significativas**:

1. **Scrapers**: 2 de excelente calidad (CobraTicket, RedTickets), 2 buenos, 1 regular
2. **Coordenadas**: Solo 2/6 scrapers las proveen → ~33% de eventos tienen mapa
3. **Normalización**: Funciona bien pero depende mucho de IA para fechas difíciles
4. **Clasificación**: Regex-based robusta pero con casos edge
5. **Geocodificación**: Limitada por venues conocidos + API externa

### 11.2 Métricas Estimadas

- **Eventos scrapeados por ciclo**: ~500-2000 (variable por fuente)
- **Eventos válidos tras pipeline**: ~60-80% (20-40% rechazados como no-eventos)
- **Eventos con coordenadas**: ~40% (solo CobraTicket + RedTickets)
- **Eventos con precio**: ~70%
- **Clasificados por IA**: ~15-20%

### 11.3 Área de Mayor Impacto

La **extracción de coordenadas** es el área de mayor mejora potencial:
1. Agregar geocodificación a TicketFacil y MVD Eventos
2. Expandir KNOWN_VENUES significativamente
3. Melhorar parsing de direcciones

---

*Documento generado automaticamente - Fecha: 2026-02-20*
