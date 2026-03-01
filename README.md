# ¿Dónde es Hoy? — dondeeshoy.com

> Agregador de eventos en Uruguay. Todo lo que pasa en el país, en un solo lugar.

**Live:** [dondeeshoy.com](https://dondeeshoy.com)

---

## ¿Qué es?

**¿Dónde es Hoy?** es una web app que agrega y centraliza eventos de Uruguay (conciertos, ferias, teatro, deportes, fiestas y más) scrapeando automáticamente las principales plataformas de ticketing y agendas culturales del país.

El usuario puede filtrar por tipo de evento, departamento, género musical, precio y horario. Incluye vista de mapa, página de próximos eventos y formulario para publicar eventos propios.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Estilos | Tailwind CSS 4 |
| Base de datos | PostgreSQL vía Drizzle ORM |
| Cache / Locks | Upstash Redis |
| Geocodificación | Mapbox API + tabla de venues conocidos |
| Clasificación IA | OpenAI GPT-4o-mini (fallback) |
| Email | Resend |
| Deploy | Vercel (con Cron Jobs) |
| Mapas | Leaflet + React Leaflet |
| Animaciones | Motion (Framer Motion) |

---

## Arquitectura del sistema

```
[Vercel Cron] 14:00–17:30 UTC diario
      │
      ├─ /api/scrape/redtickets    → RedTickets (~500–800 eventos)
      ├─ /api/scrape/entraste      → Entraste (~15–30 eventos)
      ├─ /api/scrape/cobraticket   → CobraTicket (~100–200 eventos)
      ├─ /api/scrape/ticketfacil   → TicketFacil (~200–400 eventos)
      ├─ /api/scrape/cartelera     → Cartelera Uruguay (~50–100 funciones)
      ├─ /api/scrape/mvd-eventos   → Agenda Montevideo (~30–60 eventos)
      └─ /api/scrape/mientrada     → MiEntrada (~20–50 eventos)
                │
                ↓  UPSERT en raw_events (idempotente por source + source_id)
         [raw_events — PostgreSQL JSONB]
                │
17:00 UTC → /api/scrape/process  (drain loop, maxDuration=300s)
                │
         por cada raw_event:
           normalizeRawEvent()       ← parseo de fechas, precios, venue
           shouldRejectEvent()       ← filtros de calidad
           geocodeVenue()            ← GPS: scraper → KNOWN_VENUES → Mapbox
           detectDepartment()        ← bounding boxes de los 19 departamentos
           classifyEvent()           ← regex heurísticas + source category
           classifyEventWithAi()     ← GPT-4o-mini si tipo = "otro"
           calculateConfidenceScore()
           findDuplicateEventId()    ← Dice coefficient bigrams (threshold 0.82)
           createEvent() / mergeEventData()
                │
                ↓
         [events — PostgreSQL]
                │
03:00 UTC → mark-past (status='past' donde date < hoy)
17:30 UTC → reclassify-otros (reintento IA para tipo 'otro')
```

---

## Características principales

- **7 scrapers** con estrategias de extracción específicas por plataforma (SvelteKit JSON, GeneXus API, Drupal fields, HTML parsing)
- **Pipeline de procesamiento** con deduplicación por similitud de texto (Dice coefficient), geocodificación en cascada y clasificación automática
- **Clasificador de eventos** con 14 tipos, reglas regex, mapeo de categorías de fuente y override por heurísticas de texto
- **Admin dashboard** en `/admin` con stats en tiempo real, control de scrapers, pipeline y gestión de submissions
- **PWA** con manifest, íconos y soporte offline básico
- **SEO completo**: sitemap dinámico, robots.txt, Open Graph, Twitter Cards, metadatos geo
- **Rate limiting** con Upstash Redis en endpoints públicos
- **Formulario de publicación** con validación Zod + React Hook Form, revisión manual por admin
- **Fondo neón con parallax** usando Motion (Framer Motion) con springs físicos y soporte `prefers-reduced-motion`

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (main)/          # Sitio público (home, mapa, próximos, publicar, evento/[slug])
│   ├── admin/           # Panel de administración (dashboard, scrapers, pipeline, submissions)
│   └── api/             # API routes (scrape, events, admin, submissions)
├── components/
│   ├── events/          # Cards, filtros, mapa, skeleton, hero image
│   ├── layout/          # Header, sidebar, bottom nav, neon parallax
│   └── shared/          # Badges, empty state, share button
├── config/              # site.ts, navigation.ts, scraper-config.ts
├── lib/
│   ├── db/              # Drizzle schema + conexión
│   ├── queries.ts        # Queries públicas
│   └── admin-queries.ts  # Queries del admin
├── processing/
│   ├── scrapers/        # 7 scrapers (BaseScraper + implementaciones)
│   ├── pipeline.ts      # Orquestador del pipeline
│   ├── normalizer.ts    # Normalización de raw events
│   ├── classifier.ts    # Clasificación de tipos de evento
│   ├── geocoder.ts      # Geocodificación en cascada
│   ├── deduplicator.ts  # Deduplicación por similitud
│   └── dept-detector.ts # Detección de departamento
└── types/               # TypeScript types compartidos
```

---

## Deploy en Vercel

### 1. Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores:

```bash
cp .env.example .env.local
```

Variables requeridas:
- `DATABASE_URL` — PostgreSQL (Supabase, Neon, Railway, etc.)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis
- `OPENAI_API_KEY` — OpenAI (clasificación IA)
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox (geocodificación)
- `RESEND_API_KEY` — Resend (emails)
- `ADMIN_PASSWORD` + `ADMIN_SECRET` — Panel admin
- `CRON_SECRET` — Seguridad de cron jobs

### 2. Base de datos

```bash
npm run db:push    # Aplica el schema a la DB
```

### 3. Deploy

Conectá el repositorio en [vercel.com](https://vercel.com), configurá las variables de entorno y hacé deploy. Los cron jobs del `vercel.json` se activan automáticamente en el plan Pro.

### 4. Dominio personalizado

En el dashboard de Vercel → Settings → Domains → agregá `dondeeshoy.com` y configurá los DNS según las instrucciones.

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Levantar en desarrollo
npm run dev
# → http://localhost:3000

# Build de producción
npm run build && npm run start
```

Ver [`RUN_LOCAL.md`](RUN_LOCAL.md) para más detalles.

---

## Licencia

Proyecto personal. Todos los derechos reservados.
