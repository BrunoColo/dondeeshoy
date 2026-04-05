# Agent Instructions — DondeEsHoy

> **LEÉ ESTE ARCHIVO COMPLETO antes de editar cualquier código del proyecto.**

---

## Qué es DondeEsHoy

Plataforma web (Next.js 16 / React 19 / Tailwind 4) que agrega eventos de Uruguay desde múltiples fuentes de ticketing. Se scrapean sitios como RedTickets, CobraTicket, TicketFacil, MVD Eventos, Cartelera y Entraste. Los datos crudos pasan por un pipeline de procesamiento (normalización → clasificación → geocodificación → deduplicación) y terminan como eventos en una base PostgreSQL (Drizzle ORM). El frontend es mobile-first con estética dark/neon.

---

## Arquitectura y Flujo del Sistema

```
Scrapers (6 fuentes)
    ↓  guardan raw_events en DB
Pipeline de Procesamiento
    ├── Normalizer   → limpia texto, parsea fechas/precios, detecta departamento
    ├── Classifier   → shouldRejectEvent() filtra no-eventos,
    │                   classifyEvent() asigna eventType + musicGenre
    ├── Geocoder     → coordenadas GPS (scraper-provided o Nominatim)
    ├── Deduplicator → busca duplicados por slug/nombre+fecha+venue
    └── AI Client    → clasificación con OpenAI para casos ambiguos
    ↓  crea/merge events en DB
Frontend Next.js (App Router)
    ├── / (home)        → eventos de hoy
    ├── /proximos       → eventos futuros con filtros de tiempo
    ├── /mapa           → vista de mapa con leaflet
    ├── /evento/[slug]  → detalle
    ├── /publicar       → envío de evento por usuario
    └── /admin          → dashboard admin (stats, scrapers, pipeline, submissions)
```

### Flujo de datos detallado:

1. **Scraping** (`src/scrapers/`): Cada scraper hereda de `BaseScraper`, descubre URLs, extrae datos crudos y los guarda en `raw_events`.
2. **Pipeline** (`src/processing/pipeline.ts`): Lee `raw_events` con `processed=false`, los normaliza, clasifica, geocodifica, deduplica y crea/merge `events`.
3. **API triggers** (`src/app/api/scrape/`): Endpoints que disparan scraping + pipeline. Protegidos por cron secret.
4. **Frontend** (`src/app/(main)/`): Server Components que consultan la DB vía `src/lib/queries.ts`.

---

## Estructura de Carpetas Clave

| Carpeta | Rol |
|---------|-----|
| `src/scrapers/` | Scrapers de cada fuente (base-scraper.ts, redtickets.ts, etc.) |
| `src/processing/` | Pipeline: normalizer, classifier, geocoder, deduplicator, ai-client |
| `src/lib/db/schema/` | Schema Drizzle: events, raw_events, event_sources, submissions, venues |
| `src/lib/queries.ts` | Queries de lectura para el frontend |
| `src/lib/admin-queries.ts` | Queries del dashboard admin |
| `src/lib/format.ts` | Formateo de fechas/horas/precios para Uruguay (timezone UTC-3) |
| `src/components/events/` | Componentes de eventos (cards, filtros, mapa, etc.) |
| `src/components/layout/` | Layout: header, bottom-nav, sidebar |
| `src/app/(main)/` | Páginas públicas (route group) |
| `src/app/admin/` | Dashboard admin |
| `src/app/api/` | API routes (scrape, submissions, admin) |
| `src/types/` | Tipos TypeScript compartidos (EventType, EventFilters, etc.) |
| `scripts/` | Scripts de mantenimiento (fix-*, check-*, rescrape-*, etc.) |

---

## Stack Tecnológico

- **Framework**: Next.js 16 (App Router, Server Components, ISR)
- **React**: 19.2 (server components, useTransition, Suspense)
- **ORM**: Drizzle ORM con PostgreSQL (Neon/Supabase)
- **Estilos**: Tailwind CSS 4 (dark theme, custom neon colors)
- **Mapas**: Leaflet + React-Leaflet
- **Email**: Resend
- **Rate limit**: Upstash Redis
- **AI**: OpenAI (clasificación de eventos)
- **Deployment**: Vercel (Edge + Serverless)

---

## Reglas para Bots de IA

### SIEMPRE

1. **Leer este archivo** antes de cualquier tarea.
2. **Leer el schema** (`src/lib/db/schema/`) antes de tocar queries o pipeline.
3. **Verificar tipos** en `src/types/events.ts` antes de agregar/modificar tipos de eventos.
4. **Respetar el timezone Uruguay** (UTC-3). Todas las fechas se manejan con `America/Montevideo`. Ver `src/lib/format.ts`.
5. **Mantener el estilo visual**: dark theme con acentos neon (cyan `#22d3ee`, violet `#a78bfa`). Glass morphism. Mobile-first.
6. **Usar `cn()` de `src/lib/utils.ts`** para combinar clases de Tailwind.
7. **Usar Server Components por defecto**. Solo usar `"use client"` cuando sea estrictamente necesario (interactividad, hooks del browser).
8. **Al editar queries**, tener en cuenta que los campos `priceMin` y `priceMax` son `integer` en la DB. Siempre redondear precios.
9. **Los slugs incluyen la fecha** para evitar colisiones en eventos multi-fecha (ej: `tablado-1ero-mayo-2026-02-23`).
10. **Al terminar cualquier tarea, correr siempre `npm run build`** para confirmar que todo compila.
11. **Si el build falla, arreglar los errores antes de cerrar** (no dejar compilación rota).
12. **Tener especial cuidado con Tailwind CSS**: revisar clases inválidas/typos, utilidades duplicadas y conflictos de variantes responsive/hover/focus, porque son una fuente frecuente de errores.

### NUNCA

1. **No instalar librerías de UI** (shadcn, chakra, MUI, etc.). Todo se hace con Tailwind puro.
2. **No cambiar el schema de DB** sin consultar. Las migraciones se manejan con `drizzle-kit push`.
3. **No hardcodear fechas o URLs de producción** en el código.
4. **No romper ISR**: las páginas públicas usan `revalidate` para cache. No poner `force-dynamic` sin razón.
5. **No duplicar lógica de formatting**. Usar los helpers de `src/lib/format.ts`.
6. **No ignorar `shouldRejectEvent()`**. Si un evento se rechaza, es por patrones de no-evento (canchas, alquileres, turnos). No forzar su inclusión.
7. **No mezclar lógica de admin con lógica pública**. Admin tiene sus propias queries en `admin-queries.ts`.
8. **No poner `console.log` en componentes de producción**. Solo en pipeline/scrapers para debugging.

### Convenciones de código

- **Archivos**: kebab-case (`event-card.tsx`, `time-filter.tsx`)
- **Componentes**: PascalCase (`EventCard`, `TimeFilter`)
- **Imports**: paths con `@/` alias (ej: `@/lib/queries`, `@/components/events/event-card`)
- **CSS**: Tailwind utility-first. Clases custom definidas en `globals.css` (ej: `.glass-card`, `.neon-glow`, `.skeleton`)
- **Enums en DB**: definidos como pgEnum en schema, reflejados en TypeScript en `src/types/events.ts`
- **Manejo de errores en pipeline**: usar `withTransientRetry()` para operaciones de DB

### Scrapers — Notas importantes

- RedTickets: mayor volumen (~500-800). Precios vienen como floats desde JSON GeneXus → se redondean a integer.
- CobraTicket: mejor calidad de datos. Incluye coordenadas GPS y city field.
- TicketFacil: usa API REST. NO extrae coordenadas ni venue address.
- Cartelera: enfocado en teatro/espectáculos en Montevideo.
- MVD Eventos: sitio Drupal. Solo Montevideo.
- Entraste: datos mínimos, menor volumen.

### Clasificación de eventos

Los tipos posibles son: `fiesta`, `festival`, `concierto`, `recital`, `cultural`, `deportivo`, `gastronomico`, `familiar`, `feria`, `taller`, `club`, `bar`, `teatro`, `otro`.

Flujo de clasificación:
1. Primero intenta mapear la categoría del scraper (`SOURCE_CATEGORY_MAP`)
2. Si no, usa regex heurísticos sobre nombre + descripción + venue
3. Si el resultado es `otro` o ambiguo, pide clasificación a OpenAI (budget limitado por batch)

---

## Variables de Entorno Clave

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | Clasificación AI de eventos |
| `CRON_SECRET` | Protección de endpoints de scraping |
| `ADMIN_PASSWORD` / `ADMIN_SECRET` | Auth del dashboard admin |
| `UPSTASH_REDIS_*` | Rate limiting |
| `RESEND_API_KEY` | Envío de emails |
| `NEXT_PUBLIC_SITE_URL` | URL base del sitio |
