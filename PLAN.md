# ¿Dónde es Hoy? — Plan de Arquitectura y MVP

> Plataforma web nightlife mobile-first para Montevideo, Uruguay.
> "Entrás, y en 5 segundos sabés a dónde ir esta noche."

---

## Índice

1. [Stack Tecnológico](#stack-tecnológico)
2. [Decisiones Técnicas](#decisiones-técnicas)
3. [Costos Estimados](#costos-estimados)
4. [Arquitectura General](#arquitectura-general)
5. [Flujo de Datos](#flujo-de-datos)
6. [Schema de Base de Datos](#schema-de-base-de-datos)
7. [Estructura del Proyecto](#estructura-del-proyecto)
8. [Automatización de Scrapers](#automatización-de-scrapers)
9. [Pipeline de Procesamiento IA](#pipeline-de-procesamiento-ia)
10. [Propuesta de Diseño Visual](#propuesta-de-diseño-visual)
11. [Roadmap por Fases](#roadmap-por-fases)
12. [Niveles Post-MVP](#niveles-post-mvp)
13. [Primeros Pasos para Codear](#primeros-pasos-para-codear)
14. [Criterios de Verificación](#criterios-de-verificación)

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.1 |
| React | React + React DOM | 19.2 |
| Lenguaje | TypeScript | 5.x |
| ORM | Drizzle ORM | latest (~1.0) |
| DB Driver | postgres (postgres.js) | latest |
| Base de Datos | Supabase PostgreSQL | - |
| Auth | Supabase Auth (`@supabase/ssr`) | latest |
| Storage | Supabase Storage | - |
| Styling | Tailwind CSS v4 + shadcn/ui | v4 |
| Animaciones | Motion (ex Framer Motion) | v12 |
| Scraping | Cheerio | 1.2.x |
| Cache / Rate Limit | Upstash Redis | latest |
| IA | OpenAI API | gpt-4o-mini |
| Deploy | Vercel | - |
| Mapas (post-MVP) | Mapbox GL JS | - |

---

## Decisiones Técnicas

| Decisión | Elección | Por qué |
|----------|----------|---------|
| **Next.js 16 sobre 14/15** | Next.js 16.1 | Turbopack default (builds 10x más rápido), React Compiler (memoización automática), `use cache` directive, View Transitions nativas con React 19.2 |
| **Drizzle sobre Prisma** | Drizzle ORM | Bundle ~50KB vs ~5MB de Prisma. Sin binario runtime. Edge/serverless compatible. SQL-first = más control para queries complejas (geo, filtros). Perfecto para Vercel |
| **Supabase sobre Neon** | Supabase (all-in-one) | DB + Auth + Storage + Realtime en un solo servicio. Auth integrado evita pagar/configurar Clerk. Storage para fotos de usuarios sin S3 extra. Free tier generoso |
| **Supabase Auth sobre Clerk** | Supabase Auth | **$0 costo** vs Clerk (gratis hasta 10K MAU pero vendor lock-in). Integrado nativamente con la DB. Menos dependencias externas |
| **Drizzle como query layer** | Drizzle + Supabase | Drizzle se conecta directo al PostgreSQL de Supabase para queries tipadas. Supabase client se usa solo para Auth y Storage. Lo mejor de los dos mundos |
| **Tailwind v4 + shadcn/ui** | Componentes copiados al proyecto | shadcn/ui genera código en tu repo (no es dependencia). Totalmente customizable para el tema nocturno. Radix primitives accesibles |
| **Motion sobre CSS puro** | Motion v12 | API declarativa para micro-interacciones. Compatible React 19.2. Gestures (swipe días). Layout animations. El bundle es aceptable para la UX que necesitamos |
| **Cheerio sobre Playwright** | Cheerio para scrapers | RedTickets y Tickantel son SSR (HTML puro). No necesitan headless browser. Cheerio es ~1MB vs Playwright ~100MB+. Corre perfecto en serverless |
| **Upstash Redis** | HTTP-based Redis | Serverless-friendly (sin TCP). Rate limiting para scrapers. Cache de resultados. Distributed locks para evitar cron jobs concurrentes. Free tier: 10K requests/día |
| **OpenAI gpt-4o-mini** | Modelo barato para IA | ~$0.15 por 1M input tokens. Para normalizar fechas y clasificar eventos es más que suficiente. No necesitamos gpt-4o completo para el MVP |
| **Vercel Hobby sobre Pro** | Plan gratuito | Cron 1x/día es suficiente para MVP. 100GB bandwidth. Serverless functions 300s timeout. Upgradeamos a Pro ($20/mes) solo cuando necesitemos cron más frecuente |

---

## Costos Estimados (MVP — Mínimo Absoluto)

> **Objetivo: $0/mes en desarrollo, <$5/mes en producción con tráfico bajo**

| Servicio | Plan | Costo | Límites clave |
|----------|------|-------|---------------|
| **Vercel** | Hobby (free) | $0 | 100GB bandwidth, cron 1x/día, 300s serverless timeout |
| **Supabase** | Free | $0 | 500MB DB, 1GB Storage, 50K auth MAU, 2 projects. Se pausa tras 7 días inactivo |
| **Upstash Redis** | Free | $0 | 10K commands/día, 256MB |
| **OpenAI** | Pay-as-you-go | ~$1-3/mes | gpt-4o-mini: ~$0.15/1M input tokens. Procesamos ~100-200 eventos/día |
| **Dominio** | dondeeshoy.uy (si se registra) | ~$30/año | Opcional, se puede usar vercel.app gratis |
| **Mapbox** (post-MVP) | Free tier | $0 | 50K map loads/mes gratis |
| **TOTAL MVP** | | **~$1-3/mes** | Solo OpenAI tiene costo real. Todo lo demás en free tier |

### Cuándo escalar (y cuánto cuesta)

| Trigger | Upgrade | Costo nuevo |
|---------|---------|-------------|
| Necesitamos cron cada hora | Vercel Pro | +$20/mes |
| DB supera 500MB | Supabase Pro | +$25/mes |
| Storage supera 1GB | Supabase Pro | (incluido en Pro) |
| >10K Redis commands/día | Upstash Pay-as-you-go | +$0.20 por 100K extra |
| Mucho tráfico de IA | Caché agresivo + batching | Reduce costos sin upgrade |

### Tips para mantener costos bajos

1. **Cachear agresivamente**: eventos no cambian cada minuto. ISR con revalidate de 1 hora
2. **Batching IA**: procesar todos los raw_events pendientes en UNA sola llamada a OpenAI (no uno por uno)
3. **Evitar scraping innecesario**: comparar hash del HTML descargado, si no cambió → skip processing
4. **Images**: usar Supabase Storage con transformaciones (resize server-side) para no gastar bandwidth en imágenes pesadas
5. **Edge caching**: Vercel cachea automáticamente las respuestas de SSR/ISR en el edge

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    FUENTES DE DATOS                         │
│  RedTickets.uy │ Tickantel.com.uy │ Eventbrite │ (futuro:  │
│  (HTML scrape) │ (HTML scrape)    │ (API+scrape)│ IG, etc) │
└───────┬─────────────────┬──────────────┬────────────────────┘
        │                 │              │
        ▼                 ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA DE RECOLECCIÓN (Scrapers)                  │
│  Vercel Cron (1x/día) → API Routes → Cheerio parsing        │
│  Rate limiting con Upstash Redis                             │
│  Resultado: raw_events en Supabase DB                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA DE PROCESAMIENTO (IA Pipeline)             │
│  1. Normalización (fecha, hora, lugar → formato estándar)    │
│  2. Geocoding (dirección → lat/lng)                          │
│  3. Deduplicación (mismo evento de distintas fuentes)        │
│  4. Clasificación (tipo de evento, género musical)           │
│  5. Score de confianza (qué tan completo es el dato)         │
│  OpenAI gpt-4o-mini para casos ambiguos (batch processing)   │
│  Resultado: events (tabla principal, datos limpios)          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA DE EXPERIENCIA (Frontend)                   │
│  Next.js 16 App Router + SSR/ISR (revalidate 1h)            │
│  Mobile-first, dark mode, estética nocturna                  │
│  Home: "Hoy en tu ciudad" → lista de eventos                 │
│  Ficha de evento → detalle completo                          │
│  Auth: login → marca asistencia, puntaje, foto               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA DE MEMORIA PERSONAL                         │
│  user_attendances, user_ratings, user_photos                 │
│  Diario personal: historial privado de jodas                 │
│  Supabase Storage para fotos                                 │
│  (Futuro: recap anual, stats shareables)                     │
└─────────────────────────────────────────────────────────────┘
```

### Principios de arquitectura

- **Modular**: cada capa es independiente (scrapers no saben de frontend, frontend no sabe de scrapers)
- **Escalable**: agregar nueva fuente = crear un nuevo archivo en `scrapers/`, no tocar nada más
- **Barato**: free tiers everywhere, IA solo cuando es necesario, cache agresivo
- **Sin overengineering**: no hay microservicios, no hay Kafka, no hay Docker. Es un monolito Next.js bien organizado

---

## Flujo de Datos

### Fuente → Evento → Usuario

```
1. RECOLECCIÓN (automática, 1x/día)
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │RedTickets│     │Tickantel │     │Eventbrite│
   │  scraper │     │  scraper │     │  scraper │
   └────┬─────┘     └────┬─────┘     └────┬─────┘
        │                │                │
        ▼                ▼                ▼
   ┌─────────────────────────────────────────┐
   │           raw_events (DB)               │
   │  source | source_id | raw_data (JSON)   │
   │  scraped_at | processed: false          │
   └──────────────────┬──────────────────────┘
                      │
2. PROCESAMIENTO (automático, post-scraping)
                      │
                      ▼
   ┌─────────────────────────────────────────┐
   │         AI Processing Pipeline          │
   │                                         │
   │  raw_event → normalizar fecha/hora      │
   │           → geocodificar dirección      │
   │           → buscar duplicados           │
   │           → clasificar tipo/género      │
   │           → calcular confidence_score   │
   │                                         │
   │  Si es nuevo  → INSERT en events        │
   │  Si es dupl   → UPDATE event_sources    │
   │  Marcar raw_event.processed = true      │
   └──────────────────┬──────────────────────┘
                      │
3. PRESENTACIÓN (on-demand, cacheado)
                      │
                      ▼
   ┌─────────────────────────────────────────┐
   │       events (tabla principal)           │
   │  SELECT * FROM events                   │
   │  WHERE date = today AND status = active │
   │  ORDER BY start_time ASC               │
   └──────────────────┬──────────────────────┘
                      │
                      ▼
   ┌─────────────────────────────────────────┐
   │      Frontend (SSR + ISR 1h cache)      │
   │                                         │
   │  Home → cards de eventos de hoy         │
   │  /evento/[slug] → detalle completo      │
   │  /proximos → próximos días              │
   └──────────────────┬──────────────────────┘
                      │
4. INTERACCIÓN (usuario autenticado)
                      │
                      ▼
   ┌─────────────────────────────────────────┐
   │       Acciones del usuario              │
   │                                         │
   │  → Marcar "Asistí" (toggle)            │
   │  → Puntuar ⭐ 1-5 (privado)           │
   │  → Comentar (privado)                  │
   │  → Subir 1 foto (Supabase Storage)     │
   │  → Ver historial personal              │
   └─────────────────────────────────────────┘
```

---

## Schema de Base de Datos

### Tabla: `raw_events`
> Datos crudos tal cual vienen del scraper. Se procesan y nunca se muestran directo al usuario.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid (PK) | auto-generated |
| `source` | enum: `redtickets`, `tickantel`, `eventbrite` | de dónde vino |
| `source_id` | varchar | ID del evento en la fuente original |
| `source_url` | varchar | URL completa al evento en la fuente |
| `raw_data` | jsonb | todos los datos extraídos sin procesar |
| `scraped_at` | timestamptz | cuándo se scrapeó |
| `processed` | boolean (default false) | si ya pasó por el pipeline IA |
| `processing_error` | text (nullable) | si el pipeline falló, por qué |
| **UNIQUE** | `(source, source_id)` | evita duplicados de misma fuente |

### Tabla: `events`
> Eventos normalizados, listos para mostrar. Fuente de verdad del frontend.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid (PK) | auto-generated |
| `name` | varchar | nombre del evento |
| `slug` | varchar (UNIQUE) | para URL amigable |
| `description` | text (nullable) | descripción larga |
| `date` | date | día del evento |
| `start_time` | time (nullable) | hora de inicio |
| `end_time` | time (nullable) | hora de fin |
| `venue_name` | varchar | nombre del lugar |
| `venue_address` | varchar (nullable) | dirección completa |
| `latitude` | decimal (nullable) | para mapa |
| `longitude` | decimal (nullable) | para mapa |
| `city` | varchar (default `Montevideo`) | ciudad |
| `event_type` | enum: `fiesta`, `festival`, `recital`, `club`, `bar`, `teatro`, `otro` | tipo |
| `music_genre` | varchar (nullable) | género musical |
| `image_url` | varchar (nullable) | imagen de portada (de la fuente) |
| `ticket_url` | varchar (nullable) | link para comprar entrada |
| `price_min` | integer (nullable) | precio mínimo en centésimos |
| `price_max` | integer (nullable) | precio máximo en centésimos |
| `currency` | varchar (default `UYU`) | moneda |
| `is_free` | boolean (default false) | es gratis? |
| `age_restriction` | integer (nullable) | edad mínima |
| `confidence_score` | decimal | 0-1, qué tan confiable es el dato |
| `status` | enum: `active`, `cancelled`, `past` | estado |
| `created_at` | timestamptz | auto |
| `updated_at` | timestamptz | auto |
| **INDEX** | `(date, city, status)` | query principal del home |
| **INDEX** | `(slug)` | para URL lookup |

### Tabla: `event_sources`
> Relación N:N: un evento puede venir de múltiples fuentes (RedTickets + Tickantel).

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid (PK) | |
| `event_id` | uuid (FK → events) | |
| `raw_event_id` | uuid (FK → raw_events) | |
| `source` | varchar | nombre de la fuente |
| `source_url` | varchar | link original |

### Tabla: `user_attendances`
> Marca de "Asistí a este evento".

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users) | usuario de Supabase Auth |
| `event_id` | uuid (FK → events) | |
| `created_at` | timestamptz | |
| **UNIQUE** | `(user_id, event_id)` | una sola asistencia por user por evento |

### Tabla: `user_ratings`
> Puntaje + comentario PRIVADO.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users) | |
| `event_id` | uuid (FK → events) | |
| `score` | integer (1-5) | estrellas |
| `comment` | text (nullable) | comentario privado |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| **UNIQUE** | `(user_id, event_id)` | un solo rating por user por evento |

### Tabla: `user_photos`
> La "mejor foto de la noche" — una foto por user por evento.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → auth.users) | |
| `event_id` | uuid (FK → events) | |
| `storage_path` | varchar | path en Supabase Storage |
| `created_at` | timestamptz | |
| **UNIQUE** | `(user_id, event_id)` | una sola foto por user por evento |

### Tabla: `venues` (preparada, se usa post-MVP)
> Lugares normalizados. En el MVP, venue_name/venue_address están directo en events.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid (PK) | |
| `name` | varchar | |
| `slug` | varchar (UNIQUE) | |
| `address` | varchar | |
| `latitude` | decimal | |
| `longitude` | decimal | |
| `city` | varchar | |
| `instagram_handle` | varchar (nullable) | |
| `website` | varchar (nullable) | |

---

## Estructura del Proyecto

```
dondeeshoy/
├── src/
│   ├── app/                              # Next.js 16 App Router
│   │   ├── (auth)/                       # Grupo: rutas de autenticación
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── callback/route.ts         # OAuth callback
│   │   ├── (main)/                       # Grupo: layout principal con nav
│   │   │   ├── layout.tsx                # Layout con bottom nav + header
│   │   │   ├── page.tsx                  # Home: "Hoy en tu ciudad"
│   │   │   ├── evento/
│   │   │   │   └── [slug]/page.tsx       # Ficha de evento
│   │   │   ├── proximos/page.tsx         # Próximos días
│   │   │   ├── historial/page.tsx        # Mi historial (auth required)
│   │   │   └── perfil/page.tsx           # Mi perfil (auth required)
│   │   ├── api/
│   │   │   ├── scrape/
│   │   │   │   ├── redtickets/route.ts   # Scraper RedTickets
│   │   │   │   ├── tickantel/route.ts    # Scraper Tickantel
│   │   │   │   ├── eventbrite/route.ts   # Scraper Eventbrite
│   │   │   │   └── process/route.ts      # Trigger pipeline IA
│   │   │   ├── events/
│   │   │   │   ├── route.ts              # GET lista de eventos
│   │   │   │   └── [id]/route.ts         # GET detalle evento
│   │   │   └── user/
│   │   │       ├── attendance/route.ts   # POST/DELETE asistencia
│   │   │       ├── rating/route.ts       # POST/PUT puntaje
│   │   │       └── photo/route.ts        # POST foto
│   │   ├── layout.tsx                    # Root layout (fonts, theme, providers)
│   │   ├── globals.css                   # Tailwind + custom CSS neón
│   │   └── proxy.ts                      # Next.js 16 proxy (ex middleware)
│   │
│   ├── components/
│   │   ├── ui/                           # shadcn/ui (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── events/
│   │   │   ├── event-card.tsx            # Card glassmorphism
│   │   │   ├── event-list.tsx            # Lista scrollable
│   │   │   ├── event-detail.tsx          # Vista detalle
│   │   │   ├── event-filters.tsx         # Filtros fecha/tipo
│   │   │   └── event-skeleton.tsx        # Skeleton loader neón
│   │   ├── layout/
│   │   │   ├── header.tsx                # Header sticky
│   │   │   ├── bottom-nav.tsx            # Bottom navigation mobile
│   │   │   └── page-transition.tsx       # Motion transitions
│   │   ├── user/
│   │   │   ├── attendance-button.tsx     # Toggle "Asistí"
│   │   │   ├── rating-stars.tsx          # ⭐ 1-5
│   │   │   ├── photo-upload.tsx          # Upload foto
│   │   │   └── history-card.tsx          # Card historial
│   │   └── shared/
│   │       ├── neon-glow.tsx             # Wrapper glow effect
│   │       ├── time-badge.tsx            # Badge "AHORA" / "En 2h"
│   │       └── city-selector.tsx         # Selector ciudad
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                # Browser client (createBrowserClient)
│   │   │   ├── server.ts                # Server client (createServerClient)
│   │   │   └── admin.ts                 # Service role (scrapers, pipeline)
│   │   ├── db/
│   │   │   ├── index.ts                 # Drizzle client init
│   │   │   ├── schema/
│   │   │   │   ├── events.ts            # events, raw_events, event_sources
│   │   │   │   ├── users.ts             # attendances, ratings, photos
│   │   │   │   ├── venues.ts            # venues (post-MVP)
│   │   │   │   └── index.ts             # Re-export
│   │   │   └── migrations/              # Drizzle Kit generated
│   │   ├── redis.ts                     # Upstash Redis client
│   │   └── utils.ts                     # Helpers compartidos
│   │
│   ├── scrapers/
│   │   ├── base-scraper.ts              # Interfaz base + helpers
│   │   ├── redtickets.ts                # Scraper RedTickets
│   │   ├── tickantel.ts                 # Scraper Tickantel
│   │   ├── eventbrite.ts                # Scraper Eventbrite
│   │   ├── types.ts                     # Tipos compartidos scrapers
│   │   └── utils.ts                     # Rate limiting, retry, parseo
│   │
│   ├── processing/
│   │   ├── pipeline.ts                  # Orquestador del pipeline
│   │   ├── normalizer.ts                # Normalización fechas/lugares
│   │   ├── deduplicator.ts              # Dedup fuzzy match
│   │   ├── geocoder.ts                  # Dirección → coordenadas
│   │   ├── classifier.ts               # Tipo/género vía IA
│   │   └── ai-client.ts                # OpenAI wrapper
│   │
│   ├── hooks/
│   │   ├── use-events.ts               # Data fetching eventos
│   │   ├── use-attendance.ts            # Toggle asistencia
│   │   ├── use-rating.ts               # Puntaje
│   │   └── use-auth.ts                 # Estado auth
│   │
│   ├── types/
│   │   ├── events.ts                    # Tipos de eventos
│   │   ├── user.ts                      # Tipos de usuario
│   │   └── api.ts                       # Tipos responses API
│   │
│   └── config/
│       ├── site.ts                      # Metadata del sitio
│       ├── navigation.ts                # Items de nav
│       └── scraper-config.ts            # URLs, intervalos, etc.
│
├── public/
│   ├── fonts/                           # Self-hosted (Space Grotesk, Inter)
│   └── images/
│       ├── logo.svg
│       └── og-image.png                 # OpenGraph
│
├── drizzle.config.ts                    # Drizzle Kit config
├── vercel.json                          # Cron jobs
├── .env.local                           # Variables locales
├── .env.example                         # Template env vars
├── components.json                      # shadcn/ui config
├── tailwind.config.ts                   # Tema nocturno custom
├── next.config.ts
├── tsconfig.json
├── package.json
├── PLAN.md                              # Este archivo
├── PROGRESS.md                          # Tracking de avances
└── README.md
```

---

## Automatización de Scrapers

### Fuentes investigadas

| Fuente | Método | Prioridad | Dificultad | API pública |
|--------|--------|-----------|------------|-------------|
| **RedTickets.uy** | HTML scraping (Cheerio) | 🔴 Alta | Fácil | ❌ No |
| **Tickantel.com.uy** | HTML scraping (Cheerio) | 🔴 Alta | Media | ❌ No |
| **Eventbrite** | Scrape discovery + API detalle | 🟡 Media | Media | ⚠️ Parcial (search deprecada) |
| **Facebook Events** | ❌ NO VIABLE | - | - | Solo Marketing Partners |
| **Instagram** | Post-MVP: monitorear cuentas | 🟢 Baja | Alta | ⚠️ Limitada |
| **CobraTickets** | Necesita más investigación | 🟢 Baja | Desconocida | Desconocido |

### RedTickets — Scraper detallado

**Arquitectura del sitio**: Java servlet SSR. HTML completo en cada request.

**Algoritmo**:
1. `GET https://redtickets.uy/` → parsear homepage con Cheerio
2. Extraer todos los links que matchean `/evento/{slug}/{id}/`
3. Para cada link único:
   - `GET https://redtickets.uy/evento/{slug}/{id}/`
   - Parsear con Cheerio:
     - **Nombre**: heading principal
     - **Categoría**: badge/tag ("Fiestas", "Festivales", "Museos", etc.)
     - **Fecha/hora**: texto tipo "Sábado 21 de Marzo - 15 hs"
     - **Venue**: nombre + dirección completa
     - **Edad mínima**: "Edad mínima: 18 años" o "apto para todo público"
     - **Tickets**: tiers con nombre, precio (UYU), disponibilidad ("Agotado")
     - **Imagen**: `files.redtickets.uy/imagenes/{uuid}_Event_{id}.jpg`
   - Guardar en `raw_events` con `source='redtickets'`, `source_id=numericId`

**Rate limit**: 1 request/segundo (Upstash rate limiter)
**Frecuencia**: 1x/día (Vercel Cron hobby plan)

### Tickantel — Scraper detallado

**Arquitectura del sitio**: Java/Apache Wicket SSR. Antel (empresa estatal).

**Algoritmo**:
1. Crawl categorías relevantes:
   - `GET https://tickantel.com.uy/inicio/buscar_categoria?cat_id=1` (Teatro)
   - `GET https://tickantel.com.uy/inicio/buscar_categoria?cat_id=2` (Música)
   - `GET https://tickantel.com.uy/inicio/buscar_categoria?cat_id=6` (Deportes)
   - `GET https://tickantel.com.uy/inicio/buscar_categoria?cat_id=7` (Otros)
   - `GET https://tickantel.com.uy/inicio/buscar_categoria?cat_id=10` (Danza)
2. Parsear lista de eventos, extraer links a detalle: `/inicio/espectaculo/{id}/...`
3. Para cada evento:
   - `GET` página de detalle
   - Parsear con Cheerio:
     - **Nombre**: e.g. "FITO PÁEZ | SALE EL SOL TOUR"
     - **Fecha**: "Viernes 15 de mayo - 21:00 hs"
     - **Venue**: "Antel Arena", "Teatro Solís - Sala Principal"
     - **Precios**: "desde $1900 a $4200"
     - **Sectores**: con disponibilidad ("DISPONIBLES", "QUEDAN POCOS", "AGOTADAS")
     - **Imagen**: `tickantel.cdn.antel.net.uy/media/Espectaculo/{id}/{img}.jpg`
   - Guardar en `raw_events` con `source='tickantel'`, `source_id=id`

**Rate limit**: 1 request cada 2 segundos (es Antel, ser respetuoso)
**Nota**: Wicket genera URLs con tokens de sesión para navegación interna, pero las categorías y detalle de evento son URLs estables.

### Eventbrite — Scraper detallado

**API**: Existe pero la búsqueda por ubicación fue **deprecada en 2019**.

**Algoritmo híbrido**:
1. Scrape discovery: `GET https://www.eventbrite.com/d/uruguay--montevideo/events/`
2. Extraer IDs de eventos de la página
3. Usar API oficial para cada ID:
   - `GET /v3/events/{id}/?expand=venue,category,ticket_classes,ticket_availability`
   - Auth: Personal OAuth Token (header `Authorization: Bearer {TOKEN}`)
4. Data estructurada: nombre, fechas ISO, venue con coordenadas, categoría, precios, sold out status
5. Guardar en `raw_events` con `source='eventbrite'`

**Rate limit**: seguir headers de rate limit de la API
**Nota**: Eventbrite tiene menos nightlife de Uruguay que RedTickets/Tickantel.

### Patrón base del scraper

```typescript
// src/scrapers/base-scraper.ts (interfaz conceptual)
interface ScraperResult {
  source: string;
  sourceId: string;
  sourceUrl: string;
  rawData: Record<string, unknown>;
}

interface BaseScraper {
  name: string;
  // Descubrir URLs de eventos
  discover(): Promise<string[]>;
  // Scrapear un evento individual
  scrape(url: string): Promise<ScraperResult>;
  // Ejecutar todo el flujo
  run(): Promise<{ scraped: number; errors: number }>;
}
```

### Configuración del Cron

```jsonc
// vercel.json
{
  "crons": [
    {
      "path": "/api/scrape/redtickets",
      "schedule": "0 14 * * *"  // 14:00 UTC = 11:00 UYT (Uruguay)
    },
    {
      "path": "/api/scrape/tickantel",
      "schedule": "0 15 * * *"  // 15:00 UTC = 12:00 UYT
    },
    {
      "path": "/api/scrape/eventbrite",
      "schedule": "0 16 * * *"  // 16:00 UTC = 13:00 UYT
    },
    {
      "path": "/api/scrape/process",
      "schedule": "0 17 * * *"  // 17:00 UTC = 14:00 UYT (después de scrapers)
    }
  ]
}
```

> **Hobby plan**: solo permite 1 ejecución/día por cron. Timing ±59 min dentro de la hora especificada. Los scrapers se ejecutan a media mañana (hora Uruguay) para tener eventos listos antes de la noche.

---

## Pipeline de Procesamiento IA

### Flujo

1. Query: `SELECT * FROM raw_events WHERE processed = false`
2. Agrupar por batch (máx 20 eventos por llamada a OpenAI para ahorrar tokens)
3. Para cada batch:

   **a) Normalización** (puede ser regex + fallback IA):
   - "Sábado 21 de Marzo - 15 hs" → `{ date: "2026-03-21", start_time: "15:00" }`
   - "Viernes 15 de mayo - 21:00 hs" → `{ date: "2026-05-15", start_time: "21:00" }`
   - Casos ambiguos ("próximo viernes", "este finde") → OpenAI gpt-4o-mini

   **b) Geocoding** (solo si no hay coordenadas):
   - "Antel Arena" → conocido, lookup de tabla interna de venues
   - "Rambla Club de Golf - 3RFM+PM6, Rbla. Pdte. Wilson, 11300 Mont" → Mapbox Geocoding API (free tier: 100K req/mes)

   **c) Deduplicación**:
   - Buscar en `events` existentes: `WHERE date = same_date AND (name ILIKE %words% OR venue_name ILIKE %venue%)`
   - Comparar similaridad (Levenshtein o trigram con `pg_trgm`) > 0.8 → es duplicado
   - Si duplicado: agregar a `event_sources`, actualizar datos si la nueva fuente tiene más info
   - Si nuevo: crear nuevo `event`

   **d) Clasificación** (batch con OpenAI):
   - Input: nombre + descripción del evento
   - Output: `event_type` (fiesta/festival/recital/etc.) + `music_genre` (electrónica/rock/cumbia/etc.)
   - Prompt: `"Clasificá estos eventos uruguayos. Para cada uno dame tipo y género musical si aplica."`

   **e) Confidence Score**:
   - +0.2 si tiene fecha
   - +0.2 si tiene hora
   - +0.2 si tiene venue
   - +0.2 si tiene precio o "gratis"
   - +0.1 si tiene imagen
   - +0.1 si viene de múltiples fuentes

4. Marcar `raw_events.processed = true` (o `processing_error` si falló)

### Optimización de costos IA

- **Regex primero**: el 80% de las fechas se pueden parsear con regex (formatos predecibles de RedTickets/Tickantel)
- **Batch processing**: enviar 20 eventos en UN prompt, no uno por uno
- **Cache de venues**: mantener lookup table interna de venues conocidos (Antel Arena, Teatro Solís, etc.) → evita geocoding
- **gpt-4o-mini**: ~$0.15/1M input tokens vs $2.50 de gpt-4o. Para clasificación es más que suficiente
- **Skip IA si no es necesario**: si la fecha ya parsea con regex y el venue es conocido, no llamar a OpenAI

---

## Propuesta de Diseño Visual

### Paleta de colores

| Uso | Color | Hex |
|-----|-------|-----|
| Background principal | Negro profundo | `#0A0A0F` |
| Background surface | Negro suave | `#12121A` |
| Card background | Glassmorphism | `rgba(255,255,255,0.05)` + `backdrop-blur-xl` |
| Card border | Borde luminoso sutil | `rgba(255,255,255,0.08)` |
| Acento primario | Neón violeta | `#A855F7` / `#7C3AED` |
| Acento secundario | Neón cyan | `#06B6D4` / `#22D3EE` |
| Acento warm | Neón rosa | `#EC4899` |
| Texto principal | Blanco | `#F8FAFC` |
| Texto secundario | Gris claro | `#94A3B8` |
| Texto muted | Gris | `#64748B` |
| Success | Verde neón | `#22C55E` |
| Warning | Amber neón | `#F59E0B` |
| Destructive | Rojo neón | `#EF4444` |

### Tipografía

| Uso | Fuente | Peso |
|-----|--------|------|
| Headlines (h1, h2) | Space Grotesk | 700 Bold |
| Body text | Inter | 400 Regular, 500 Medium |
| Hora / números | JetBrains Mono | 500 Medium |
| Tags / badges | Inter | 600 Semibold, uppercase, tracking-wider |

### Componentes visuales

- **Event cards**: glassmorphism con `backdrop-blur-xl`, borde `1px solid rgba(255,255,255,0.08)`, hover con glow sutil del color de acento
- **Badge de tipo**: pill con fondo del color del tipo (fiesta→violeta, recital→cyan, festival→rosa), texto white, glow sutil
- **Badge "AHORA"**: fondo verde neón con animación `pulse` (Motion)
- **Badge "En 2h"**: fondo amber neón
- **Skeleton loaders**: shimmer con gradiente del background al violeta sutil
- **Botón "Asistí"**: outlined → filled con animación, feedback háptico (vibrate API)
- **Stars**: ⭐ doradas con animación de scale al tap
- **Bottom nav**: glassmorphism, 4 items (Hoy / Próximos / Historial / Perfil), icono activo con glow
- **Page transitions**: fade-up + blur con Motion AnimatePresence

### Layout mobile-first

```
┌──────────────────────────┐
│ ☰  ¿Dónde es hoy?  📍  │  ← Header sticky, logo + ciudad
├──────────────────────────┤
│                          │
│  HOY — Sábado 8 Feb      │  ← Fecha actual, swipeable
│                          │
│  ┌────────────────────┐  │
│  │ 🟣 FIESTA          │  │  ← Badge tipo con color
│  │                    │  │
│  │  Nombre del Evento │  │  ← Título grande
│  │  📍 Venue Name     │  │
│  │  🕐 23:00 — 06:00  │  │  ← Hora en mono
│  │  💰 $800           │  │
│  │                    │  │
│  │  [imagen blur bg]  │  │  ← Imagen como fondo con overlay
│  └────────────────────┘  │
│                          │
│  ┌────────────────────┐  │
│  │ 🔵 RECITAL         │  │
│  │  Otro Evento       │  │
│  │  📍 Antel Arena    │  │
│  │  🕐 21:00          │  │
│  └────────────────────┘  │
│                          │
│  ┌────────────────────┐  │
│  │ 🔴 FESTIVAL        │  │
│  │  ...               │  │
│  └────────────────────┘  │
│                          │
├──────────────────────────┤
│  🎵 Hoy  📅 Próx  📋  👤│  ← Bottom nav glassmorphism
└──────────────────────────┘
```

---

## Roadmap por Fases

### Fase 0 — Setup (2-3 días)
- [ ] Crear proyecto Next.js 16.1 + TypeScript + Tailwind v4
- [ ] Configurar shadcn/ui con tema oscuro personalizado
- [ ] Crear proyecto Supabase (Auth + Storage habilitados)
- [ ] Configurar Drizzle ORM + conexión a Supabase PostgreSQL
- [ ] Schema inicial + primera migración (`drizzle-kit push`)
- [ ] Crear instancia Upstash Redis
- [ ] Deploy inicial a Vercel (conectar repo GitHub)
- [ ] Configurar env variables en Vercel

### Fase 1 — Scrapers MVP (4-5 días)
- [ ] Implementar `base-scraper.ts` (interfaz + helpers de rate limit/retry)
- [ ] Implementar scraper RedTickets (discover + scrape + save)
- [ ] API route `/api/scrape/redtickets`
- [ ] Test manual: ejecutar scraper → ver raw_events en Supabase
- [ ] Implementar scraper Tickantel
- [ ] API route `/api/scrape/tickantel`
- [ ] Implementar scraper Eventbrite (híbrido)
- [ ] API route `/api/scrape/eventbrite`
- [ ] Configurar `vercel.json` con cron jobs
- [ ] Proteger API routes con `CRON_SECRET`

### Fase 2 — Pipeline IA (3-4 días)
- [ ] Implementar normalizer (regex + fallback IA)
- [ ] Implementar geocoder (lookup table + Mapbox fallback)
- [ ] Implementar deduplicador (fuzzy match con pg_trgm)
- [ ] Implementar clasificador (batch OpenAI gpt-4o-mini)
- [ ] Implementar pipeline orquestador
- [ ] API route `/api/scrape/process`
- [ ] Test E2E: raw_events → pipeline → events limpios

### Fase 3 — Frontend MVP (5-7 días)
- [ ] Root layout: fonts, theme, providers, CSS neón
- [ ] Bottom navigation component (Motion)
- [ ] Home page: server component con eventos de hoy
- [ ] Event card component (glassmorphism, badges, hora)
- [ ] Event detail page `/evento/[slug]`
- [ ] Página "Próximos" con filtro por día
- [ ] Skeleton loaders con shimmer neón
- [ ] Page transitions con Motion
- [ ] Empty states con diseño
- [ ] Pull-to-refresh

### Fase 4 — Auth + Memoria personal (3-4 días)
- [ ] Configurar Supabase Auth con `@supabase/ssr`
- [ ] Proxy.ts para refresh de tokens
- [ ] Login page (Google + email)
- [ ] Botón "Asistí" (toggle con animación)
- [ ] Rating stars (1-5, privado, con animación)
- [ ] Comentario privado (dialog/sheet)
- [ ] Upload foto (Supabase Storage, resize)
- [ ] Página "Mi Historial" (timeline de eventos)

### Fase 5 — Polish + Launch (2-3 días)
- [ ] SEO: metadata, OG image, structured data (JSON-LD)
- [ ] Performance: ISR con revalidate, edge caching
- [ ] Error handling completo (errores de red, auth, etc.)
- [ ] PWA básico (manifest.json para "Add to Home Screen")
- [ ] Testing manual en dispositivos reales (mobile)
- [ ] **🚀 LAUNCH MVP**

### Total estimado: 19-26 días de desarrollo

---

## Niveles Post-MVP

### Nivel 2 — Mejoras (post-launch, según tracción)

| Feature | Descripción | Dependencia |
|---------|-------------|-------------|
| Vista mapa | Mapbox GL JS con dark style, markers de eventos | Mapbox free tier |
| Filtro música | Tags de género musical clickeables | Clasificador IA funcionando |
| "Último momento" | Filtro: eventos que empiezan en próximas 2h | Horarios precisos en DB |
| Instagram auto | @dondeeshoy: posts automáticos del día | Meta Business API + cuenta IG Bus. |
| Scraping IG | Monitorear cuentas de venues/promotores | Curación manual + NLP |
| Motion avanzado | Layout animations, shared element transitions | Motion v12 |

### Nivel 3 — Visión futura (no implementar, solo prever)

| Feature | Concepto |
|---------|----------|
| Recap personal | "Tu año de jodas": resumen visual shareable |
| Social controlado | Puntaje público agregado (sin comentarios públicos) |
| Portal organizadores | Reclamar evento, editar info, destacar (monetización) |
| Multi-ciudad | Expandir a otras ciudades de Uruguay, luego LatAm |

---

## Primeros Pasos para Codear

En orden estricto:

1. **Crear proyecto**: `npx shadcn@latest create dondeeshoy` o `npx create-next-app@latest`
2. **Instalar deps**: `npm install drizzle-orm postgres @supabase/supabase-js @supabase/ssr motion cheerio @upstash/redis @upstash/ratelimit`
3. **Crear proyecto Supabase**: supabase.com/dashboard → New Project
4. **Crear instancia Upstash Redis**: console.upstash.com → New Database
5. **Configurar `.env.local`** con todas las keys
6. **Configurar Drizzle**: `drizzle.config.ts` + schema en `src/lib/db/schema/`
7. **Push schema**: `npx drizzle-kit push`
8. **Primer scraper**: implementar RedTickets completo
9. **Primer API route**: `/api/scrape/redtickets` → ejecutar → ver datos en Supabase
10. **Pipeline básico**: normalizar + guardar en `events`
11. **Primera UI**: home page con lista de eventos de hoy
12. **Deploy a Vercel**: conectar repo → deploy → verificar

---

## Criterios de Verificación

### Scrapers ✅
- `/api/scrape/redtickets` ejecuta sin errores
- `raw_events` tiene registros con datos válidos
- No hay duplicados de `(source, source_id)`
- Rate limiting funciona (1 req/seg)

### Pipeline ✅
- `raw_events` pendientes se procesan correctamente
- `events` tiene datos normalizados (fecha ISO, venue, precios)
- Deduplicación funciona (mismo evento de 2 fuentes → 1 event + 2 event_sources)
- `confidence_score` refleja la completitud del dato

### Frontend ✅
- Mobile: carga <3s en 4G
- Dark mode: no hay elementos blancos/claros que deslumbren
- Eventos de hoy visibles sin scroll en la home
- Ficha de evento muestra toda la info relevante
- Navegación fluida, sin "jank" visual

### Auth + Memoria ✅
- Login con Google funciona
- "Asistí" toggle persiste
- Rating 1-5 se guarda y muestra correctamente
- Foto se sube y se muestra en el historial
- Todo es PRIVADO (ningún otro usuario ve mi data)

### Performance ✅
- Lighthouse mobile: Performance >80, Accessibility >90
- TTFB <500ms (ISR/Edge)
- LCP <2.5s
- CLS <0.1

---

## Variables de Entorno Necesarias

```bash
# .env.local (template en .env.example)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# OpenAI (para pipeline IA)
OPENAI_API_KEY=sk-xxx

# Eventbrite (para API)
EVENTBRITE_OAUTH_TOKEN=xxx

# Vercel Cron (seguridad)
CRON_SECRET=xxx

# Mapbox (post-MVP, para geocoding y mapas)
# NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
```

---

> **Última actualización**: 8 de febrero de 2026
> **Estado**: Plan definido, pendiente inicio de implementación
